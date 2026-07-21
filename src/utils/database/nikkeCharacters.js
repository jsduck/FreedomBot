import { pgConfig } from '../../config/database/postgres.js';
import { logger } from '../logger.js';

function isPostgresSqlReady(wrapper) {
    return Boolean(
        wrapper?.db?.pool &&
        typeof wrapper.db.isAvailable === 'function' &&
        wrapper.db.isAvailable(),
    );
}

function normalizeCharacterRow(row) {
    if (!row) {
        return null;
    }

    const nameCode = Number.parseInt(String(row.name_code), 10);
    const id = Number.parseInt(String(row.id), 10);

    if (!Number.isInteger(nameCode) || !Number.isInteger(id)) {
        return null;
    }

    return {
        name_code: nameCode,
        id,
        name: String(row.name || '').trim(),
        thumbnail: row.thumbnail || null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    };
}

export async function getNikkeCharacters(client) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return [];
        }

        const result = await wrapper.db.pool.query(
            `SELECT name_code, id, name, thumbnail, created_at, updated_at
             FROM ${pgConfig.tables.nikke_characters}
             ORDER BY name ASC`,
        );

        return result.rows.map(normalizeCharacterRow).filter(Boolean);
    } catch (error) {
        logger.error('Error loading Nikke characters:', error);
        return [];
    }
}

export async function insertMissingNikkeCharacterNameCodes(client, nameCodes) {
    try {
        const wrapper = client?.db;

        if (!isPostgresSqlReady(wrapper)) {
            return {
                success: false,
                reason: 'database_unavailable',
                requested: 0,
                inserted: 0,
            };
        }

        const normalizedNameCodes = [...new Set(
            (Array.isArray(nameCodes) ? nameCodes : [])
                .map((value) => Number.parseInt(String(value), 10))
                .filter((value) => Number.isInteger(value)),
        )];

        if (normalizedNameCodes.length === 0) {
            return {
                success: true,
                requested: 0,
                inserted: 0,
            };
        }

        const result = await wrapper.db.pool.query(
            `INSERT INTO ${pgConfig.tables.nikke_characters} (name_code, id, name)
             SELECT code, 0, CONCAT('Unknown #', code::text)
             FROM UNNEST($1::int[]) AS incoming(code)
             ON CONFLICT (name_code)
             DO NOTHING`,
            [normalizedNameCodes],
        );

        return {
            success: true,
            requested: normalizedNameCodes.length,
            inserted: result.rowCount || 0,
        };
    } catch (error) {
        logger.error('Error inserting missing Nikke character name codes:', error);
        return {
            success: false,
            reason: 'error',
            requested: 0,
            inserted: 0,
            error,
        };
    }
}
