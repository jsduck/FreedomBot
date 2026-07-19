import { ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import {
    setNikkeUnionCounterChannel,
    setNikkeUnionCounterDisabled,
    setNikkeUnionCounterEnabled,
} from '../../../utils/database.js';

export async function handleUnionCounterEnable(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer union counter enable interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to enable union counters.')],
        }).catch(logger.error);
        return;
    }

    const unionId = interaction.options.getString('union_id', true).trim();
    const result = await setNikkeUnionCounterEnabled(client, unionId, interaction.user.id);

    if (!result.success) {
        if (result.reason === 'union_not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Union Not Found', `No Nikke union exists for union id ${unionId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to enable the union counter right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Union Counter Enabled',
            `Enabled reminders for union ${result.union.name} (${result.union.union_id}).\nTracked members from nikke_accounts: ${result.member_count}.\nTesting mode is active with 5-minute checks.`
        )],
    }).catch(logger.error);
}

export async function handleUnionCounterDisable(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer union counter disable interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to disable union counters.')],
        }).catch(logger.error);
        return;
    }

    const unionId = interaction.options.getString('union_id', true).trim();
    const result = await setNikkeUnionCounterDisabled(client, unionId, interaction.user.id);

    if (!result.success) {
        if (result.reason === 'union_not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Union Not Found', `No Nikke union exists for union id ${unionId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to disable the union counter right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Union Counter Disabled',
            `Disabled reminders for union ${result.union.name} (${result.union.union_id}).`
        )],
    }).catch(logger.error);
}

export async function handleUnionSetCounterChannel(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer union set-counter-channel interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to set union counter channels.')],
        }).catch(logger.error);
        return;
    }

    const unionId = interaction.options.getString('union_id', true).trim();
    const channel = interaction.options.getChannel('channel', true);

    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Invalid Channel', 'Please choose a text or announcement channel.')],
        }).catch(logger.error);
        return;
    }

    const result = await setNikkeUnionCounterChannel(client, unionId, channel.id, interaction.user.id);

    if (!result.success) {
        if (result.reason === 'union_not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Union Not Found', `No Nikke union exists for union id ${unionId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to set the union counter channel right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Union Counter Channel Set',
            `Set reminder channel for union ${result.union.name} (${result.union.union_id}) to ${channel}.`
        )],
    }).catch(logger.error);
}