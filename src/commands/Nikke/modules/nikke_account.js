import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import {
    addNikkeAccount,
    deleteNikkeAccount,
    syncNikkeAccountProfile,
    updateNikkeAccountUnionId,
} from '../../../utils/database.js';

function extractIntlOpenIdFromInput(input) {
    const raw = String(input || '').trim();
    if (!raw) {
        return null;
    }

    try {
        const temp = raw.split('id=')[1]?.split('&')[0]?.replaceAll('%3D', '=');
        if (!temp) {
            return null;
        }

        const decoded = atob(temp);
        const intlOpenId = decoded.split('-')[1]?.trim();
        return intlOpenId || null;
    } catch {
        return null;
    }
}

export async function handleAccountAdd(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer account add interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to add Nikke accounts.')],
        }).catch(logger.error);
        return;
    }

    const name = interaction.options.getString('name', true).trim();
    const accountInput = interaction.options.getString('account_input', true).trim();
    const intlOpenId = extractIntlOpenIdFromInput(accountInput);
    const discordTag = interaction.options.getString('discord_tag', false)?.trim() || null;

    if (!intlOpenId) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed(
                'Invalid Account Input',
                'Could not extract `intl_open_id` from the provided string. Include a value containing `openid= or uid=`.'
            )],
        }).catch(logger.error);
        return;
    }

    const result = await addNikkeAccount(client, {
        name,
        intl_open_id: intlOpenId,
        discord_tag: discordTag,
    });

    if (!result.success) {
        if (result.reason === 'already_exists') {
            const existing = result.account;
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed(
                    'Account Already Exists',
                    existing
                        ? `${existing.name} is already stored for open id ${existing.intl_open_id}${existing.union_id ? ` and union id ${existing.union_id}` : ''}.`
                        : 'That account is already stored in the database.'
                )],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to add the Nikke account right now.')],
        }).catch(logger.error);
        return;
    }

    const profileSyncResult = await syncNikkeAccountProfile(client, {
        intl_open_id: result.account.intl_open_id,
        union_id: result.account.union_id,
    });

    const profileSyncMessage = profileSyncResult.success
        ? `\nSaved profile payloads (basic_info, outpost_info, daily_progress) in nikke_accounts for area ${profileSyncResult.area_id}${profileSyncResult.union_id ? ` and derived union id ${profileSyncResult.union_id} from profile gsn` : ''}.`
        : '\nAccount profile payload sync failed. You can retry by re-adding or updating this account later.';

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Account Added',
            `Stored ${result.account.name} with open id ${result.account.intl_open_id}${result.account.discord_tag ? ` and Discord tag ${result.account.discord_tag}` : ''}.${profileSyncMessage}`
        )],
    }).catch(logger.error);
}

export async function handleAccountUpdate(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer account update interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to update Nikke accounts.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();
    const unionId = interaction.options.getString('union_id', true).trim();

    const result = await updateNikkeAccountUnionId(client, {
        intl_open_id: intlOpenId,
        union_id: unionId,
    });

    if (!result.success) {
        if (result.reason === 'not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Account Not Found', `No Nikke account exists for open id ${intlOpenId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to update the Nikke account right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Account Updated',
            `Updated ${result.account.name} (${result.account.intl_open_id}) to union id ${result.account.union_id ?? 'none'}.`
        )],
    }).catch(logger.error);
}

export async function handleAccountDelete(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer account delete interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to delete Nikke accounts.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();

    const result = await deleteNikkeAccount(client, intlOpenId);

    if (!result.success) {
        if (result.reason === 'not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Account Not Found', `No Nikke account exists for open id ${intlOpenId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to delete the Nikke account right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Account Deleted',
            `Deleted ${result.account.name} (${result.account.intl_open_id}) from the database.`
        )],
    }).catch(logger.error);
}
