import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getMyGuildInfo, getUserGameInfo, searchUser, getUserProfile, getUserCharacters, safeJSON } from '../../../services/nikke.js';
import { getNikkeAccountProfileSection, getNikkeUnionById } from '../../../utils/database.js';

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

async function buildAccountProfileEmbedPreset(client, sectionKey, data, sectionLabel) {
    if (sectionKey === 'basic_info') {
        const commanderName = data?.nickname || 'Unknown';
        const commanderLevel = data?.lv ?? 'Unknown';
        const unionId = data?.gsn ?? null;
        const union = unionId ? await getNikkeUnionById(client, unionId) : null;
        const unionName = union?.name || 'UNION';

        return createEmbed({
            title: `[${unionName}] ${commanderName} • Profile • Basic Info`,
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
        const synchroLevel = data?.synchro_level ?? data?.synchro?.level ?? 'Unknown';
        const outpostLevel = data?.outpost_level ?? data?.outpost?.level ?? 'Unknown';
        return createEmbed({
            title: '✅ Account Profile • Outpost Info',
            description: `Synchro Level: **${synchroLevel}** | Outpost Level: **${outpostLevel}**`,
            color: getColor('success'),
        });
    }

    if (sectionKey === 'daily_progress') {
        const summary = summarizeSectionData(data);
        return createEmbed({
            title: '✅ Account Profile • Daily Contents Progress',
            description: `Daily progress snapshot contains **${summary}**.`,
            color: getColor('success'),
        });
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
    const embedPreset = await buildAccountProfileEmbedPreset(client, section.key, result.data, section.label);

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
        const response = await buildUserProfileBasicInfoView(client, intl_open_id, nikke_area_id);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [response.embed],
            components: response.components,
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
        const response = await buildUserProfileOutpostInfoView(client, intl_open_id, nikke_area_id);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [response.embed],
            components: response.components,
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
        const response = await buildUserDailyContentsProgressView(client, intl_open_id, nikke_area_id);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [response.embed],
            components: response.components,
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