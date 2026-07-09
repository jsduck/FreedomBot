import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { login, checkLogin } from '../../../services/nikke.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export async function handleLogin(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to login.")]
        }).catch(logger.error);
        return;
    }

    try {
        const res = await login();
        if (res.ok) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [createEmbed({
                    title: "✅ Login Successful",
                    description: "Successfully logged in to Nikke API.",
                    color: getColor('success')
                })]
            }).catch(logger.error);
        }
    } catch (error) {
        logger.error("Error displaying counters:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to login. Please try again.")]
        }).catch(logger.error);
    }
}

const handleCheckLogin = async (interaction, client) => {
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
            embeds: [errorEmbed("You need **Administrator** permission to check login status.")]
        }).catch(logger.error);
        return;
    }

    try {
        const res = await checkLogin();
        if (res.ok) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [createEmbed({
                    title: "✅ Login Status",
                    description: "You are currently logged in to Nikke API.",
                    color: getColor('success')
                })]
            }).catch(logger.error);
        }
    } catch (error) {
        logger.error("Error checking login status:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check login status. Please try again.")]
        }).catch(logger.error);
    }
};