import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("nikke")
        .setDescription("Nikke command for testing purposes.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("test")
                .setDescription("Test subcommand for Nikke."))
        ,

        async execute(interaction) {
            try {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '✅ Cum',
                            description:
                                `Test`,
                            color: 'success',
                        }),
                    ],
                });
            } catch (error) {
                await handleInteractionError(interaction, error, {
                    type: 'command',
                    commandName: 'nikke',
                    context: 'test'
                });
            }
        }

}