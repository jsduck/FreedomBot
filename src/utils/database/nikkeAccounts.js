import { pgConfig } from '../../config/database/postgres.js';
import { logger } from '../logger.js';
import {
    getUserDailyContentsProgress,
    getUserProfileBasicInfo,
    getUserProfileOutpostInfo,
} from '../../services/nikke.js';

const DEFAULT_NIKKE_ACCOUNTS = Object.freeze([
    { name: 'Kaarako', intl_open_id: '3166452414820481224', union_id: '25471' },
    { name: 'Demi', intl_open_id: '16338490109246680481', union_id: '25471' },
    { name: 'Shaito', intl_open_id: '12167197956671690221', union_id: '25471' },
    { name: 'Fizix', intl_open_id: '5877343215992272387', union_id: '25471' },
    { name: 'Jae', intl_open_id: '15097183441877165889', union_id: '25471' },
    { name: 'Effelon', intl_open_id: '16262646283866114091', union_id: '25471' },
    { name: 'Fesha', intl_open_id: '12816795455667592937', union_id: '25471' },
    { name: 'Nelex', intl_open_id: '1175532717634698043', union_id: '25471' },
]);

const DEFAULT_NIKKE_UNIONS = Object.freeze([
    { name: 'Avaricia', union_id: '25471', area_id: 84 },
]);

function isPostgresSqlReady(wrapper) {
    return Boolean(
        wrapper?.db?.pool &&
        typeof wrapper.db.isAvailable === 'function' &&
        wrapper.db.isAvailable(),
    );
}

function normalizeAccountRow(row) {
    if (!row) {
        return null;
    }

    return {
        name: row.name ?? null,
        intl_open_id: String(row.intl_open_id ?? ''),
        union_id: row.union_id ?? null,
        discord_tag: row.discord_tag ?? null,
        ping_count: Number.parseInt(String(row.ping_count ?? 0), 10) || 0,
        basic_info: row.basic_info ?? null,
        outpost_info: row.outpost_info ?? null,
        daily_progress: row.daily_progress ?? null,
        profile_fetched_at: row.profile_fetched_at ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    };
}

function normalizeUnionRow(row) {
    if (!row) {
        return null;
    }

    return {
        name: row.name ?? null,
        union_id: String(row.union_id ?? ''),
        area_id: row.area_id ?? null,
        counter_channel_id: row.counter_channel_id ?? null,
        members: row.members ?? [],
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    };
}

async function resolveAccountAreaId(wrapper, unionId) {
    const normalizedUnionId = unionId === null || unionId === undefined || unionId === ''
        ? null
        : String(unionId).trim();

    if (!normalizedUnionId) {
        return 84;
    }

    const result = await wrapper.db.pool.query(
        `SELECT area_id
         FROM ${pgConfig.tables.nikke_unions}
         WHERE union_id = $1
         LIMIT 1`,
        [normalizedUnionId],
    );

    if (result.rows.length === 0) {
        return 84;
    }

    const areaId = Number.parseInt(String(result.rows[0].area_id), 10);
    return Number.isInteger(areaId) ? areaId : 84;
}

async function readNikkePayload(response, endpointName) {
    if (!response?.ok) {
        throw new Error(`${endpointName} request failed with status ${response?.status ?? 'unknown'}`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
        throw new Error(`${endpointName} returned an invalid response body`);
    }

    return payload;
}

async function upsertAccountProfileRow(wrapper, {
    intl_open_id,
    basic_info,
    outpost_info,
    daily_progress,
    derived_union_id = null,
}) {
    const normalizedOpenId = String(intl_open_id || '').trim();

    const result = await wrapper.db.pool.query(
        `UPDATE ${pgConfig.tables.nikke_accounts}
         SET basic_info = $2::jsonb,
             outpost_info = $3::jsonb,
             daily_progress = $4::jsonb,
             union_id = COALESCE($5, union_id),
             profile_fetched_at = NOW(),
             updated_at = NOW()
         WHERE intl_open_id = $1`,
        [
            normalizedOpenId,
            JSON.stringify(basic_info ?? {}),
            JSON.stringify(outpost_info ?? {}),
            JSON.stringify(daily_progress ?? []),
            derived_union_id,
        ],
    );

    if (result.rowCount === 0) {
        throw new Error(`Unable to update profile payloads for intl_open_id ${normalizedOpenId}`);
    }
}

const PROFILE_SECTION_DEFINITIONS = Object.freeze({
    basic_info: {
        column: 'basic_info',
        endpointName: 'getUserProfileBasicInfo',
        fetcher: getUserProfileBasicInfo,
        extractor: (payload) => payload?.data?.basic_info ?? {},
    },
    outpost_info: {
        column: 'outpost_info',
        endpointName: 'getUserProfileOutpostInfo',
        fetcher: getUserProfileOutpostInfo,
        extractor: (payload) => payload?.data?.outpost_info ?? {},
    },
    daily_progress: {
        column: 'daily_progress',
        endpointName: 'getUserDailyContentsProgress',
        fetcher: getUserDailyContentsProgress,
        extractor: (payload) => payload?.data?.daily_progress ?? [],
    },
});

async function getAccountProfileSnapshot(wrapper, intlOpenId) {
    const result = await wrapper.db.pool.query(
        `SELECT intl_open_id, union_id, basic_info, outpost_info, daily_progress, profile_fetched_at, updated_at
         FROM ${pgConfig.tables.nikke_accounts}
         WHERE intl_open_id = $1
         LIMIT 1`,
        [String(intlOpenId || '').trim()],
    );

    return result.rows[0] || null;
}

function hasCachedProfileSection(snapshot, section) {
    if (!snapshot) {
        return false;
    }

    const definition = PROFILE_SECTION_DEFINITIONS[section];
    if (!definition) {
        return false;
    }

    return snapshot[definition.column] !== null && snapshot[definition.column] !== undefined;
}

async function refreshProfileSection(wrapper, intlOpenId, unionId, section, areaIdOverride = null) {
    const definition = PROFILE_SECTION_DEFINITIONS[section];
    if (!definition) {
        throw new Error(`Unknown profile section: ${section}`);
    }

    const areaId = Number.isInteger(areaIdOverride)
        ? areaIdOverride
        : await resolveAccountAreaId(wrapper, unionId);
    const normalizedOpenId = String(intlOpenId || '').trim();

    const response = await definition.fetcher(normalizedOpenId, areaId);
    const payload = await readNikkePayload(response, definition.endpointName);
    const extracted = definition.extractor(payload);

    const result = await wrapper.db.pool.query(
        `UPDATE ${pgConfig.tables.nikke_accounts}
         SET ${definition.column} = $2::jsonb,
             profile_fetched_at = NOW(),
             updated_at = NOW()
         WHERE intl_open_id = $1
         RETURNING profile_fetched_at, updated_at`,
        [normalizedOpenId, JSON.stringify(extracted)],
    );

    if (result.rowCount === 0) {
        throw new Error(`Unable to update ${definition.column} for intl_open_id ${normalizedOpenId}`);
    }

    return {
        data: extracted,
        area_id: areaId,
        fetched_at: result.rows[0].profile_fetched_at ?? null,
        updated_at: result.rows[0].updated_at ?? null,
    };
}

async function seedDefaultAccounts(wrapper) {
    if (!isPostgresSqlReady(wrapper)) {
        return false;
    }

    const values = DEFAULT_NIKKE_ACCOUNTS.map((account) => [
        account.name,
        account.intl_open_id,
        account.union_id,
    ]);

    if (values.length === 0) {
        return false;
    }

    const placeholders = values.map((_, index) => {
        const offset = index * 3;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    }).join(', ');

    const flattened = values.flat();
    await wrapper.db.pool.query(
        `INSERT INTO ${pgConfig.tables.nikke_accounts} (name, intl_open_id, union_id)
         VALUES ${placeholders}
         ON CONFLICT (intl_open_id)
         DO UPDATE SET
             name = EXCLUDED.name,
             union_id = EXCLUDED.union_id,
             updated_at = NOW()`,
        flattened,
    );

    return true;
}

async function seedDefaultUnions(wrapper) {
    if (!isPostgresSqlReady(wrapper)) {
        return false;
    }

    const values = DEFAULT_NIKKE_UNIONS.map((union) => [
        union.name,
        union.union_id,
        union.area_id,
    ]);

    if (values.length === 0) {
        return false;
    }

    const placeholders = values.map((_, index) => {
        const offset = index * 3;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    }).join(', ');

    const flattened = values.flat();
    await wrapper.db.pool.query(
        `INSERT INTO ${pgConfig.tables.nikke_unions} (name, union_id, area_id)
         VALUES ${placeholders}
         ON CONFLICT (union_id)
         DO UPDATE SET
             name = EXCLUDED.name,
             area_id = EXCLUDED.area_id,
             updated_at = NOW()`,
        flattened,
    );

    return true;
}

export async function getNikkeAccounts(client, { seedDefaults = true } = {}) {
    try {
        const wrapper = client?.db;

        if (!wrapper) {
            return DEFAULT_NIKKE_ACCOUNTS;
        }

        if (isPostgresSqlReady(wrapper)) {
            let result = await wrapper.db.pool.query(
                `SELECT name, intl_open_id, union_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
                 FROM ${pgConfig.tables.nikke_accounts}
                 ORDER BY name ASC`,
            );

            if (result.rows.length === 0 && seedDefaults) {
                await seedDefaultAccounts(wrapper);
                result = await wrapper.db.pool.query(
                    `SELECT name, intl_open_id, union_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
                     FROM ${pgConfig.tables.nikke_accounts}
                     ORDER BY name ASC`,
                );
            }

            const rows = result.rows.map(normalizeAccountRow).filter(Boolean);
            return rows.length > 0 ? rows : DEFAULT_NIKKE_ACCOUNTS;
        }

        return DEFAULT_NIKKE_ACCOUNTS;
    } catch (error) {
        logger.error('Error loading Nikke accounts:', error);
        return DEFAULT_NIKKE_ACCOUNTS;
    }
}

export async function getNikkeAccountChoices(client) {
    const accounts = await getNikkeAccounts(client);
    return accounts.map((account) => ({
        name: account.name,
        value: account.intl_open_id,
    }));
}

export async function getNikkeUnions(client) {
    try {
        const wrapper = client?.db;

        if (!wrapper) {
            return [];
        }

        if (isPostgresSqlReady(wrapper)) {
            let result = await wrapper.db.pool.query(
                `SELECT name, union_id, area_id, counter_channel_id, members, created_at, updated_at
                 FROM ${pgConfig.tables.nikke_unions}
                 ORDER BY name ASC`,
            );

            if (result.rows.length === 0) {
                await seedDefaultUnions(wrapper);
                result = await wrapper.db.pool.query(
                    `SELECT name, union_id, area_id, counter_channel_id, members, created_at, updated_at
                     FROM ${pgConfig.tables.nikke_unions}
                     ORDER BY name ASC`,
                );
            }

            return result.rows.map(normalizeUnionRow).filter(Boolean);
        }

        return [];
    } catch (error) {
        logger.error('Error loading Nikke unions:', error);
        return [];
    }
}

export async function getNikkeUnionChoices(client) {
    const unions = await getNikkeUnions(client);
    return unions.slice(0, 25).map((union) => ({
        name: union.area_id !== null && union.area_id !== undefined
            ? `${union.name} (Area ${union.area_id})`
            : union.name,
        value: union.union_id,
    }));
}

export async function getNikkeUnionGuildChoices(client) {
    const unions = await getNikkeUnions(client);

    return unions
        .map((union) => {
            const numericUnionId = Number.parseInt(String(union.union_id), 10);
            if (!Number.isInteger(numericUnionId)) {
                return null;
            }

            return {
                name: union.area_id !== null && union.area_id !== undefined
                    ? `${union.name} (Area ${union.area_id})`
                    : union.name,
                value: numericUnionId,
            };
        })
        .filter(Boolean)
        .slice(0, 25);
}

export async function getNikkeUnionById(client, unionId) {
    if (unionId === null || unionId === undefined || unionId === '') {
        return null;
    }

    const unions = await getNikkeUnions(client);
    return unions.find((union) => String(union.union_id) === String(unionId)) || null;
}

export async function getNikkeAreaChoices(client) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return [{ name: 'global', value: 84 }];
        }

        const result = await wrapper.db.pool.query(
            `SELECT DISTINCT area_id
             FROM (
                 SELECT u.area_id
                 FROM ${pgConfig.tables.nikke_unions} u
                 WHERE u.area_id IS NOT NULL

                 UNION

                 SELECT u2.area_id
                 FROM ${pgConfig.tables.nikke_accounts} a
                 JOIN ${pgConfig.tables.nikke_unions} u2 ON u2.union_id = a.union_id
                 WHERE u2.area_id IS NOT NULL
             ) area_candidates
             ORDER BY area_id ASC`,
        );

        const choices = result.rows
            .map((row) => Number.parseInt(String(row.area_id), 10))
            .filter((areaId) => Number.isInteger(areaId))
            .slice(0, 25)
            .map((areaId) => ({
                name: areaId === 84 ? 'global' : `Area ${areaId}`,
                value: areaId,
            }));

        return choices.length > 0 ? choices : [{ name: 'global', value: 84 }];
    } catch (error) {
        logger.error('Error loading Nikke area choices:', error);
        return [{ name: 'global', value: 84 }];
    }
}

export async function getNikkeAccountByOpenId(client, intlOpenId) {
    const accounts = await getNikkeAccounts(client, { seedDefaults: false });
    return accounts.find((account) => String(account.intl_open_id) === String(intlOpenId)) || null;
}

export async function getNikkeAccountByName(client, name) {
    const accounts = await getNikkeAccounts(client, { seedDefaults: false });
    return accounts.find((account) => String(account.name).toLowerCase() === String(name).toLowerCase()) || null;
}

export async function addNikkeAccount(client, { name, intl_open_id, union_id = null, discord_tag = null }) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedName = String(name || '').trim();
        const normalizedOpenId = String(intl_open_id || '').trim();
        const normalizedUnionId = union_id === null || union_id === undefined || union_id === ''
            ? null
            : String(union_id).trim();
        const normalizedDiscordTag = discord_tag === null || discord_tag === undefined || discord_tag === ''
            ? null
            : String(discord_tag).trim();

        const result = await wrapper.db.pool.query(
            `INSERT INTO ${pgConfig.tables.nikke_accounts} (name, intl_open_id, union_id, discord_tag)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING
             RETURNING name, intl_open_id, union_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at`,
            [normalizedName, normalizedOpenId, normalizedUnionId, normalizedDiscordTag],
        );

        if (result.rowCount > 0) {
            return {
                success: true,
                inserted: true,
                account: normalizeAccountRow(result.rows[0]),
            };
        }

        const existingByOpenId = await wrapper.db.pool.query(
            `SELECT name, intl_open_id, union_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
             FROM ${pgConfig.tables.nikke_accounts}
             WHERE intl_open_id = $1
             LIMIT 1`,
            [normalizedOpenId],
        );

        if (existingByOpenId.rows.length > 0) {
            return {
                success: false,
                reason: 'already_exists',
                account: normalizeAccountRow(existingByOpenId.rows[0]),
            };
        }

        const existingByName = await wrapper.db.pool.query(
            `SELECT name, intl_open_id, union_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
             FROM ${pgConfig.tables.nikke_accounts}
             WHERE LOWER(name) = LOWER($1)
             LIMIT 1`,
            [normalizedName],
        );

        if (existingByName.rows.length > 0) {
            return {
                success: false,
                reason: 'already_exists',
                account: normalizeAccountRow(existingByName.rows[0]),
            };
        }

        return {
            success: false,
            reason: 'insert_failed',
        };
    } catch (error) {
        logger.error('Error adding Nikke account:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function syncNikkeAccountProfile(client, { intl_open_id, union_id = null }) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = String(intl_open_id || '').trim();
        const areaId = await resolveAccountAreaId(wrapper, union_id);

        const [basicRes, outpostRes, dailyRes] = await Promise.all([
            getUserProfileBasicInfo(normalizedOpenId, areaId),
            getUserProfileOutpostInfo(normalizedOpenId, areaId),
            getUserDailyContentsProgress(normalizedOpenId, areaId),
        ]);

        const basicPayload = await readNikkePayload(basicRes, 'getUserProfileBasicInfo');
        const outpostPayload = await readNikkePayload(outpostRes, 'getUserProfileOutpostInfo');
        const dailyPayload = await readNikkePayload(dailyRes, 'getUserDailyContentsProgress');
        const derivedUnionIdRaw = basicPayload.data?.basic_info?.gsn;
        const derivedUnionId = derivedUnionIdRaw === null || derivedUnionIdRaw === undefined || String(derivedUnionIdRaw).trim() === ''
            ? null
            : String(derivedUnionIdRaw).trim();

        await upsertAccountProfileRow(wrapper, {
            intl_open_id: normalizedOpenId,
            basic_info: basicPayload.data?.basic_info ?? {},
            outpost_info: outpostPayload.data?.outpost_info ?? {},
            daily_progress: dailyPayload.data?.daily_progress ?? [],
            derived_union_id: derivedUnionId,
        });

        return {
            success: true,
            intl_open_id: normalizedOpenId,
            area_id: areaId,
            union_id: derivedUnionId,
        };
    } catch (error) {
        logger.error('Error syncing Nikke account profile:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function getNikkeAccountProfileSection(
    client,
    { intl_open_id, section, refresh = false, area_id = null },
) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = String(intl_open_id || '').trim();
        const snapshot = await getAccountProfileSnapshot(wrapper, normalizedOpenId);

        if (!snapshot) {
            return {
                success: false,
                reason: 'account_not_found',
            };
        }

        if (!refresh && hasCachedProfileSection(snapshot, section)) {
            const definition = PROFILE_SECTION_DEFINITIONS[section];
            return {
                success: true,
                source: 'Database cache',
                section,
                data: snapshot[definition.column],
                fetched_at: snapshot.profile_fetched_at ?? null,
                updated_at: snapshot.updated_at ?? null,
                area_id: Number.parseInt(String(area_id), 10) || null,
            };
        }

        const parsedAreaId = Number.parseInt(String(area_id), 10);
        const refreshed = await refreshProfileSection(
            wrapper,
            normalizedOpenId,
            snapshot.union_id,
            section,
            Number.isInteger(parsedAreaId) ? parsedAreaId : null,
        );

        return {
            success: true,
            source: refresh ? 'Live API (forced refresh)' : 'Live API',
            section,
            data: refreshed.data,
            fetched_at: refreshed.fetched_at,
            updated_at: refreshed.updated_at,
            area_id: refreshed.area_id,
        };
    } catch (error) {
        logger.error(`Error retrieving Nikke account profile section ${section}:`, error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function updateNikkeAccountUnionId(client, { intl_open_id, union_id }) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = String(intl_open_id || '').trim();
        const normalizedUnionId = union_id === null || union_id === undefined || union_id === ''
            ? null
            : String(union_id).trim();

        const result = await wrapper.db.pool.query(
            `UPDATE ${pgConfig.tables.nikke_accounts}
             SET union_id = $2,
                 updated_at = NOW()
             WHERE intl_open_id = $1
             RETURNING name, intl_open_id, union_id, discord_tag, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at`,
            [normalizedOpenId, normalizedUnionId],
        );

        if (result.rowCount > 0) {
            return {
                success: true,
                account: normalizeAccountRow(result.rows[0]),
            };
        }

        return {
            success: false,
            reason: 'not_found',
        };
    } catch (error) {
        logger.error('Error updating Nikke account union id:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function deleteNikkeAccount(client, intl_open_id) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = String(intl_open_id || '').trim();

        const result = await wrapper.db.pool.query(
            `DELETE FROM ${pgConfig.tables.nikke_accounts}
             WHERE intl_open_id = $1
             RETURNING name, intl_open_id, union_id, discord_tag, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at`,
            [normalizedOpenId],
        );

        if (result.rowCount > 0) {
            return {
                success: true,
                account: normalizeAccountRow(result.rows[0]),
            };
        }

        return {
            success: false,
            reason: 'not_found',
        };
    } catch (error) {
        logger.error('Error deleting Nikke account:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function setNikkeUnionCounterEnabled(client, union_id, enabledBy = null) {
    try {
        const wrapper = client?.db;
        if (!isPostgresSqlReady(wrapper)) {
            return { success: false, reason: 'database_unavailable' };
        }

        const normalizedUnionId = String(union_id || '').trim();
        const unionResult = await wrapper.db.pool.query(
            `SELECT union_id, name, area_id, counter_channel_id, members
             FROM ${pgConfig.tables.nikke_unions}
             WHERE union_id = $1
             LIMIT 1`,
            [normalizedUnionId],
        );

        if (unionResult.rows.length === 0) {
            return { success: false, reason: 'union_not_found' };
        }

        const existingMembers = unionResult.rows[0].members && typeof unionResult.rows[0].members === 'object'
            ? unionResult.rows[0].members
            : {};

        const accountResult = await wrapper.db.pool.query(
            `SELECT intl_open_id, name, discord_tag
             FROM ${pgConfig.tables.nikke_accounts}
             WHERE union_id = $1
             ORDER BY name ASC`,
            [normalizedUnionId],
        );

        const membersPayload = {
            ...existingMembers,
            counter_enabled: true,
            enabled_at: new Date().toISOString(),
            enabled_by: enabledBy || null,
            accounts: accountResult.rows.map((row) => ({
                intl_open_id: String(row.intl_open_id || ''),
                name: row.name || null,
                discord_tag: row.discord_tag || null,
            })),
        };

        await wrapper.db.pool.query(
            `UPDATE ${pgConfig.tables.nikke_unions}
             SET members = $2::jsonb,
                 updated_at = NOW()
             WHERE union_id = $1`,
            [normalizedUnionId, JSON.stringify(membersPayload)],
        );

        return {
            success: true,
            union: normalizeUnionRow({ ...unionResult.rows[0], members: membersPayload }),
            member_count: membersPayload.accounts.length,
        };
    } catch (error) {
        logger.error('Error enabling Nikke union counter:', error);
        return { success: false, reason: 'error', error };
    }
}

export async function getEnabledNikkeUnionCounters(client) {
    try {
        const wrapper = client?.db;
        if (!isPostgresSqlReady(wrapper)) {
            return [];
        }

        const result = await wrapper.db.pool.query(
            `SELECT union_id, name, area_id, counter_channel_id, members, created_at, updated_at
             FROM ${pgConfig.tables.nikke_unions}
             WHERE COALESCE((members ->> 'counter_enabled')::boolean, false) = true
             ORDER BY name ASC`,
        );

        return result.rows.map(normalizeUnionRow).filter(Boolean);
    } catch (error) {
        logger.error('Error loading enabled Nikke union counters:', error);
        return [];
    }
}

export async function setNikkeUnionCounterDisabled(client, union_id, disabledBy = null) {
    try {
        const wrapper = client?.db;
        if (!isPostgresSqlReady(wrapper)) {
            return { success: false, reason: 'database_unavailable' };
        }

        const normalizedUnionId = String(union_id || '').trim();
        const unionResult = await wrapper.db.pool.query(
            `SELECT union_id, name, area_id, counter_channel_id, members
             FROM ${pgConfig.tables.nikke_unions}
             WHERE union_id = $1
             LIMIT 1`,
            [normalizedUnionId],
        );

        if (unionResult.rows.length === 0) {
            return { success: false, reason: 'union_not_found' };
        }

        const existingMembers = unionResult.rows[0].members && typeof unionResult.rows[0].members === 'object'
            ? unionResult.rows[0].members
            : {};

        const membersPayload = {
            ...existingMembers,
            counter_enabled: false,
            disabled_at: new Date().toISOString(),
            disabled_by: disabledBy || null,
        };

        await wrapper.db.pool.query(
            `UPDATE ${pgConfig.tables.nikke_unions}
             SET members = $2::jsonb,
                 updated_at = NOW()
             WHERE union_id = $1`,
            [normalizedUnionId, JSON.stringify(membersPayload)],
        );

        return {
            success: true,
            union: normalizeUnionRow({ ...unionResult.rows[0], members: membersPayload }),
        };
    } catch (error) {
        logger.error('Error disabling Nikke union counter:', error);
        return { success: false, reason: 'error', error };
    }
}

export async function setNikkeUnionCounterChannel(client, union_id, channel_id, updatedBy = null) {
    try {
        const wrapper = client?.db;
        if (!isPostgresSqlReady(wrapper)) {
            return { success: false, reason: 'database_unavailable' };
        }

        const normalizedUnionId = String(union_id || '').trim();
        const normalizedChannelId = String(channel_id || '').trim();

        const unionResult = await wrapper.db.pool.query(
            `SELECT union_id, name, area_id, counter_channel_id, members
             FROM ${pgConfig.tables.nikke_unions}
             WHERE union_id = $1
             LIMIT 1`,
            [normalizedUnionId],
        );

        if (unionResult.rows.length === 0) {
            return { success: false, reason: 'union_not_found' };
        }

        const existingMembers = unionResult.rows[0].members && typeof unionResult.rows[0].members === 'object'
            ? unionResult.rows[0].members
            : {};

        await wrapper.db.pool.query(
            `UPDATE ${pgConfig.tables.nikke_unions}
             SET counter_channel_id = $2,
                 updated_at = NOW()
             WHERE union_id = $1`,
            [normalizedUnionId, normalizedChannelId],
        );

        return {
            success: true,
            union: normalizeUnionRow({ ...unionResult.rows[0], members: existingMembers, counter_channel_id: normalizedChannelId }),
            channel_id: normalizedChannelId,
        };
    } catch (error) {
        logger.error('Error setting Nikke union counter channel:', error);
        return { success: false, reason: 'error', error };
    }
}

export async function getNikkeAccountsByUnionId(client, union_id) {
    try {
        const wrapper = client?.db;
        if (!isPostgresSqlReady(wrapper)) {
            return [];
        }

        const normalizedUnionId = String(union_id || '').trim();
        const result = await wrapper.db.pool.query(
            `SELECT name, intl_open_id, union_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
             FROM ${pgConfig.tables.nikke_accounts}
             WHERE union_id = $1
             ORDER BY name ASC`,
            [normalizedUnionId],
        );

        return result.rows.map(normalizeAccountRow).filter(Boolean);
    } catch (error) {
        logger.error('Error loading Nikke accounts by union id:', error);
        return [];
    }
}

export async function incrementNikkeAccountPingCount(client, intl_open_id, incrementBy = 1) {
    try {
        const wrapper = client?.db;
        if (!isPostgresSqlReady(wrapper)) {
            return false;
        }

        const normalizedOpenId = String(intl_open_id || '').trim();
        const amount = Number.parseInt(String(incrementBy), 10);
        if (!Number.isInteger(amount) || amount <= 0) {
            return false;
        }

        const result = await wrapper.db.pool.query(
            `UPDATE ${pgConfig.tables.nikke_accounts}
             SET ping_count = COALESCE(ping_count, 0) + $2,
                 updated_at = NOW()
             WHERE intl_open_id = $1`,
            [normalizedOpenId, amount],
        );

        return result.rowCount > 0;
    } catch (error) {
        logger.error(`Error incrementing Nikke account ping count for ${intl_open_id}:`, error);
        return false;
    }
}

export { DEFAULT_NIKKE_ACCOUNTS };