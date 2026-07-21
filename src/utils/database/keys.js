/**
 * Canonical database key registry.
 * All storage keys should be built through these helpers.
 */

export const getGuildConfigKey = (guildId) => `guild:${guildId}:config`;
export const getNikkeAccountsKey = () => 'nikke:accounts';
export const getNikkeUnionsKey = () => 'nikke:unions';
export const getNikkeAccountProgressKey = (intlOpenId) => `nikke:account-progress:${intlOpenId}`;
export const getNikkeUserCharacterCacheKey = (intlOpenId, nameCode) => `nikke:user-character:${intlOpenId}:${nameCode}`;

export function canonicalizeKey(key) {
    return key;
}

export function getLegacyVariantsForCanonical(canonicalKey) {
    return [];
}
