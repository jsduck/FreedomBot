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

const accchoice = [
    { name: "Kaarako", value: "3166452414820481224" },
    { name: "Demi", value: "16338490109246680481" },
    { name: "Shaito", value: "12167197956671690221" },
    { name: "Fizix", value: "5877343215992272387" },
    { name: "Jae", value: "15097183441877165889" },
    { name: "Effelon", value: "16262646283866114091" },
    { name: "Fesha", value: "12816795455667592937" },
    { name: "Nelex", value: "1175532717634698043" } 
]

function getChoiceNameFromValue(value) {
  return accchoice.find(c => c.value === value)?.name ?? null;
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

function extractEffect(arr, eff, id) {
    if (!arr[id]) return;
    return eff.find(e => e.id == arr[id]);
}

function formatFunctionDetails(details) {
    switch (details) {
        case "StatAtk":
            return "Attack";
        case "IncElementDmg":
            return "EleDmg";
        case "StatChargeTime":
            return "ChrgSpd";
        case "StatChargeDamage":
            return "ChrgDmg";
        case "StatCriticalDamage":
            return "CritDmg";
        case "StatCritical":
            return "CritRate";
        case "StatAmmoLoad":
            return "Ammo";
        case "StatDef":
            return "Def";
        case "StatAccuracyCircle":
            return "Hit:";
        default:
            return "";
    }
}

function formatEquipLine(label, level, units, effects, lines) {
  const rows = lines.map(lineIndex => {
    const eff = extractEffect(units[0], effects, lineIndex)?.function_details?.[0];

    if (!eff) {
      return { type: "—", lvl: "—", val: "—" };
    }

    const type = formatFunctionDetails(eff.function_type) || "N/A";
    const lvl = eff.level || 0;

    // Convert raw value → percentage
    const raw = eff.function_value || 0;
    const val = (raw / 100).toFixed(2) + "%";

    return { type, lvl, val };
  });

  const body = rows
    .map(r => {
      const col1 = r.type.padEnd(10);      // Type
      const col2 = `(${r.lvl})`.padEnd(6); // (Lvl)
      const col3 = r.val;                  // Value
      return `${col1}${col2}${col3}`;
    })
    .join("\n");

  return `\`${body}\``;
}

function formatTable(title, rows) {
  const header = `**${title}**`;
  const body = rows
    .map(([field, value]) => `${field.padEnd(16)} ${value}`)
    .join("\n");

  return `${header}\n\`\n${body}\n\``;
}

function formatTable2(rows) {
  return rows
    .map(([field, value]) => `${field.padEnd(16)} ${value}`)
    .join("\n");
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
        //if (!interaction.member.permissions.has(PermissionFlagsBits.//Administrator)) {
        //    await InteractionHelper.safeEditReply(interaction, { 
        //        embeds: [errorEmbed("You need **Administrator** permission //to check login status.")]
        //    }).catch(logger.error);
        //    return;
        //}
    
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
                const OLarray = Object.entries(OLdict).map(([key, value]) => {
                const num = Number(value);
                const formatted = isNaN(num) ? String(value) : `${num.toFixed(2)}%`;
                return [formatFunctionDetails(key), formatted];
                });

                const armLine = formatEquipLine("Arm", units[0].arm_equip_lv, units, effects, [lines[0], lines[1], lines[2]]);
                const headLine = formatEquipLine("Head", units[0].head_equip_lv, units, effects, [lines[3], lines[4], lines[5]]);
                const legLine = formatEquipLine("Leg", units[0].leg_equip_lv, units, effects, [lines[6], lines[7], lines[8]]);
                const torsoLine = formatEquipLine("Torso", units[0].torso_equip_lv, units, effects, [lines[9], lines[10], lines[11]]);

                const overload2x2 =
                    `${headLine}    ${torsoLine}

                    ${armLine}    ${legLine}`;
                const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed

                const name  = getChoiceNameFromValue(intl_open_id);

                const embed = createEmbed({
                        title: `${name}'s ${getNameByCode(units[0].name_code)} Chara Details`,
                        description: ``,
                        color: getColor('success')
                    }).setThumbnail("https://static.dotgg.gg/nikke/characters/" + char_json.img + ".webp")
                        .addFields(
                            { 
                                name: "Basic Info", // invisible header 
                                value: `\`${formatTable2([
                                    ["Synchro-Level", units[0].lv],
                                    ["Combat Power", Number(units[0].combat).toLocaleString("en-US")],
                                    ["Bond", units[0].attractive_lv],
                                    ["Limit Break", getDups(units[0].grade + units[0].core)],
                                    ["Doll", getDollStats(units[0])],
                                    ["Skills", `${units[0].skill1_lv} / ${units[0].skill2_lv} / ${units[0].ulti_skill_lv}`]
                                ])}\n\``,
                                inline: false 
                            },
                            {
                                name: "Stats", // invisible header
                                value: `\`${formatTable2(OLarray)}\n\``,
                                inline: false
                            },
                            {
                                name: "**Overload Info**",
                                value: "",
                                inline: false
                            },
                            {
                                name: `Head (Lv${units[0].head_equip_lv})`,
                                value: formatEquipLine("Head", units[0].head_equip_lv, units, effects, [lines[3], lines[4], lines[5]]),
                                inline: true
                            },
                            {
                                name: `Torso (Lv${units[0].torso_equip_lv})`,
                                value: formatEquipLine("Torso", units[0].torso_equip_lv, units, effects, [lines[9], lines[10], lines[11]]),
                                inline: true
                            },
                            // *** ROW BREAK ***
                            {
                                name: "",
                                value: "",
                                inline: false
                            },
                            {
                                name: `Arm (Lv${units[0].arm_equip_lv})`,
                                value: formatEquipLine("Arm", units[0].arm_equip_lv, units, effects, [lines[0], lines[1], lines[2]]),
                                inline: true
                            },
                            {
                                name: `Leg (Lv${units[0].leg_equip_lv})`,
                                value: formatEquipLine("Leg", units[0].leg_equip_lv, units, effects, [lines[6], lines[7], lines[8]]),
                                inline: true
                            },
                            
                        );

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                }).catch(logger.error);
            }
        } catch (error) {
            logger.error("Error checking login status:", error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("An error occurred while trying to check login status. Please try again.")]
            }).catch(logger.error);
        }
    };