// database.js - minimal facade for current Core/Nikke runtime

export {
    db,
    initializeDatabase,
    getFromDb,
    setInDb,
    deleteFromDb,
} from './database/wrapper.js';

export {
    getNikkeAccounts,
    getNikkeAccountChoices,
    getNikkeUnions,
    getEnabledNikkeUnionCounters,
    getNikkeUnionById,
    getNikkeUnionChoices,
    getNikkeUnionGuildChoices,
    getNikkeAreaChoices,
    getNikkeAccountsByUnionId,
    getNikkeAccountByOpenId,
    addNikkeAccount,
    incrementNikkeAccountPingCount,
    syncNikkeAccountProfile,
    syncNikkeUnionAndMemberAccountsForAccount,
    getNikkeAccountProfileSection,
    getNikkeAccountProgressByOpenId,
    fetchNikkeAccountProgress,
    addNikkeAccountProgressEntry,
    removeNikkeAccountProgressEntry,
    setNikkeUnionCounterEnabled,
    setNikkeUnionCounterChannel,
    setNikkeUnionCounterDisabled,
    updateNikkeAccountUnionId,
    deleteNikkeAccount,
    DEFAULT_NIKKE_ACCOUNTS,
} from './database/nikkeAccounts.js';

export {
    getUserCharacterCache,
    upsertUserCharacterCache,
} from './database/nikkeCharacterCache.js';

export {
    getNikkeCharacters,
    insertMissingNikkeCharacterNameCodes,
} from './database/nikkeCharacters.js';
