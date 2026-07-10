import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getCharacters, getCharacterByName, safeJSON } from '../../../services/nikke.js';

export async function handleCharacterByName(interaction, client) {
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

    const name = interaction.options.getString("name");

    try {
        const res = await getCharacterByName(name);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke GG API endpoint character\`.`,
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
        logger.error("Error checking login status:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check login status. Please try again.")]
        }).catch(logger.error);
    }
};