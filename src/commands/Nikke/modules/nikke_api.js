import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { fetchNikkeApi } from '../../../services/nikke.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

function safeJSON(obj) {
  return JSON.stringify(obj, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
}

export async function handleFetchApi(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to fetch API data.")]
        }).catch(logger.error);
        return;
    }

    const endpoint = interaction.options.getString("endpoint");
    const method = 'POST';//interaction.options.getString("method");
    const payload = interaction.options.getString("payload");
    console.log(JSON.parse(payload));

    try {
        const res = await fetchNikkeApi(endpoint, method, payload ? JSON.parse(payload) : null);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data);

            const fieldValue =
            json && json.length > 0 && json.length <= 1024
                ? `\`\`\`json\n${json}\n\`\`\``
                : "Response too large or empty.";

            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`${endpoint}\` with method \`${method}\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Data", value: `\`\`\`json\n${fieldValue}\n\`\`\`` }
                );
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            }).catch(logger.error);
        }
    } catch (error) {
        logger.error("Error fetching API data:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to fetch API data. Please try again.")]
        }).catch(logger.error);
    }
}