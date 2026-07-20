/**
 * Single source of truth for the PostgreSQL schema.
 *
 * Both the runtime auto-create path (src/utils/postgresDatabase.js) and the
 * standalone migration script (scripts/migrate.js) build the database from these
 * definitions, so the schema can never diverge between them.
 */

import { pgConfig } from '../../config/database/postgres.js';

const t = pgConfig.tables;

export const tableStatements = [
    `CREATE TABLE IF NOT EXISTS ${t.guilds} (
        id VARCHAR(20) PRIMARY KEY,
        config JSONB DEFAULT '{}',
        counters JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS ${t.guild_users} (
        guild_id VARCHAR(20),
        user_id VARCHAR(20),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id),
        FOREIGN KEY (guild_id) REFERENCES ${t.guilds}(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS ${t.nikke_accounts} (
        intl_open_id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        discord_tag VARCHAR(64),
        ping_count INTEGER DEFAULT 0,
        basic_info JSONB,
        outpost_info JSONB,
        daily_progress JSONB,
        profile_fetched_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `ALTER TABLE ${t.nikke_accounts} ADD COLUMN IF NOT EXISTS discord_tag VARCHAR(64)`,
    `ALTER TABLE ${t.nikke_accounts} ADD COLUMN IF NOT EXISTS ping_count INTEGER DEFAULT 0`,
    `ALTER TABLE ${t.nikke_accounts} ADD COLUMN IF NOT EXISTS basic_info JSONB`,
    `ALTER TABLE ${t.nikke_accounts} ADD COLUMN IF NOT EXISTS outpost_info JSONB`,
    `ALTER TABLE ${t.nikke_accounts} ADD COLUMN IF NOT EXISTS daily_progress JSONB`,
    `ALTER TABLE ${t.nikke_accounts} ADD COLUMN IF NOT EXISTS profile_fetched_at TIMESTAMP`,
    `ALTER TABLE ${t.nikke_accounts} DROP COLUMN IF EXISTS union_id`,

    `CREATE TABLE IF NOT EXISTS ${t.nikke_accounts_progress} (
        intl_open_id VARCHAR(20) PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}',
        tracked BOOLEAN NOT NULL DEFAULT FALSE,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (intl_open_id) REFERENCES ${t.nikke_accounts}(intl_open_id) ON DELETE CASCADE
    )`,

    `DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = '${t.nikke_accounts_progress}'
              AND column_name = 'tracked'
              AND data_type <> 'boolean'
        ) THEN
            ALTER TABLE ${t.nikke_accounts_progress}
            ALTER COLUMN tracked DROP DEFAULT;

            ALTER TABLE ${t.nikke_accounts_progress}
            ALTER COLUMN tracked TYPE BOOLEAN
            USING CASE
                WHEN tracked IS NULL THEN FALSE
                WHEN LOWER(TRIM(BOTH '"' FROM tracked::text)) IN ('true', 't', '1', 'yes', 'y') THEN TRUE
                ELSE FALSE
            END;

            ALTER TABLE ${t.nikke_accounts_progress}
            ALTER COLUMN tracked SET DEFAULT FALSE;
        END IF;
    END
    $$`,

    `CREATE TABLE IF NOT EXISTS ${t.nikke_unions} (
        union_id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        area_id INTEGER,
        counter_channel_id VARCHAR(20),
        members JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `ALTER TABLE ${t.nikke_unions} ADD COLUMN IF NOT EXISTS counter_channel_id VARCHAR(20)`,
    `ALTER TABLE ${t.nikke_unions} ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'`,
        `UPDATE ${t.nikke_unions}
         SET counter_channel_id = members ->> 'counter_channel_id'
         WHERE counter_channel_id IS NULL
             AND jsonb_typeof(members) = 'object'
             AND members ? 'counter_channel_id'`,

    `CREATE TABLE IF NOT EXISTS ${t.nikke_user_character_cache} (
        intl_open_id VARCHAR(20) NOT NULL,
        name_code INTEGER NOT NULL,
        data JSONB NOT NULL,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (intl_open_id, name_code)
    )`,

    `CREATE TABLE IF NOT EXISTS ${t.cache_data} (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

];

export const indexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_guild_users_guild_id ON ${t.guild_users}(guild_id)`,
    `CREATE INDEX IF NOT EXISTS idx_guild_users_user_id ON ${t.guild_users}(user_id)`,
];

export const UPDATE_TIMESTAMP_FUNCTION = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
`;

/**
 * Tables that carry an updated_at column maintained by the shared trigger.
 * `name` is the trigger identifier, `table` is the concrete table name.
 */
export const triggerDefinitions = [
    { name: 'update_guilds_updated_at', table: t.guilds },
    { name: 'update_guild_users_updated_at', table: t.guild_users },
    { name: 'update_nikke_accounts_updated_at', table: t.nikke_accounts },
    { name: 'update_nikke_accounts_progress_updated_at', table: t.nikke_accounts_progress },
    { name: 'update_nikke_unions_updated_at', table: t.nikke_unions },
];
