import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getMyGuildInfo, getUserGameInfo, searchUser, getUserProfile, getUserCharacters, safeJSON } from '../../../services/nikke.js';
import { getNikkeAccountByOpenId, getNikkeAccountProfileSection, getNikkeUnionById } from '../../../utils/database.js';

export const USER_PROFILE_BASIC_INFO_UPDATE_BUTTON_ID = 'nikke_user_profile_basic_info_update';
export const USER_PROFILE_OUTPOST_INFO_UPDATE_BUTTON_ID = 'nikke_user_profile_outpost_info_update';
export const USER_DAILY_CONTENTS_PROGRESS_UPDATE_BUTTON_ID = 'nikke_user_daily_contents_progress_update';
export const ACCOUNT_PROFILE_BACK_BUTTON_ID = 'nikke_account_profile_back';
export const ACCOUNT_PROFILE_FORWARD_BUTTON_ID = 'nikke_account_profile_forward';
export const ACCOUNT_PROFILE_UPDATE_BUTTON_ID = 'nikke_account_profile_update';

const ACCOUNT_PROFILE_SECTIONS = Object.freeze([
    {
        key: 'basic_info',
        endpoint: 'getUserProfileBasicInfo',
        label: 'Basic Info',
    },
    {
        key: 'outpost_info',
        endpoint: 'getUserProfileOutpostInfo',
        label: 'Outpost Info',
    },
    {
        key: 'daily_progress',
        endpoint: 'getUserDailyContentsProgress',
        label: 'Daily Contents Progress',
    },
]);

function summarizeSectionData(data) {
    if (Array.isArray(data)) {
        return `${data.length} entries`;
    }

    if (data && typeof data === 'object') {
        const keys = Object.keys(data);
        return `${keys.length} keys`;
    }

    return 'no structured data';
}

const CURRENCY_TYPE_LABELS = Object.freeze({
    98: 'Gems',
    99: 'Free Gems',
    1000: 'Battle Data',
    2000: 'Credits',
    3000: 'Core Dust',
    5100: 'Recruit Voucher',
    5200: 'Advanced Recruit Voucher',
    11000: 'Silver Mileage Ticket',
    12000: 'Gold Mileage Ticket',
});

const CURRENCY_DISPLAY_ORDER = Object.freeze([
    98,
    99,
    1000,
    2000,
    3000,
    5100,
    5200,
    11000,
    12000,
]);

function formatCurrencyValue(value) {
    const numeric = typeof value === 'number'
        ? value
        : Number.parseFloat(String(value).replace(/,/g, ''));

    if (!Number.isFinite(numeric)) {
        return String(value ?? 'Unknown');
    }

    return new Intl.NumberFormat('en-US').format(numeric);
}

function parseCurrencyNumericValue(value) {
    const numeric = typeof value === 'number'
        ? value
        : Number.parseFloat(String(value).replace(/,/g, ''));

    return Number.isFinite(numeric) ? numeric : null;
}

function mergeGemCurrencies(entries) {
    let gemTotal = 0;
    let hasGem = false;
    const merged = [];

    for (const entry of entries) {
        const type = Number.parseInt(String(entry.type), 10);

        if (type === 98 || type === 99) {
            const numericValue = parseCurrencyNumericValue(entry.value);
            if (numericValue !== null) {
                gemTotal += numericValue;
                hasGem = true;
                continue;
            }
        }

        merged.push(entry);
    }

    if (hasGem) {
        merged.push({ type: 98, value: gemTotal });
    }

    return merged;
}

function getCurrencyLabel(type) {
    const normalizedType = Number.parseInt(String(type), 10);
    if (Number.isInteger(normalizedType) && CURRENCY_TYPE_LABELS[normalizedType]) {
        return CURRENCY_TYPE_LABELS[normalizedType];
    }

    return `Type ${type}`;
}

function sortCurrencyEntries(entries) {
    return [...entries].sort((a, b) => {
        const typeA = Number.parseInt(String(a.type), 10);
        const typeB = Number.parseInt(String(b.type), 10);
        const orderA = CURRENCY_DISPLAY_ORDER.indexOf(typeA);
        const orderB = CURRENCY_DISPLAY_ORDER.indexOf(typeB);

        if (orderA !== -1 || orderB !== -1) {
            if (orderA === -1) {
                return 1;
            }
            if (orderB === -1) {
                return -1;
            }
            return orderA - orderB;
        }

        return typeA - typeB;
    });
}

function formatCurrencies(currencies) {
    if (!currencies) {
        return 'Unknown';
    }

    if (Array.isArray(currencies)) {
        if (currencies.length === 0) {
            return 'Unknown';
        }

        const normalizedEntries = currencies.map((entry, index) => ({
            type: entry?.type ?? index,
            value: entry?.value ?? 'Unknown',
        }));

        const displayEntries = mergeGemCurrencies(normalizedEntries);

        return sortCurrencyEntries(displayEntries).map((entry) => {
            const label = getCurrencyLabel(entry.type);
            const value = formatCurrencyValue(entry.value);
            return `${label}: **${value}**`;
        }).join('\n');
    }

    if (typeof currencies === 'object') {
        const entries = Object.entries(currencies);
        if (entries.length === 0) {
            return 'Unknown';
        }

        const normalizedEntries = entries.map(([key, value]) => ({
            type: key,
            value,
        }));

        const displayEntries = mergeGemCurrencies(normalizedEntries);

        return sortCurrencyEntries(displayEntries).map((entry) => {
            const label = getCurrencyLabel(entry.type);
            const value = formatCurrencyValue(entry.value);
            return `${label}: **${value}**`;
        }).join('\n');
    }

    return String(currencies);
}

function formatProfileDate(value) {
    if (value === null || value === undefined || value === '') {
        return 'Unknown';
    }

    let date;
    if (typeof value === 'number') {
        date = new Date(value < 1e12 ? value * 1000 : value);
    } else if (typeof value === 'string' && /^\d+$/.test(value)) {
        const parsed = Number.parseInt(value, 10);
        date = new Date(parsed < 1e12 ? parsed * 1000 : parsed);
    } else {
        date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toISOString().slice(0, 10);
}

function formatCampaignProgress(value) {
    if (value === null || value === undefined || value === '') {
        return 'Unknown';
    }

    const raw = String(value).trim();
    if (!/^\d+$/.test(raw) || raw.length < 7) {
        return raw;
    }

    // API value format example: 6046044 -> 46-40, 7046043 -> 46-39
    const chapter = Number.parseInt(raw.slice(1, 4), 10);
    const stageRaw = Number.parseInt(raw.slice(4), 10);

    if (!Number.isInteger(chapter) || !Number.isInteger(stageRaw)) {
        return raw;
    }

    const stage = stageRaw - 4;
    if (stage <= 0) {
        return raw;
    }

    return `${chapter}-${String(stage).padStart(2, '0')}`;
}

function formatRecycleRoomResearches(researches) {
    if (!Array.isArray(researches) || researches.length === 0) {
        return [];
    }

    return researches
        .filter((entry) => entry && (entry.tid !== undefined || entry.lv !== undefined))
        .sort((a, b) => {
            const tidA = Number.parseInt(String(a?.tid ?? 0), 10);
            const tidB = Number.parseInt(String(b?.tid ?? 0), 10);
            return tidA - tidB;
        })
        .map((entry) => {
            const tid = entry?.tid ?? 'Unknown';
            const level = entry?.lv ?? 'Unknown';
            return `Recycle ${tid}: **Lv ${level}**`;
        });
}

function formatSimpleValue(value) {
    if (value === null || value === undefined || value === '') {
        return 'Unknown';
    }

    if (typeof value === 'number') {
        return new Intl.NumberFormat('en-US').format(value);
    }

    return String(value);
}

function formatPercent(value) {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(numeric)) {
        return formatSimpleValue(value);
    }

    return `${(numeric * 100).toFixed(2)}%`;
}

function formatRewardList(rewards) {
    if (!Array.isArray(rewards) || rewards.length === 0) {
        return 'None';
    }

    return rewards.join(', ');
}

function parseProgressNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const numeric = Number.parseFloat(value.replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? numeric : null;
    }

    return null;
}

const DAILY_PROGRESS_THRESHOLD_RULES = Object.freeze([
    { key: 'counsel_remaining_count', source: 'number', operator: 'eq', value: 0 },
    { key: 'daily_mission_receivable_points', source: 'number', operator: 'eq', value: 0 },
    { key: 'daily_mission_received_points', source: 'number', operator: 'gte', value: 100 },
    { key: 'daily_mission_received_rewards', source: 'length', operator: 'gte', value: 20 },
    { key: 'intercept_remaining_tickets', source: 'number', operator: 'eq', value: 0 },
    { key: 'outpost_battle_storage_excess', source: 'number', operator: 'eq', value: 0 },
    { key: 'outpost_battle_storage_fullness', source: 'percent', operator: 'lt', value: 90 },
    { key: 'rookie_arena_remaining_count', source: 'number', operator: 'eq', value: 0 },
    { key: 'special_arena_remaining_count', source: 'number', operator: 'eq', value: 0 },
    { key: 'weekly_mission_receivable_points', source: 'number', operator: 'eq', value: 0 },
    { key: 'weekly_mission_received_points', source: 'number', operator: 'gte', value: 100 },
    { key: 'weekly_mission_received_rewards', source: 'length', operator: 'gte', value: 20 },
]);

function getDailyProgressThresholdRule(key) {
    return DAILY_PROGRESS_THRESHOLD_RULES.find((rule) => rule.key === key) ?? null;
}

function evaluateDailyProgressThreshold(key, rawValue) {
    const rule = getDailyProgressThresholdRule(key);
    if (!rule) {
        return false;
    }

    let comparable = null;

    const isRewardThresholdKey = key === 'daily_mission_received_rewards'
        || key === 'weekly_mission_received_rewards';

    if (isRewardThresholdKey) {
        if (Array.isArray(rawValue)) {
            if (rawValue.length === 1) {
                const singleValue = parseProgressNumber(rawValue[0]);
                comparable = singleValue !== null ? singleValue : rawValue.length;
            } else {
                comparable = rawValue.length;
            }
        } else {
            comparable = parseProgressNumber(rawValue);
        }
    } else if (rule.source === 'length') {
        comparable = Array.isArray(rawValue) ? rawValue.length : parseProgressNumber(rawValue);
    } else if (rule.source === 'percent') {
        const numeric = parseProgressNumber(rawValue);
        comparable = numeric === null
            ? null
            : (numeric <= 1 ? numeric * 100 : numeric);
    } else {
        comparable = parseProgressNumber(rawValue);
    }

    if (comparable === null) {
        return false;
    }

    if (rule.operator === 'eq') {
        return comparable === rule.value;
    }

    if (rule.operator === 'gt') {
        return comparable > rule.value;
    }

    if (rule.operator === 'gte') {
        return comparable >= rule.value;
    }

    if (rule.operator === 'lt') {
        return comparable < rule.value;
    }

    return false;
}

function statusEmoji(isDone) {
    return isDone ? '✅' : '❌';
}

function isSimRoomBestDone(record) {
    const chapter = parseProgressNumber(record?.chapter);
    const difficulty = parseProgressNumber(record?.difficulty);
    return chapter === 3 && difficulty === 5;
}

function isTowerDailyDone(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return false;
    }

    const openedTowers = list.filter((entry) => entry?.is_opened);
    if (openedTowers.length === 0) {
        return false;
    }

    return openedTowers.every((entry) => {
        const remaining = parseProgressNumber(entry?.remaining_count);
        return remaining === 0;
    });
}

function formatTowerDailyInfoList(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return 'None';
    }

    const openTowers = list
        .slice()
        .sort((a, b) => Number(a?.type ?? 0) - Number(b?.type ?? 0))
        .filter((entry) => entry?.is_opened)
        .map((entry) => {
            const towerType = entry?.type ?? '?';
            const remaining = formatSimpleValue(entry?.remaining_count);
            return `\n- Tower ${towerType}: Remaining **${remaining}**`;
        });

    if (openTowers.length === 0) {
        return 'None';
    }

    return openTowers.join('\n');
}

function formatTowerDailyInline(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return 'None';
    }

    const openTowers = list
        .slice()
        .sort((a, b) => Number(a?.type ?? 0) - Number(b?.type ?? 0))
        .filter((entry) => entry?.is_opened)
        .map((entry) => {
            const towerType = entry?.type ?? '?';
            const remaining = formatSimpleValue(entry?.remaining_count);
            return `Tower ${towerType}: Remaining ${remaining}`;
        });

    if (openTowers.length === 0) {
        return 'None';
    }

    return openTowers.join(', ');
}

async function buildAccountProfileEmbedPreset(client, intlOpenId, sectionKey, data, sectionLabel) {
    const account = await getNikkeAccountByOpenId(client, intlOpenId);
    const accountName = account?.name || data?.nickname || 'Unknown';
    const resolvedUnionId = account?.union_id ?? data?.gsn ?? null;
    const resolvedUnion = resolvedUnionId ? await getNikkeUnionById(client, resolvedUnionId) : null;
    const resolvedUnionName = resolvedUnion?.name || 'UNION';

    if (sectionKey === 'basic_info') {
        const commanderName = data?.nickname || 'Unknown';
        const commanderLevel = data?.lv ?? 'Unknown';
        const unionName = resolvedUnionName;

        return createEmbed({
            title: `[${unionName}] ${accountName} • Profile • Basic Info`,
            description: ``,
            color: getColor('success'),
        }).addFields(
            {
                name: 'Basic Info',
                value: [
                    `Commander Name: **${commanderName}**`,
                    `Commander Level: **${commanderLevel}**`,
                    `Character Count: **${data?.character_count ?? 'Unknown'}**`,
                    `Costume Count: **${data?.character_costume_count ?? 'Unknown'}**`,
                    `Created at: **${formatProfileDate(data?.created_at)}**`,
                    `Last action at: **${formatProfileDate(data?.last_action_at)}**`,
                    `Union: **${unionName}**`,
                    `Banned: **${data?.is_banned ? 'Yes' : 'No'}**`,
                ].join('\n'),
                inline: false,
            },
            {
                name: 'Currencies',
                value: formatCurrencies(data?.currencies),
                inline: false,
            },
            {
                name: 'Progress',
                value: [
                    `Team Combat Power: **${data?.team_combat ?? 'Unknown'}**`,
                    `Normal Mode Progress: **${formatCampaignProgress(data?.progress_normal_campaign)}**`,
                    `Hard Mode Progress: **${formatCampaignProgress(data?.progress_hard_campaign)}**`,
                    `Tribal Tower: **${data?.progress_tribe_tower ?? 'Unknown'}**`,
                    `Simulation Overclock: **${data?.sim_room_overclock_latest_season_high_score ?? 'Unknown'}**`,
                ].join('\n'),
                inline: false,
            },
        );
    }

    if (sectionKey === 'outpost_info') {
        const synchroLevel = data?.synchro_level ?? 'Unknown';
        const outpostLevel = data?.outpost_battle_level ?? 'Unknown';
        return createEmbed({
            title: `[${resolvedUnionName}] ${accountName} • Outpost Info`,
            description: ``,
            color: getColor('success'),
        }).addFields(
            {
                name: 'Outpost Info',
                value: [
                    `Synchro Level: **${synchroLevel}**`, 
                    `Outpost Level: **${outpostLevel}**`
                ].join('\n'),
                inline: false,
            },
            {
                name: 'Infrastructure',
                value: [
                    `Core Lv: **${data?.infra_core_level ?? 'Unknown'}**`,
                    ...formatRecycleRoomResearches(data?.recycle_room_researches),
                ].join('\n'),
                inline: false,
            }
        );
    }

    if (sectionKey === 'daily_progress') {
        const dailyData = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
        const simChapter = dailyData?.sim_room_daily_best_record?.chapter;
        const simDifficulty = dailyData?.sim_room_daily_best_record?.difficulty;
        const simRecord = (simChapter !== undefined && simDifficulty !== undefined)
            ? `Chapter ${simChapter}, Difficulty ${simDifficulty}`
            : 'Unknown';

        const adviseDone = evaluateDailyProgressThreshold('counsel_remaining_count', dailyData?.counsel_remaining_count);
        const dailyMissionReceivableDone = evaluateDailyProgressThreshold('daily_mission_receivable_points', dailyData?.daily_mission_receivable_points);
        const dailyMissionReceivedDone = evaluateDailyProgressThreshold('daily_mission_received_points', dailyData?.daily_mission_received_points);
        const dailyMissionRewardsDone = evaluateDailyProgressThreshold('daily_mission_received_rewards', dailyData?.daily_mission_received_rewards);
        const interceptDone = evaluateDailyProgressThreshold('intercept_remaining_tickets', dailyData?.intercept_remaining_tickets);
        const outpostStorageExcessDone = evaluateDailyProgressThreshold('outpost_battle_storage_excess', dailyData?.outpost_battle_storage_excess);
        const outpostStorageFullnessDone = evaluateDailyProgressThreshold('outpost_battle_storage_fullness', dailyData?.outpost_battle_storage_fullness);
        const rookieArenaDone = evaluateDailyProgressThreshold('rookie_arena_remaining_count', dailyData?.rookie_arena_remaining_count);
        const specialArenaDone = evaluateDailyProgressThreshold('special_arena_remaining_count', dailyData?.special_arena_remaining_count);
        const dispatchCompletedDone = parseProgressNumber(dailyData?.dispatch_completed_count) === 15;
        const simRoomBestDone = isSimRoomBestDone(dailyData?.sim_room_daily_best_record);
        const towerDailyDone = isTowerDailyDone(dailyData?.tower_daily_info_list);
        const weeklyMissionReceivedDone = evaluateDailyProgressThreshold('weekly_mission_received_points', dailyData?.weekly_mission_received_points);

        return createEmbed({
            title: `[${resolvedUnionName}] ${accountName} • Daily Contents Progress`,
            description: ``,
            color: getColor('success'),
        }).addFields(
            {
                name: 'Daily Progress',
                value: [
                    `${statusEmoji(adviseDone)} Advise Remaining: **${formatSimpleValue(dailyData?.counsel_remaining_count)}**`,
                    `${statusEmoji(dailyMissionReceivedDone)} Daily Mission Received: **${formatSimpleValue(dailyData?.daily_mission_received_points)}**`,
                    `${statusEmoji(dispatchCompletedDone)} Dispatch Completed: **${formatSimpleValue(dailyData?.dispatch_completed_count)}**`,
                    `${statusEmoji(interceptDone)} Intercept Remaining: **${formatSimpleValue(dailyData?.intercept_remaining_tickets)}**`,
                    `${statusEmoji(outpostStorageFullnessDone)} Outpost Storage Fullness: **${formatPercent(dailyData?.outpost_battle_storage_fullness)}**`,
                    `${statusEmoji(rookieArenaDone)} Rookie Arena Remaining: **${formatSimpleValue(dailyData?.rookie_arena_remaining_count)}**`,
                    `${statusEmoji(specialArenaDone)} Special Arena Remaining: **${formatSimpleValue(dailyData?.special_arena_remaining_count)}**`,
                    `${statusEmoji(simRoomBestDone)} Sim Room Best: **${simRecord}**`,
                    `${statusEmoji(towerDailyDone)} Tower Daily: ${formatTowerDailyInline(dailyData?.tower_daily_info_list)}`,
                    `${statusEmoji(weeklyMissionReceivedDone)} Weekly Mission Received: **${formatSimpleValue(dailyData?.weekly_mission_received_points)}**`,
                ].join('\n'),
                inline: false,
            }
        );
    }

    return createEmbed({
        title: `✅ Account Profile • ${sectionLabel}`,
        description: `Section snapshot contains **${summarizeSectionData(data)}**.`,
        color: getColor('success'),
    });
}

const ACCOUNT_PROFILE_RESPONSE_FIELD_NAMES = Object.freeze({
    basic_info: 'Basic Info Payload',
    outpost_info: 'Outpost Payload',
    daily_progress: 'Daily Progress Payload',
});

function formatCacheTimestamp(value) {
    if (!value) {
        return 'unknown';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'unknown';
    }

    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function formatCurrentTimestamp() {
    return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

function buildProfileUpdateComponents(buttonId, intlOpenId, areaId) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${buttonId}:${intlOpenId}:${areaId}`)
                .setLabel('Update')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary),
        ),
    ];
}

function normalizeProfileViewIndex(value) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed)) {
        return 0;
    }

    const max = ACCOUNT_PROFILE_SECTIONS.length;
    return ((parsed % max) + max) % max;
}

function buildAccountProfilePagerComponents(intlOpenId, areaId, viewIndex) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${ACCOUNT_PROFILE_BACK_BUTTON_ID}:${intlOpenId}:${areaId}:${viewIndex}`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`${ACCOUNT_PROFILE_UPDATE_BUTTON_ID}:${intlOpenId}:${areaId}:${viewIndex}`)
                .setLabel('Update')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`${ACCOUNT_PROFILE_FORWARD_BUTTON_ID}:${intlOpenId}:${areaId}:${viewIndex}`)
                .setLabel('Forward')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
}

export function buildAccountProfileUpdateOnlyComponents(intlOpenId, areaId, viewIndex, { singleMode = false } = {}) {
    const customId = singleMode
        ? `${ACCOUNT_PROFILE_UPDATE_BUTTON_ID}:${intlOpenId}:${areaId}:${viewIndex}:single`
        : `${ACCOUNT_PROFILE_UPDATE_BUTTON_ID}:${intlOpenId}:${areaId}:${viewIndex}`;

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('Update')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary),
        ),
    ];
}

function resolveAreaId(value) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

async function buildStoredProfileSectionView(client, {
    intl_open_id,
    area_id,
    refresh = false,
    section,
    endpoint,
    title,
    buttonId,
}) {
    const resolvedAreaId = resolveAreaId(area_id);
    const result = await getNikkeAccountProfileSection(client, {
        intl_open_id,
        section,
        refresh,
        area_id: resolvedAreaId,
    });

    if (!result.success) {
        if (result.reason === 'account_not_found') {
            throw new Error(`No Nikke account exists for open id ${intl_open_id}`);
        }

        throw new Error(`Failed to load ${section} profile payload`);
    }

    const json = safeJSON(result.data, 2);
    const length = json.length;
    const preview = json.slice(0, 1000);
    const effectiveAreaId = Number.isInteger(Number.parseInt(String(result.area_id), 10))
        ? Number.parseInt(String(result.area_id), 10)
        : resolvedAreaId;

    const embed = createEmbed({
        title: '✅ API Call Successful',
        description: `Successfully called Nikke API endpoint \`${endpoint}\`.`,
        color: getColor('success'),
    }).addFields(
        { name: title, value: `\`\`\`json\n${preview}\n\`\`\`` },
        {
            name: 'Data Source',
            value: `Source: ${result.source || 'unknown'}\nFetched at: ${formatCurrentTimestamp()}\nUpdated at: ${formatCacheTimestamp(result.updated_at)}`,
            inline: false,
        },
    );

    return {
        embed,
        components: buildProfileUpdateComponents(buttonId, intl_open_id, effectiveAreaId),
        file: length > 1000
            ? {
                attachment: Buffer.from(json),
                name: 'response.json',
            }
            : null,
    };
}

export async function buildUserProfileBasicInfoView(client, intlOpenId, areaId, { refresh = false } = {}) {
    return buildStoredProfileSectionView(client, {
        intl_open_id: intlOpenId,
        area_id: areaId,
        refresh,
        section: 'basic_info',
        endpoint: 'getUserProfileBasicInfo',
        title: 'Response Preview',
        buttonId: USER_PROFILE_BASIC_INFO_UPDATE_BUTTON_ID,
    });
}

export async function buildUserProfileOutpostInfoView(client, intlOpenId, areaId, { refresh = false } = {}) {
    return buildStoredProfileSectionView(client, {
        intl_open_id: intlOpenId,
        area_id: areaId,
        refresh,
        section: 'outpost_info',
        endpoint: 'getUserProfileOutpostInfo',
        title: 'Response Preview',
        buttonId: USER_PROFILE_OUTPOST_INFO_UPDATE_BUTTON_ID,
    });
}

export async function buildUserDailyContentsProgressView(client, intlOpenId, areaId, { refresh = false } = {}) {
    return buildStoredProfileSectionView(client, {
        intl_open_id: intlOpenId,
        area_id: areaId,
        refresh,
        section: 'daily_progress',
        endpoint: 'getUserDailyContentsProgress',
        title: 'Response Preview',
        buttonId: USER_DAILY_CONTENTS_PROGRESS_UPDATE_BUTTON_ID,
    });
}

export async function buildAccountProfileView(
    client,
    intlOpenId,
    areaId,
    viewIndex,
    { refresh = false } = {},
) {
    const normalizedIndex = normalizeProfileViewIndex(viewIndex);
    const section = ACCOUNT_PROFILE_SECTIONS[normalizedIndex];
    const resolvedAreaId = resolveAreaId(areaId);

    const result = await getNikkeAccountProfileSection(client, {
        intl_open_id: intlOpenId,
        section: section.key,
        refresh,
        area_id: resolvedAreaId,
    });

    if (!result.success) {
        if (result.reason === 'account_not_found') {
            throw new Error(`No Nikke account exists for open id ${intlOpenId}`);
        }

        throw new Error(`Failed to load ${section.label} profile payload`);
    }

    const json = safeJSON(result.data, 2);
    const preview = json.slice(0, 1000);
    const effectiveAreaId = Number.isInteger(Number.parseInt(String(result.area_id), 10))
        ? Number.parseInt(String(result.area_id), 10)
        : resolvedAreaId;
    const embedPreset = await buildAccountProfileEmbedPreset(client, intlOpenId, section.key, result.data, section.label);

    const embed = EmbedBuilder.from(embedPreset).addFields(
        {
            name: 'Data Source',
            value: `Source: ${result.source || 'unknown'}\nFetched at: ${formatCurrentTimestamp()}\nUpdated at: ${formatCacheTimestamp(result.updated_at)}`,
            inline: false,
        },
    ).setFooter({
        text: `View ${normalizedIndex + 1}/${ACCOUNT_PROFILE_SECTIONS.length}`,
    });

    return {
        embed,
        areaId: effectiveAreaId,
        components: buildAccountProfilePagerComponents(intlOpenId, effectiveAreaId, normalizedIndex),
        file: null,
    };
}

export async function handleAccountProfile(interaction, client) {
    const guild = interaction.guild;
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error('Failed to defer reply:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to retrieve account profile.')],
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString('intl_open_id', true);
    const nikke_area_id = null;

    try {
        const response = await buildAccountProfileView(client, intl_open_id, nikke_area_id, 0);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [response.embed],
            components: response.components,
            // files: response.file ? [response.file] : [],
        }).catch(logger.error);
    } catch (error) {
        logger.error('Error getting account profile:', error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('An error occurred while trying to get the account profile. Please try again.')],
        }).catch(logger.error);
    }
}

export async function handleSearchUser(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to check guild details.")]
        }).catch(logger.error);
        return;
    }

    const limit = interaction.options.getInteger("limit") || 20;
    const next_page_cursor = interaction.options.getString("next_page_cursor") || "";
    const user_name = interaction.options.getString("user_name") || "";

    try {
        const res = await searchUser(limit, next_page_cursor, user_name);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`searchUser\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
                );
            
            if (length > 1000) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                    files: [
                        {
                            attachment: Buffer.from(json),
                            name: "response.json"
                        }
                    ]
                }).catch(logger.error);
            } else {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                }).catch(logger.error);
            }
        }
    } catch (error) {
        logger.error("Error searching user:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to search for the user. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserProfile(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user profile.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");

    try {
        const res = await getUserProfile(intl_open_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserProfile\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
                );
            
            if (length > 1000) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                    files: [
                        {
                            attachment: Buffer.from(json),
                            name: "response.json"
                        }
                    ]
                }).catch(logger.error);
            } else {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                }).catch(logger.error);
            }
        }
    } catch (error) {
        logger.error("Error getting user profile:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user profile. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserCharacters(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user characters.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = null;

    try {
        const res = await getUserCharacters(intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserCharacters\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
                );
            
            if (length > 1000) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                    files: [
                        {
                            attachment: Buffer.from(json),
                            name: "response.json"
                        }
                    ]
                }).catch(logger.error);
            } else {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                }).catch(logger.error);
            }
        }
    } catch (error) {
        logger.error("Error getting user characters:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user characters. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserGameInfo(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user game info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");

    try {
        const res = await getUserGameInfo(intl_open_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserGameInfo\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
                );
            
            if (length > 1000) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                    files: [
                        {
                            attachment: Buffer.from(json),
                            name: "response.json"
                        }
                    ]
                }).catch(logger.error);
            } else {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                }).catch(logger.error);
            }
        }
    } catch (error) {
        logger.error("Error getting user game info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user game info. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserProfileBasicInfo(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user profile basic info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = null;

    try {
        const response = await buildAccountProfileView(client, intl_open_id, nikke_area_id, 0);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [response.embed],
            components: buildAccountProfileUpdateOnlyComponents(intl_open_id, response.areaId, 0, { singleMode: true }),
            files: response.file ? [response.file] : [],
        }).catch(logger.error);
    } catch (error) {
        logger.error("Error getting user profile basic info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user profile basic info. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserProfileOutpostInfo(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user profile outpost info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = null;

    try {
        const response = await buildAccountProfileView(client, intl_open_id, nikke_area_id, 1);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [response.embed],
            components: buildAccountProfileUpdateOnlyComponents(intl_open_id, response.areaId, 1, { singleMode: true }),
            files: response.file ? [response.file] : [],
        }).catch(logger.error);
    } catch (error) {
        logger.error("Error getting user profile outpost info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user profile outpost info. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserDailyContentsProgress(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user daily contents progress.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = null;

    try {
        const response = await buildAccountProfileView(client, intl_open_id, nikke_area_id, 2);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [response.embed],
            components: buildAccountProfileUpdateOnlyComponents(intl_open_id, response.areaId, 2, { singleMode: true }),
            files: response.file ? [response.file] : [],
        }).catch(logger.error);
    } catch (error) {
        logger.error("Error getting user daily contents progress:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user daily contents progress. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetMyGuildInfo(interaction, client) {
    const guild = interaction.guild;
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Administrator** permission to retrieve my guild info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = null;

    try {
        const res = await getMyGuildInfo(intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getMyGuildInfo\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
                );
            
            if (length > 1000) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                    files: [
                        {
                            attachment: Buffer.from(json),
                            name: "response.json"
                        }
                    ]
                }).catch(logger.error);
            } else {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                }).catch(logger.error);
            }
        }
    } catch (error) {
        logger.error("Error getting my guild info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get my guild info. Please try again.")]
        }).catch(logger.error);
    }
}