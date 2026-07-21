import { canonicalizeKey } from './keys.js';

const TEMP_BACKED_TYPES = new Set(['temp', 'nikke_accounts', 'nikke_unions', 'nikke_account_progress', 'nikke_user_character_cache']);

export function isTempBackedType(type) {
    return TEMP_BACKED_TYPES.has(type);
}

/**
 * Parse a storage key into routing metadata for the database layer.
 * Remaining unknown keys are treated as temp-backed cache_data entries.
 */
export function parseKey(key) {
    const fullKey = canonicalizeKey(key);

    if (fullKey.startsWith('temp:')) {
        return { type: 'temp', fullKey };
    }

    const parts = fullKey.split(':');

    if (parts[0] === 'guild' && parts[2] === 'config') {
        return { type: 'guild_config', guildId: parts[1], fullKey };
    }

    if (parts[0] === 'nikke') {
        if (parts[1] === 'accounts' && !parts[2]) {
            return { type: 'nikke_accounts', fullKey };
        }

        if (parts[1] === 'unions' && !parts[2]) {
            return { type: 'nikke_unions', fullKey };
        }

        if (parts[1] === 'account-progress' && parts[2]) {
            return { type: 'nikke_account_progress', intlOpenId: parts[2], fullKey };
        }

        if (parts[1] === 'user-character' && parts[2] && parts[3]) {
            return {
                type: 'nikke_user_character_cache',
                intlOpenId: parts[2],
                nameCode: parts[3],
                fullKey,
            };
        }
    }

    return { type: 'temp', fullKey };
}

/**
 * Build PostgreSQL list queries for structured tables based on a key prefix.
 * Current Core/Nikke flow does not rely on structured list plans.
 */
export function getStructuredListPlan() {
    return { queries: [], staticKeys: [] };
}
