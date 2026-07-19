import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { resolveSslConfig, pgConfig } = await import('../src/config/database/postgres.js');
const { quoteIdentifier } = await import('../src/utils/sqlIdentifiers.js');

const { Pool } = pg;

const confirmationFlag = '--yes';
const hasConfirmation = process.argv.includes(confirmationFlag);

if (!hasConfirmation) {
    logger.error('Refusing to reset database without explicit confirmation.');
    logger.error(`Re-run with: node scripts/reset-db.js ${confirmationFlag}`);
    process.exit(1);
}

const migrationTable = process.env.POSTGRES_MIGRATION_TABLE || 'schema_migrations';
const migrationTablePattern = /^[a-z_][a-z0-9_]*$/;

if (!migrationTablePattern.test(migrationTable)) {
    throw new Error(`Invalid migration table name: ${migrationTable}`);
}

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: resolveSslConfig(),
});

const resetDatabase = async () => {
    const client = await pool.connect();

    try {
        const tables = [...new Set([...Object.values(pgConfig.tables), migrationTable])];

        logger.warn('Dropping all configured PostgreSQL tables (CASCADE)...');

        await client.query('BEGIN');

        for (const tableName of tables) {
            const safeTable = quoteIdentifier(tableName);
            await client.query(`DROP TABLE IF EXISTS ${safeTable} CASCADE`);
        }

        // Cleanup shared trigger function used by schema setup.
        await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');

        await client.query('COMMIT');
        logger.info(`Database reset complete. Dropped ${tables.length} tables.`);
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Database reset failed:', error);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
};

resetDatabase();
