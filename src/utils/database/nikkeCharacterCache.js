import { pgConfig } from '../../config/database/postgres.js';
import { logger } from '../logger.js';

function getFallbackKey(intlOpenId, nameCode) {
    return `nikke:user-character:${intlOpenId}:${nameCode}`;
}

function isPostgresSqlReady(wrapper) {
    return Boolean(
        wrapper?.db?.pool &&
        typeof wrapper.db.isAvailable === 'function' &&
        wrapper.db.isAvailable(),
    );
}

function normalizeCacheRow(row) {
    if (!row) {
        return null;
    }

    if (row.data !== undefined) {
        return row;
    }

    return {
        intl_open_id: row.intl_open_id ?? null,
        name_code: row.name_code ?? null,
        data: row,
        fetched_at: row.fetched_at ?? null,
        updated_at: row.updated_at ?? null,
    };
}

export async function getUserCharacterCache(client, intlOpenId, nameCode) {
    try {
        const wrapper = client?.db;
        if (!wrapper || typeof wrapper.get !== 'function') {
            return null;
        }

        if (isPostgresSqlReady(wrapper)) {
            const result = await wrapper.db.pool.query(
                `SELECT intl_open_id, name_code, data, fetched_at, updated_at
                 FROM ${pgConfig.tables.nikke_user_character_cache}
                 WHERE intl_open_id = $1 AND name_code = $2
                 LIMIT 1`,
                [String(intlOpenId), Number(nameCode)],
            );

            return result.rows.length > 0 ? result.rows[0] : null;
        }

        return normalizeCacheRow(await wrapper.get(getFallbackKey(intlOpenId, nameCode), null));
    } catch (error) {
        logger.error(`Error reading Nikke user character cache for ${intlOpenId}/${nameCode}:`, error);
        return null;
    }
}

export async function upsertUserCharacterCache(client, intlOpenId, nameCode, data) {
    try {
        const wrapper = client?.db;
        if (!wrapper || typeof wrapper.set !== 'function') {
            return false;
        }

        const normalizedIntlOpenId = String(intlOpenId);
        const normalizedNameCode = Number(nameCode);

        if (isPostgresSqlReady(wrapper)) {
            await wrapper.db.pool.query(
                `INSERT INTO ${pgConfig.tables.nikke_user_character_cache} (intl_open_id, name_code, data, fetched_at, updated_at)
                 VALUES ($1, $2, $3, NOW(), NOW())
                 ON CONFLICT (intl_open_id, name_code)
                 DO UPDATE SET
                     data = EXCLUDED.data,
                     fetched_at = NOW()`,
                [normalizedIntlOpenId, normalizedNameCode, data],
            );
            return true;
        }

        const fallbackKey = getFallbackKey(normalizedIntlOpenId, normalizedNameCode);
        const existing = normalizeCacheRow(await wrapper.get(fallbackKey, null));

        await wrapper.set(fallbackKey, {
            intl_open_id: normalizedIntlOpenId,
            name_code: normalizedNameCode,
            data,
            fetched_at: new Date().toISOString(),
            updated_at: existing?.updated_at || new Date().toISOString(),
        });
        return true;
    } catch (error) {
        logger.error(`Error writing Nikke user character cache for ${intlOpenId}/${nameCode}:`, error);
        return false;
    }
}