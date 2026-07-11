import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getUserCharacterDetails, getCharacters, getCharacterByName, getNameCodeByName, getNameByCode, safeJSON } from '../../../services/nikke.js';

function getFunctionDetailsById(json, id) {
  const effect = json.state_effects.find(e => String(e.id) === String(id));
  return effect ? effect.function_details : null;
}

function getDups(dups) {
    switch (dups) {
        case 0:
        case 1:
        case 2:
            return `LB ${dups}`;
        case 3:
            return "MLB";
        default:
            return `CORE ${dups-3}`;
    }
}

function getDollStats(rawNikke) {
    switch (rawNikke.favorite_item_tid) {
        case 0:
            return ``;
        case 100101:
        case 100201:
        case 100301:
        case 100401:
        case 100501:
        case 100601:
            return `R ${rawNikke.favorite_item_lv}`;
        case 100102:
        case 100202:
        case 100302:
        case 100402:
        case 100502:
        case 100602:
            return `SR ${rawNikke.favorite_item_lv}`;
        default:
            return `SSR ${rawNikke.favorite_item_lv+1}`;
    }
}

function extractOLvalue(gear, dict) {
    gear?.forEach(g => {
        var type = g.function_details[0].function_type,
            val = g.function_details[0].function_value / 100;
        dict[type] = dict[type] ? dict[type] + val : val;
    });
    Object.keys(dict).forEach(key => {
        dict[key] = Number(dict[key].toFixed(2));
    });
}

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

                const units = data.data.character_details;
                const effects = data.data.state_effects;
                const lines = ["arm_equip_option1_id", "arm_equip_option2_id", "arm_equip_option3_id", "head_equip_option1_id", "head_equip_option2_id", "head_equip_option3_id", "leg_equip_option1_id", "leg_equip_option2_id", "leg_equip_option3_id", "torso_equip_option1_id", "torso_equip_option2_id", "torso_equip_option3_id"];

                const gear = [];
                lines.forEach(line => {
                    if (!units[0][line]) return;
                    const effect = effects.find(e => e.id == units[0][line]);
                    if (effect) gear.push(effect);
                });
                var OLdict = {};
                extractOLvalue(gear, OLdict);
                console.log("Gear:", gear);
                console.log('\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n');
                console.log("OLdict:", OLdict);
    
                const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
                const embed = createEmbed({
                        title: `${getNameByCode(units[0].name_code)} Character Details`,
                        description: `Successfully called Nikke API endpoint getUserCharacterDetails\`.`,
                        color: getColor('success')
                    }).setThumbnail("https://static.dotgg.gg/nikke/characters/" + char_json.img + ".webp")
                        .addFields(
                            { 
                                name: "Basic Info", 
                                value: [
                                    ` **Synchro-Level:** ${units[0].lv}`,
                                    ` **Combat Power:** ${units[0].combat}`,
                                    ` **Bond:** ${units[0].attractive_lv}`,
                                    ` **Limit Break:** ${getDups(units[0].grade+units[0].core)}`,
                                    ` **Skills:** ${units[0].skill1_lv} / ${units[0].skill2_lv} / ${units[0].ulti_skill_lv}`,
                                ].join("\n"),
                                inline: false 
                            },
                            {
                                name: "Cube & Doll",
                                value: [
                                    ` **Cube:** ${units[0].harmony_cube_tid} (Lv. ${units[0].harmony_cube_lv})`,
                                    ` **Doll:** ${getDollStats(units[0])}`,
                                ].join("\n"),
                                inline: false
                            },
                            {
                                name: "Stats",
                                value: [
                                    ` **HP:** ${units[0].hp}`,
                                    ` **ATK:** ${units[0].atk}`
                                ].join("\n"),
                                inline: false
                            },
                            {
                                name: "Overload Info",
                                value: [
                                    ` **Arm Lv${units[0].arm_equip_lv}:** TODO`,
                                    ` **Head Lv${units[0].head_equip_lv}:** TODO`,
                                    ` **Leg Lv${units[0].leg_equip_lv}:** TODO`,
                                    ` **Torso Lv${units[0].torso_equip_lv}:** TODO`
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