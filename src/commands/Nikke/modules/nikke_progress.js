import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import {
    addNikkeAccountProgressEntry,
    fetchNikkeAccountProgress,
    getNikkeAccountByOpenId,
    getNikkeAccountProgressByOpenId,
    removeNikkeAccountProgressEntry,
} from '../../../utils/database.js';

function formatEmbedTimestamp(value) {
    if (!value) {
        return 'Unknown';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function parseCurrencyMap(currencies) {
    if (Array.isArray(currencies)) {
        return currencies.reduce((acc, entry, index) => {
            const key = String(entry?.type ?? index);
            acc[key] = entry?.value ?? null;
            return acc;
        }, {});
    }

    if (currencies && typeof currencies === 'object') {
        return currencies;
    }

    return {};
}

function parseCurrencyAmount(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function buildTrackedCurrency(currencies) {
    const currencyMap = parseCurrencyMap(currencies);
    const gemsPaid = parseCurrencyAmount(currencyMap['98']);
    const gemsFree = parseCurrencyAmount(currencyMap['99']);

    return {
        gems: (gemsPaid ?? 0) + (gemsFree ?? 0),
        golden_mileage: parseCurrencyAmount(currencyMap['12000']),
        silver_mileage: parseCurrencyAmount(currencyMap['11000']),
        recruit_vouches: parseCurrencyAmount(currencyMap['5100']),
        advanced_recruit_vouches: parseCurrencyAmount(currencyMap['5200']),
    };
}

export async function handleAccountProgress(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error('Failed to defer account progress interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to view Nikke account progress.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();
    const result = await getNikkeAccountProgressByOpenId(client, intlOpenId);

    if (!result.success) {
        if (result.reason === 'not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Progress Not Found', `No progress row exists for open id ${intlOpenId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to load Nikke account progress right now.')],
        }).catch(logger.error);
        return;
    }

    const progress = result.progress;
    const dataJson = JSON.stringify(progress.data ?? {}, null, 2);
    const dataPreview = dataJson.length > 1000
        ? `${dataJson.slice(0, 1000)}\n...`
        : dataJson;

    const embed = createEmbed({
        title: `✅ Account Progress • ${intlOpenId}`,
        description: `Tracked: **${progress.tracked ? 'Yes' : 'No'}**`,
    }).addFields(
        {
            name: 'Data Preview',
            value: `\`\`\`json\n${dataPreview}\n\`\`\``,
            inline: false,
        },
        {
            name: 'Timestamps',
            value: [
                `Fetched at: ${formatEmbedTimestamp(progress.fetched_at)}`,
                `Created at: ${formatEmbedTimestamp(progress.created_at)}`,
                `Updated at: ${formatEmbedTimestamp(progress.updated_at)}`,
            ].join('\n'),
            inline: false,
        },
    );

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
    }).catch(logger.error);
}

export async function handleAccountProgressFetch(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error('Failed to defer account progress fetch interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to fetch Nikke account progress.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();
    const result = await fetchNikkeAccountProgress(client, {
        intl_open_id: intlOpenId,
        tracked: true,
    });

    if (!result.success) {
        if (result.reason === 'account_not_found' || result.reason === 'not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Account Not Found', `No Nikke account exists for open id ${intlOpenId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Fetch Failed', 'Unable to fetch and store account progress right now.')],
        }).catch(logger.error);
        return;
    }

    const progress = result.progress;
    const dataSummary = Array.isArray(progress.data)
        ? `${progress.data.length} entries`
        : `${Object.keys(progress.data ?? {}).length} keys`;

    const embed = createEmbed({
        title: `✅ Account Progress Fetched • ${intlOpenId}`,
        description: `Fetched from **${result.source || 'Live API'}** and stored in **nikke_accounts_progress**.`,
    }).addFields(
        {
            name: 'Stored State',
            value: [
                `Tracked: **${progress.tracked ? 'Yes' : 'No'}**`,
                `Data: **${dataSummary}**`,
                `Fetched at: ${formatEmbedTimestamp(progress.fetched_at)}`,
                `Updated at: ${formatEmbedTimestamp(progress.updated_at)}`,
            ].join('\n'),
            inline: false,
        },
    );

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
    }).catch(logger.error);
}

export async function handleAccountProgressAdd(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error('Failed to defer account progress add interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to add Nikke account progress entries.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();
    const tracked = interaction.options.getBoolean('tracked') ?? true;

    const accountResult = await getNikkeAccountByOpenId(client, intlOpenId);
    if (!accountResult.success || !accountResult.account) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Account Not Found', `No Nikke account exists for open id ${intlOpenId}.`)],
        }).catch(logger.error);
        return;
    }

    const account = accountResult.account;
    const dailyProgress = account.daily_progress ?? {};
    const currency = buildTrackedCurrency(account.basic_info?.currencies);
    const data = {
        profile: {
            outpost_level: account.outpost_info?.outpost_battle_level ?? null,
            synchro_level: account.outpost_info?.synchro_level ?? null,
        },
        progress: {
            daily_missions: {
                receivable_points: dailyProgress.daily_mission_receivable_points ?? null,
            },
            weekly_missions: {
                receivable_points: dailyProgress.weekly_mission_receivable_points ?? null,
            },
            interception_hits: dailyProgress.intercept_remaining_tickets ?? null,
        },
        currency,
        dolls: {},
        elemental_scores: {},
        raid_damage: {},
    };

    const result = await addNikkeAccountProgressEntry(client, {
        intl_open_id: intlOpenId,
        tracked,
        data,
    });

    if (!result.success) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Add Failed', 'Unable to add account progress entry right now.')],
        }).catch(logger.error);
        return;
    }

    const progress = result.progress;
    const embed = createEmbed({
        title: `✅ Account Progress Added • ${intlOpenId}`,
        description: 'Progress entry was inserted or updated in **nikke_accounts_progress**.',
    }).addFields(
        {
            name: 'Stored State',
            value: [
                `Tracked: **${progress.tracked ? 'Yes' : 'No'}**`,
                `Fetched at: ${formatEmbedTimestamp(progress.fetched_at)}`,
                `Updated at: ${formatEmbedTimestamp(progress.updated_at)}`,
            ].join('\n'),
            inline: false,
        },
    );

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
    }).catch(logger.error);
}

export async function handleAccountProgressRemove(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error('Failed to defer account progress remove interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to remove Nikke account progress entries.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();
    const result = await removeNikkeAccountProgressEntry(client, intlOpenId);

    if (!result.success) {
        if (result.reason === 'not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Progress Not Found', `No progress row exists for open id ${intlOpenId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Remove Failed', 'Unable to remove account progress entry right now.')],
        }).catch(logger.error);
        return;
    }

    const embed = createEmbed({
        title: `✅ Account Progress Removed • ${intlOpenId}`,
        description: 'Progress entry was deleted from **nikke_accounts_progress**.',
    });

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
    }).catch(logger.error);
}
