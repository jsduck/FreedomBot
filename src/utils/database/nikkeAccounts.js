import { pgConfig } from '../../config/database/postgres.js';
import { logger } from '../logger.js';
import {
    getGuildDetail,
    getGuildMembers,
    getUserDailyContentsProgress,
    getUserProfileBasicInfo,
    getUserProfileOutpostInfo,
} from '../../services/nikke.js';

const DEFAULT_NIKKE_ACCOUNTS = Object.freeze([]);
const DEFAULT_NIKKE_UNIONS = Object.freeze([]);

const MAX_NIKKE_ACCOUNT_COMMAND_CHOICES = 5;
const MAX_NIKKE_UNION_COMMAND_CHOICES = 10;
const MAX_NIKKE_CHOICE_NAME_LENGTH = 60;

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

    const basicInfo = row.basic_info ?? null;
    const derivedUnionIdRaw = basicInfo?.gsn;
    const derivedUnionId = derivedUnionIdRaw === null || derivedUnionIdRaw === undefined || String(derivedUnionIdRaw).trim() === ''
        ? null
        : String(derivedUnionIdRaw).trim();

    return {
        name: row.name ?? null,
        intl_open_id: String(row.intl_open_id ?? ''),
        union_id: derivedUnionId,
        discord_tag: row.discord_tag ?? null,
        ping_count: Number.parseInt(String(row.ping_count ?? 0), 10) || 0,
        basic_info: basicInfo,
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

function normalizeAccountProgressRow(row) {
    if (!row) {
        return null;
    }

    return {
        intl_open_id: String(row.intl_open_id ?? ''),
        data: row.data ?? {},
        tracked: Boolean(row.tracked),
        fetched_at: row.fetched_at ?? null,
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

function extractGuildDetailPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const data = payload.data && typeof payload.data === 'object' ? payload.data : null;
    const detail = data?.guild_detail ?? payload.guild_detail ?? null;
    return detail && typeof detail === 'object' ? detail : null;
}

function extractGuildMembersPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    const data = payload.data && typeof payload.data === 'object' ? payload.data : null;
    const items = data?.items ?? payload.items ?? data?.guild_members ?? payload.guild_members;
    return Array.isArray(items) ? items : [];
}

function toNormalizedOpenId(value) {
    return String(value || '').trim();
}

function toNormalizedUnionId(value) {
    return value === null || value === undefined || value === ''
        ? ''
        : String(value).trim();
}

function toNormalizedAreaId(value, fallback = 84) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function buildMemberSnapshotPayload(memberItems) {
    return {
        last_synced_at: new Date().toISOString(),
        source: 'getGuildMembers',
        accounts: memberItems.map((member) => ({
            intl_open_id: String(member.member_id || '').trim(),
            name: member.nickname ? String(member.nickname).trim() : null,
            bind_area_id: Number.parseInt(String(member.bind_area_id), 10) || null,
            level: Number.parseInt(String(member.level), 10) || null,
            icon_id: member.icon_id ? String(member.icon_id).trim() : null,
        })).filter((member) => member.intl_open_id),
    };
}

async function resolveUniqueAccountName(wrapper, preferredName, intlOpenId) {
    const suffixSeed = String(intlOpenId || '').trim().slice(-6) || 'member';
    const baseNameRaw = String(preferredName || '').trim();
    const fallbackBaseName = `NikkeMember-${suffixSeed}`;
    const baseName = (baseNameRaw || fallbackBaseName).slice(0, 100);

    for (let attempt = 0; attempt < 100; attempt += 1) {
        const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
        const candidate = `${baseName.slice(0, 100 - suffix.length)}${suffix}`;
        const result = await wrapper.db.pool.query(
            `SELECT 1
             FROM ${pgConfig.tables.nikke_accounts}
             WHERE LOWER(name) = LOWER($1)
             LIMIT 1`,
            [candidate],
        );

        if (result.rowCount === 0) {
            return candidate;
        }
    }

    return `${baseName.slice(0, 89)}-${Date.now().toString().slice(-10)}`;
}

async function doesUnionExist(wrapper, unionId) {
    const result = await wrapper.db.pool.query(
        `SELECT union_id
         FROM ${pgConfig.tables.nikke_unions}
         WHERE union_id = $1
         LIMIT 1`,
        [unionId],
    );

    return result.rowCount > 0;
}

async function upsertUnionFromGuildData(wrapper, {
    unionId,
    areaId,
    guildDetail,
    memberItems,
}) {
    const guildNameRaw = guildDetail?.guild_name ?? guildDetail?.name ?? `Union ${unionId}`;
    const guildName = String(guildNameRaw || `Union ${unionId}`).trim().slice(0, 100);
    const resolvedAreaId = toNormalizedAreaId(guildDetail?.nikke_area_id, areaId);

    const result = await wrapper.db.pool.query(
        `INSERT INTO ${pgConfig.tables.nikke_unions} (name, union_id, area_id, members)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (union_id)
         DO UPDATE SET
             name = EXCLUDED.name,
             area_id = COALESCE(EXCLUDED.area_id, ${pgConfig.tables.nikke_unions}.area_id),
             updated_at = NOW()
         RETURNING name, union_id, area_id, counter_channel_id, members, created_at, updated_at`,
        [guildName, unionId, resolvedAreaId, JSON.stringify(buildMemberSnapshotPayload(memberItems))],
    );

    return normalizeUnionRow(result.rows[0]);
}

async function upsertAccountProfileRow(wrapper, {
    intl_open_id,
    basic_info,
    outpost_info,
    daily_progress,
}) {
    const normalizedOpenId = String(intl_open_id || '').trim();

    const result = await wrapper.db.pool.query(
        `UPDATE ${pgConfig.tables.nikke_accounts}
         SET basic_info = $2::jsonb,
             outpost_info = $3::jsonb,
             daily_progress = $4::jsonb,
             profile_fetched_at = NOW(),
             updated_at = NOW()
         WHERE intl_open_id = $1`,
        [
            normalizedOpenId,
            JSON.stringify(basic_info ?? {}),
            JSON.stringify(outpost_info ?? {}),
            JSON.stringify(daily_progress ?? []),
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
        `SELECT intl_open_id, basic_info, outpost_info, daily_progress, profile_fetched_at, updated_at
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
    ]);

    if (values.length === 0) {
        return false;
    }

    const placeholders = values.map((_, index) => {
        const offset = index * 2;
        return `($${offset + 1}, $${offset + 2})`;
    }).join(', ');

    const flattened = values.flat();
    await wrapper.db.pool.query(
        `INSERT INTO ${pgConfig.tables.nikke_accounts} (name, intl_open_id)
         VALUES ${placeholders}
         ON CONFLICT (intl_open_id)
         DO UPDATE SET
             name = EXCLUDED.name,
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
            logger.warn('Database wrapper is not available. Returning empty Nikke accounts list.');
            return [];
        }

        if (isPostgresSqlReady(wrapper)) {
            let result = await wrapper.db.pool.query(
                `SELECT name, intl_open_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
                 FROM ${pgConfig.tables.nikke_accounts}
                 ORDER BY name ASC`,
            );

            const rows = result.rows.map(normalizeAccountRow).filter(Boolean);
            return rows;
        }

        return [];
    } catch (error) {
        logger.error('Error loading Nikke accounts:', error);
        return [];
    }
}

export async function getNikkeAccountChoices(client) {
    const accounts = await getNikkeAccounts(client);
    return accounts.slice(0, MAX_NIKKE_ACCOUNT_COMMAND_CHOICES).map((account) => ({
        name: String(account.name || account.intl_open_id || 'Unknown').slice(0, MAX_NIKKE_CHOICE_NAME_LENGTH),
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
    return unions.slice(0, MAX_NIKKE_UNION_COMMAND_CHOICES).map((union) => ({
        name: (
            union.area_id !== null && union.area_id !== undefined
                ? `${union.name} (Area ${union.area_id})`
                : union.name
        ).slice(0, MAX_NIKKE_CHOICE_NAME_LENGTH),
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
                name: (
                    union.area_id !== null && union.area_id !== undefined
                        ? `${union.name} (Area ${union.area_id})`
                        : union.name
                ).slice(0, MAX_NIKKE_CHOICE_NAME_LENGTH),
                value: numericUnionId,
            };
        })
        .filter(Boolean)
        .slice(0, MAX_NIKKE_UNION_COMMAND_CHOICES);
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
                 JOIN ${pgConfig.tables.nikke_unions} u2 ON u2.union_id = a.basic_info ->> 'gsn'
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

export async function addNikkeAccount(client, { name, intl_open_id, discord_tag = null }) {
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
        const normalizedDiscordTag = discord_tag === null || discord_tag === undefined || discord_tag === ''
            ? null
            : String(discord_tag).trim();

        const result = await wrapper.db.pool.query(
            `INSERT INTO ${pgConfig.tables.nikke_accounts} (name, intl_open_id, discord_tag)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING
             RETURNING name, intl_open_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at`,
            [normalizedName, normalizedOpenId, normalizedDiscordTag],
        );

        if (result.rowCount > 0) {
            return {
                success: true,
                inserted: true,
                account: normalizeAccountRow(result.rows[0]),
            };
        }

        const existingByOpenId = await wrapper.db.pool.query(
            `SELECT name, intl_open_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
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
            `SELECT name, intl_open_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
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

export async function syncNikkeUnionAndMemberAccountsForAccount(client, {
    intl_open_id,
    union_id,
    area_id,
} = {}) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = toNormalizedOpenId(intl_open_id);
        const normalizedUnionId = toNormalizedUnionId(union_id);
        const normalizedAreaId = toNormalizedAreaId(area_id, 84);

        if (!normalizedOpenId) {
            return {
                success: false,
                reason: 'invalid_open_id',
            };
        }

        if (!normalizedUnionId) {
            return {
                success: false,
                reason: 'missing_union_id',
            };
        }

        let unionCreated = false;
        const unionExists = await doesUnionExist(wrapper, normalizedUnionId);

        const guildDetailResponse = await getGuildDetail(normalizedUnionId, normalizedAreaId);
        const guildDetailPayload = await readNikkePayload(guildDetailResponse, 'getGuildDetail');
        const guildDetail = extractGuildDetailPayload(guildDetailPayload);

        if (!guildDetail) {
            return {
                success: false,
                reason: 'invalid_guild_detail_payload',
            };
        }

        const unionAreaId = toNormalizedAreaId(guildDetail.nikke_area_id, normalizedAreaId);

        const guildMembersResponse = await getGuildMembers(normalizedUnionId, unionAreaId);
        const guildMembersPayload = await readNikkePayload(guildMembersResponse, 'getGuildMembers');
        const memberItems = extractGuildMembersPayload(guildMembersPayload);

        if (!unionExists) {
            await upsertUnionFromGuildData(wrapper, {
                unionId: normalizedUnionId,
                areaId: unionAreaId,
                guildDetail,
                memberItems,
            });
            unionCreated = true;
        }

        const memberIds = [...new Set(
            memberItems
                .map((member) => String(member?.member_id || '').trim())
                .filter(Boolean),
        )];

        if (memberIds.length === 0) {
            return {
                success: true,
                union_created: unionCreated,
                union_id: normalizedUnionId,
                area_id: unionAreaId,
                members_total: 0,
                members_added: 0,
                members_synced: 0,
                members_sync_failed: 0,
            };
        }

        const existingResult = await wrapper.db.pool.query(
            `SELECT intl_open_id
             FROM ${pgConfig.tables.nikke_accounts}
             WHERE intl_open_id = ANY($1::varchar[])`,
            [memberIds],
        );

        const existingIds = new Set(existingResult.rows.map((row) => String(row.intl_open_id || '').trim()));
        const missingMembers = memberItems.filter((member) => {
            const memberId = String(member?.member_id || '').trim();
            return memberId && !existingIds.has(memberId);
        });

        let membersAdded = 0;
        let membersSynced = 0;
        let membersSyncFailed = 0;

        for (const member of missingMembers) {
            const memberOpenId = String(member.member_id || '').trim();
            if (!memberOpenId) {
                continue;
            }

            const memberName = await resolveUniqueAccountName(wrapper, member.nickname, memberOpenId);
            const addResult = await addNikkeAccount(client, {
                name: memberName,
                intl_open_id: memberOpenId,
                discord_tag: null,
            });

            if (!addResult.success) {
                continue;
            }

            membersAdded += 1;

            const syncResult = await syncNikkeAccountProfile(client, {
                intl_open_id: memberOpenId,
                union_id: normalizedUnionId,
            });

            if (syncResult.success) {
                membersSynced += 1;
            } else {
                membersSyncFailed += 1;
            }
        }

        return {
            success: true,
            union_created: unionCreated,
            union_id: normalizedUnionId,
            area_id: unionAreaId,
            members_total: memberIds.length,
            members_added: membersAdded,
            members_synced: membersSynced,
            members_sync_failed: membersSyncFailed,
        };
    } catch (error) {
        logger.error('Error syncing Nikke union and member accounts:', error);
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
            snapshot.basic_info?.gsn ?? null,
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

        if (!normalizedUnionId) {
            return {
                success: false,
                reason: 'invalid_union_id',
            };
        }

        const result = await wrapper.db.pool.query(
            `UPDATE ${pgConfig.tables.nikke_accounts}
             SET basic_info = jsonb_set(COALESCE(basic_info, '{}'::jsonb), '{gsn}', to_jsonb($2::text), true),
                 updated_at = NOW()
             WHERE intl_open_id = $1
             RETURNING name, intl_open_id, discord_tag, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at`,
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
             RETURNING name, intl_open_id, discord_tag, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at`,
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
             WHERE basic_info ->> 'gsn' = $1
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
            `SELECT name, intl_open_id, discord_tag, ping_count, basic_info, outpost_info, daily_progress, profile_fetched_at, created_at, updated_at
             FROM ${pgConfig.tables.nikke_accounts}
             WHERE basic_info ->> 'gsn' = $1
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

export async function getNikkeAccountProgressByOpenId(client, intl_open_id) {
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
            `SELECT intl_open_id, data, tracked, fetched_at, created_at, updated_at
             FROM ${pgConfig.tables.nikke_accounts_progress}
             WHERE intl_open_id = $1
             LIMIT 1`,
            [normalizedOpenId],
        );

        if (result.rowCount === 0) {
            return {
                success: false,
                reason: 'not_found',
            };
        }

        return {
            success: true,
            progress: normalizeAccountProgressRow(result.rows[0]),
        };
    } catch (error) {
        logger.error('Error loading Nikke account progress:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function fetchNikkeAccountProgress(client, {
    intl_open_id,
    tracked = true,
    area_id = null,
} = {}) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = String(intl_open_id || '').trim();
        const refreshResult = await getNikkeAccountProfileSection(client, {
            intl_open_id: normalizedOpenId,
            section: 'daily_progress',
            refresh: true,
            area_id,
        });

        if (!refreshResult.success) {
            return {
                success: false,
                reason: refreshResult.reason || 'refresh_failed',
                error: refreshResult.error,
            };
        }

        const data = refreshResult.data ?? {};
        const result = await wrapper.db.pool.query(
            `INSERT INTO ${pgConfig.tables.nikke_accounts_progress} (intl_open_id, data, tracked, fetched_at, updated_at)
             VALUES ($1, $2::jsonb, $3, NOW(), NOW())
             ON CONFLICT (intl_open_id)
             DO UPDATE SET
                data = EXCLUDED.data,
                tracked = EXCLUDED.tracked,
                fetched_at = NOW(),
                updated_at = NOW()
             RETURNING intl_open_id, data, tracked, fetched_at, created_at, updated_at`,
            [normalizedOpenId, JSON.stringify(data), Boolean(tracked)],
        );

        return {
            success: true,
            source: refreshResult.source || 'Live API',
            progress: normalizeAccountProgressRow(result.rows[0]),
        };
    } catch (error) {
        logger.error('Error fetching Nikke account progress:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function addNikkeAccountProgressEntry(client, {
    intl_open_id,
    tracked = true,
    data = {},
} = {}) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = String(intl_open_id || '').trim();
        if (!normalizedOpenId) {
            return {
                success: false,
                reason: 'invalid_open_id',
            };
        }

        const baseData = data && typeof data === 'object' ? data : {};
        const progressData = baseData.progress && typeof baseData.progress === 'object' ? baseData.progress : {};
        const dailyMissions = progressData.daily_missions && typeof progressData.daily_missions === 'object'
            ? progressData.daily_missions
            : {};
        const weeklyMissions = progressData.weekly_missions && typeof progressData.weekly_missions === 'object'
            ? progressData.weekly_missions
            : {};
        const normalizedData = {
            profile: baseData.profile && typeof baseData.profile === 'object' ? baseData.profile : {},
            progress: {
                daily_missions: {
                    receivable_points: dailyMissions.receivable_points ?? null,
                },
                weekly_missions: {
                    receivable_points: weeklyMissions.receivable_points ?? null,
                },
                interception_hits: progressData.interception_hits ?? null,
            },
            currency: {
                gems: baseData?.currency?.gems ?? null,
                golden_mileage: baseData?.currency?.golden_mileage ?? null,
                silver_mileage: baseData?.currency?.silver_mileage ?? null,
                recruit_vouches: baseData?.currency?.recruit_vouches ?? null,
                advanced_recruit_vouches: baseData?.currency?.advanced_recruit_vouches ?? null,
            },
            dolls: baseData.dolls && typeof baseData.dolls === 'object' ? baseData.dolls : {},
            elemental_scores: baseData.elemental_scores && typeof baseData.elemental_scores === 'object' ? baseData.elemental_scores : {},
            raid_damage: baseData.raid_damage && typeof baseData.raid_damage === 'object' ? baseData.raid_damage : {},
        };

        const result = await wrapper.db.pool.query(
            `INSERT INTO ${pgConfig.tables.nikke_accounts_progress} (intl_open_id, data, tracked, fetched_at, updated_at)
             VALUES ($1, $2::jsonb, $3, NOW(), NOW())
             ON CONFLICT (intl_open_id)
             DO UPDATE SET
                data = EXCLUDED.data,
                tracked = EXCLUDED.tracked,
                updated_at = NOW()
             RETURNING intl_open_id, data, tracked, fetched_at, created_at, updated_at`,
            [normalizedOpenId, JSON.stringify(normalizedData), Boolean(tracked)],
        );

        return {
            success: true,
            progress: normalizeAccountProgressRow(result.rows[0]),
            action: result.rowCount > 0 ? 'upserted' : 'unknown',
        };
    } catch (error) {
        logger.error('Error adding Nikke account progress entry:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export async function removeNikkeAccountProgressEntry(client, intl_open_id) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
            };
        }

        const normalizedOpenId = String(intl_open_id || '').trim();
        if (!normalizedOpenId) {
            return {
                success: false,
                reason: 'invalid_open_id',
            };
        }

        const result = await wrapper.db.pool.query(
            `DELETE FROM ${pgConfig.tables.nikke_accounts_progress}
             WHERE intl_open_id = $1
             RETURNING intl_open_id, data, tracked, fetched_at, created_at, updated_at`,
            [normalizedOpenId],
        );

        if (result.rowCount === 0) {
            return {
                success: false,
                reason: 'not_found',
            };
        }

        return {
            success: true,
            progress: normalizeAccountProgressRow(result.rows[0]),
        };
    } catch (error) {
        logger.error('Error removing Nikke account progress entry:', error);
        return {
            success: false,
            reason: 'error',
            error,
        };
    }
}

export { DEFAULT_NIKKE_ACCOUNTS };