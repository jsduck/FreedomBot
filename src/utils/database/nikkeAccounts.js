import { pgConfig } from '../../config/database/postgres.js';
import { logger } from '../logger.js';

const DEFAULT_NIKKE_ACCOUNTS = Object.freeze([
    { name: 'Kaarako', intl_open_id: '3166452414820481224', union_id: null },
    { name: 'Demi', intl_open_id: '16338490109246680481', union_id: null },
    { name: 'Shaito', intl_open_id: '12167197956671690221', union_id: null },
    { name: 'Fizix', intl_open_id: '5877343215992272387', union_id: null },
    { name: 'Jae', intl_open_id: '15097183441877165889', union_id: null },
    { name: 'Effelon', intl_open_id: '16262646283866114091', union_id: null },
    { name: 'Fesha', intl_open_id: '12816795455667592937', union_id: null },
    { name: 'Nelex', intl_open_id: '1175532717634698043', union_id: null },
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
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
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

export async function getNikkeAccounts(client, { seedDefaults = true } = {}) {
    try {
        const wrapper = client?.db;

        if (!wrapper) {
            return DEFAULT_NIKKE_ACCOUNTS;
        }

        if (isPostgresSqlReady(wrapper)) {
            let result = await wrapper.db.pool.query(
                `SELECT name, intl_open_id, union_id, created_at, updated_at
                 FROM ${pgConfig.tables.nikke_accounts}
                 ORDER BY name ASC`,
            );

            if (result.rows.length === 0 && seedDefaults) {
                await seedDefaultAccounts(wrapper);
                result = await wrapper.db.pool.query(
                    `SELECT name, intl_open_id, union_id, created_at, updated_at
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
            const result = await wrapper.db.pool.query(
                `SELECT name, union_id, area_id, created_at, updated_at
                 FROM ${pgConfig.tables.nikke_unions}
                 ORDER BY name ASC`,
            );

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

export async function getNikkeAccountByOpenId(client, intlOpenId) {
    const accounts = await getNikkeAccounts(client, { seedDefaults: false });
    return accounts.find((account) => String(account.intl_open_id) === String(intlOpenId)) || null;
}

export async function getNikkeAccountByName(client, name) {
    const accounts = await getNikkeAccounts(client, { seedDefaults: false });
    return accounts.find((account) => String(account.name).toLowerCase() === String(name).toLowerCase()) || null;
}

export async function addNikkeAccount(client, { name, intl_open_id, union_id = null }) {
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

        const result = await wrapper.db.pool.query(
            `INSERT INTO ${pgConfig.tables.nikke_accounts} (name, intl_open_id, union_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING
             RETURNING name, intl_open_id, union_id, created_at, updated_at`,
            [normalizedName, normalizedOpenId, normalizedUnionId],
        );

        if (result.rowCount > 0) {
            return {
                success: true,
                inserted: true,
                account: normalizeAccountRow(result.rows[0]),
            };
        }

        const existingByOpenId = await wrapper.db.pool.query(
            `SELECT name, intl_open_id, union_id, created_at, updated_at
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
            `SELECT name, intl_open_id, union_id, created_at, updated_at
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
             RETURNING name, intl_open_id, union_id, created_at, updated_at`,
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
             RETURNING name, intl_open_id, union_id, created_at, updated_at`,
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

export { DEFAULT_NIKKE_ACCOUNTS };