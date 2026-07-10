import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getUserCharacterDetails, getCharacters, getCharacterByName, safeJSON } from '../../../services/nikke.js';

export async function handleUserCharacter(interaction, client) {
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
    
        const intl_open_id = interaction.options.getString("intl_open_id");
        const name_codes = interaction.options.getString("name_codes");//split(",").map(v => Number(v.trim()));

        //console.log("intl_open_id:", intl_open_id);
        //console.log("name_codes:", name_codes);
        const character_db = await getCharacterByName(name_codes);
        
        const char_json = await character_db.json();
        //console.log(char_json);

        const name_codes_array = [ char_json.statTableId ];
    
        try {
            const res = await getUserCharacterDetails(intl_open_id, name_codes_array);
            if (res.ok) {
                const data = await res.json();
                const json = safeJSON(data, 2);
                const length = json.length;
    
                const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
                const embed = createEmbed({
                        title: "✅ API Call Successful",
                        description: `Successfully called Nikke API endpoint getUserCharacterDetails\`.`,
                        color: getColor('success')
                    }).addFields(
                        { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
                    ).setThumbnail("https://static.dotgg.gg/nikke/characters/" + char_json.img);
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