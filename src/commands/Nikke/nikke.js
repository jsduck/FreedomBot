import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import { handleLogin, handleCheckLogin } from './modules/nikke_login.js';

export default {
    data: new SlashCommandBuilder()
        .setName("nikke")
        .setDescription("Nikke commands.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("login")
                .setDescription("Generate login token for Nikke API"))
        .addSubcommand(subcommand =>
            subcommand
                .setName("checkLogin")
                .setDescription("Check login status for Nikke API"))
        ,
        async execute(interaction, client) {
            const subcommand = interaction.options.getSubcommand();
            
            try {
                switch (subcommand) {
                    case "login":
                        //await handleLogin(interaction, client);
                        break;
                    case "checkLogin":
                        //await handleCheckLogin(interaction, client);
                        break;
                    default:
                        await InteractionHelper.safeReply(interaction, {
                            embeds: [errorEmbed("Unknown subcommand.")],
                            flags: MessageFlags.Ephemeral
                        }).catch(logger.error);
                }
            } catch (error) {
                logger.error(`Error in Nikke ${subcommand}:`, error);
            
                const errorEmbedMsg = createEmbed({ 
                    title: "❌ Error", 
                    description: "An error occurred while processing your request.",
                    color: getColor('error')
                });

                if (!interaction.replied && !interaction.deferred) {
                    await InteractionHelper.safeReply(interaction, { embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
                } else {
                    await interaction.followUp({ embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
                }
            }
                
        }

}

