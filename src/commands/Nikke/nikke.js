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
                const embed = new createEmbed()
                .setColor(0x00AEEF)
                .setTitle('Neon: Vision Eye')
                .setDescription('Character Stats Overview')
                //.setThumbnail('attachment://neon.png')
                .addFields(
                    {
                    name: 'General',
                    value: [
                        '**Bond:** 10',
                        '**LB:** 0',
                        '**Skills:** 10 / 10 / 10',
                        '**Doll:** SR 15',
                        '**Cube:** Quantum 8 | None',
                        '**CP:** 385,288 | 371,714'
                    ].join('\n'),
                    inline: false
                    },
                    {
                    name: 'Main Stats',
                    value: [
                        '**ELE:** 61.99%',
                        '**ATK:** 16.42%',
                        '**Max Ammo:** 64.82%',
                        '**Hit Rate:** 0.00%',
                        '**Crit Rate:** 0.00%',
                        '**Crit DMG:** 0.00%',
                        '**DEF:** 0.00%',
                        '**Charge Speed:** 11.75%',
                        '**Charge DMG:** 0.00%'
                    ].join('\n'),
                    inline: false
                    },
                    {
                    name: 'Equipment',
                    value: [
                        '**Head (5):** ELE 15.15% | ATK 6.18% | Charge Speed 4.04%',
                        '**Chest (5):** ELE 24.96% | ATK 4.77% | Charge Speed 2.57%',
                        '**Gloves (5):** Charge Speed 1.98% | Max Ammo 64.82% | ELE 9.54%',
                        '**Boots (5):** ATK 5.47% | Charge Speed 3.16% | ELE 12.34%'
                    ].join('\n'),
                    inline: false
                    },
                    {
                    name: 'Metadata',
                    value: [
                        '**Last Updated:** tesete',
                        '**USER:** test'
                    ].join('\n'),
                    inline: false
                    }
                )
                .setFooter({ text: 'Generated for CumSlut67 • Neon: Vision Eye' });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
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