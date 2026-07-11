import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getUserCharacterDetails, getCharacters, getCharacterByName, getNameCodeByName, getNameByCode, safeJSON } from '../../../services/nikke.js';

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
        const slug = str =>
            str
                .toLowerCase()
                .replace(/[:]/g, "")        // remove colons
                .replace(/\s+/g, "-")       // replace spaces with hyphens
                .replace(/[^a-z0-9-]/g, ""); // remove anything not allowed
        
        const character_db = await getCharacterByName(slug(name_codes));
        const char_json = await character_db.json();
        //console.log(char_json);

        //console.log(name_codes);
        const name_codes_array = [ getNameCodeByName(name_codes) ];
        //console.log("name_codes_array:", name_codes_array);
    
        try {
            const res = await getUserCharacterDetails(intl_open_id, name_codes_array);
            if (res.ok) {
                const data = await res.json();
                const json = safeJSON(data, 2);
                const length = json.length;

                const char_details = data.character_details;
    
                const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
                const embed = createEmbed({
                        title: `${getNameByCode(char_details[0].name_code)} Character Details`,
                        description: `Successfully called Nikke API endpoint getUserCharacterDetails\`.`,
                        color: getColor('success')
                    }).setThumbnail("https://static.dotgg.gg/nikke/characters/" + char_json.img + ".webp")
                        .addFields(
                            { 
                                name: "Basic Info", 
                                value: [
                                    ` **Synchro-Levevl:** TODO`,
                                    ` **Combat Power:** ${char_details[0].combat}`,
                                    ` **Bond:** ${char_details[0].attractive_lv}`,
                                    ` **Limit Break:** ${char_details[0].grade}+${char_details[0].core}`,
                                    ` **Skills:** ${char_details[0].skill1_lv} / ${char_details[0].skill2_lv} / ${char_details[0].ulti_skill_lv}`,
                                ].join("\n"),
                                inline: false 
                            },
                            {
                                name: "Cube & Doll",
                                value: [
                                    ` **Cube:** ${char_details[0].harmony_cube_tid} (Lv. ${char_details[0].harmony_cube_lv})`,
                                    ` **Doll:** ${char_details[0].favorite_item_tid} (Lv. ${char_details[0].favorite_item_lv})`,
                                ].join("\n"),
                                inline: false
                            },
                            {
                                name: "Stats",
                                value: [
                                    ` **HP:** ${char_details[0].hp}`,
                                    ` **ATK:** ${char_details[0].atk}`
                                ].join("\n"),
                                inline: false
                            },
                            {
                                name: "Overload Info",
                                value: [
                                    ` **Arm Lv${char_details[0].arm_equip_lv}:** TODO`,
                                    ` **Head Lv${char_details[0].head_equip_lv}:** TODO`,
                                    ` **Leg Lv${char_details[0].leg_equip_lv}:** TODO`,
                                    ` **Torso Lv${char_details[0].torso_equip_lv}:** TODO`
                                ].join("\n"),
                                inline: false
                            }
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