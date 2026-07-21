import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';
import { NIKKE_UNITS, getCharacterByName } from '../src/services/nikke.js';
import { pgConfig, resolveSslConfig } from '../src/config/database/postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

function slug(value) {
    return String(value)
        .toLowerCase()
        .replace(/[:]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

function buildDotGgThumbnail(img) {
    return `https://static.dotgg.gg/nikke/characters/${img}.webp`;
}

function normalizeUnits(units) {
    const dedupedByNameCode = new Map();

    for (const unit of units) {
        const id = Number.parseInt(String(unit?.id), 10);
        const nameCode = Number.parseInt(String(unit?.name_code), 10);
        const name = String(unit?.name || '').trim();

        if (!Number.isInteger(id) || !Number.isInteger(nameCode) || !name) {
            continue;
        }

        dedupedByNameCode.set(nameCode, {
            id,
            name_code: nameCode,
            name,
            thumbnail: unit?.thumbnail || null,
        });
    }

    return [...dedupedByNameCode.values()];
}

async function resolveThumbnailForUnit(unit) {
    if (unit.thumbnail) {
        return unit.thumbnail;
    }

    try {
        const response = await getCharacterByName(slug(unit.name));
        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        const img = payload?.img;
        return img ? buildDotGgThumbnail(img) : null;
    } catch (error) {
        logger.warn(`Failed to resolve thumbnail for ${unit.name}: ${error.message}`);
        return null;
    }
}

async function enrichUnitsWithThumbnails(units) {
    return Promise.all(
        units.map(async (unit) => ({
            ...unit,
            thumbnail: await resolveThumbnailForUnit(unit),
        })),
    );
}

async function run() {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('Missing POSTGRES_URL (or DATABASE_URL) in environment.');
    }

    const pool = new Pool({
        connectionString,
        ssl: resolveSslConfig(),
    });

    const normalizedRows = normalizeUnits(NIKKE_UNITS);
    const rows = await enrichUnitsWithThumbnails(normalizedRows);
    if (rows.length === 0) {
        throw new Error('No valid Nikke units found to seed.');
    }

    const ids = rows.map((row) => row.id);
    const nameCodes = rows.map((row) => row.name_code);
    const names = rows.map((row) => row.name);
    const thumbnails = rows.map((row) => row.thumbnail);

    const table = pgConfig.tables.nikke_characters;
    const truncate = process.argv.includes('--truncate');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (truncate) {
            await client.query(`TRUNCATE TABLE ${table}`);
        }

        const upsertResult = await client.query(
            `INSERT INTO ${table} (id, name_code, name, thumbnail)
             SELECT seeded.id, seeded.name_code, seeded.name, seeded.thumbnail
             FROM UNNEST($1::int[], $2::int[], $3::text[], $4::text[]) AS seeded(id, name_code, name, thumbnail)
             ON CONFLICT (name_code)
             DO UPDATE SET
                 id = EXCLUDED.id,
                 name = EXCLUDED.name,
                 thumbnail = EXCLUDED.thumbnail,
                 updated_at = CURRENT_TIMESTAMP`,
            [ids, nameCodes, names, thumbnails],
        );

        await client.query('COMMIT');

        logger.info('Nikke characters seed completed', {
            event: 'nikke_characters.seed.completed',
            table,
            sourceCount: rows.length,
            thumbnailsResolved: rows.filter((row) => Boolean(row.thumbnail)).length,
            affectedRows: upsertResult.rowCount,
            truncated: truncate,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((error) => {
    logger.error('Failed to seed nikke_characters table', {
        event: 'nikke_characters.seed.failed',
        error: error.message,
    });
    process.exit(1);
});
