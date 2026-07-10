import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import { handleLogin, handleCheckLogin } from './modules/nikke_login.js';
import { handleFetchApi } from './modules/nikke_api.js';

import { handleCharacterByName } from './modules/nikke_gg.js';

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
                .setName("checklogin")
                .setDescription("Check login status for Nikke API"))
        .addSubcommand(subcommand =>
            subcommand
                .setName("fetch-api")
                .setDescription("Direct API call to Nikke API")
                .addStringOption(option =>
                    option
                        .setName("endpoint")
                        .setDescription("The API endpoint to call")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("method")
                        .setDescription("The HTTP method to use")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("payload")
                        .setDescription("The payload for the API request")
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("character")
                .setDescription("Get character info from NikkeGG API")
                .addStringOption(option =>
                    option
                        .setName("name")
                        .setDescription("Nikke name, no spaces")
                        .setRequired(true)   
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("user-character")
                .setDescription("Get character info from Nikke API for a specific user")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch character info for")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("name_codes")
                        .setDescription("Nikke name codes")
                        .setRequired(true)   
                ))
        ,
        async execute(interaction, client) {
            const subcommand = interaction.options.getSubcommand();
            
            try {
                switch (subcommand) {
                    case "login":
                        await handleLogin(interaction, client);
                        break;
                    case "checklogin":
                        await handleCheckLogin(interaction, client);
                        break;
                    case "fetch-api":
                        await handleFetchApi(interaction, client);
                        break;
                    case "character":
                        await handleCharacterByName(interaction, client);
                        break;
                    case "user-character":
                        await handleUserCharacter(interaction, client);
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

