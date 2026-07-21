/**
 * Key migration is intentionally disabled in the pruned Core/Nikke runtime.
 */
export const KEY_MIGRATION_VERSION = 1;

export async function runKeyMigration() {
    return {
        migrated: 0,
        skipped: 0,
        errors: 0,
        alreadyDone: true,
    };
}
