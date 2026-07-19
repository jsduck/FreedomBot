import { getColor } from '../../../config/bot.js';
import { createEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { createError, ErrorTypes } from '../../../utils/errorHandler.js';
import { getUserCharacterCache, upsertUserCharacterCache, getNikkeAccountByOpenId, getNikkeUnionById } from '../../../utils/database.js';
import { getUserCharacterDetails, getCharacterByName, getNameCodeByName, getNameByCode } from '../../../services/nikke.js';
import { ButtonStyle, ActionRowBuilder, ButtonBuilder } from 'discord.js';

function getFunctionDetailsById(json, id) {
  const effect = json.state_effects.find(e => String(e.id) === String(id));
  return effect ? effect.function_details : null;
}

function getDups(dups) {
    switch (dups) {
        case 0:
        case 1:
        case 2:
            return `⭐`.repeat(dups);
        case 3:
            return `⭐⭐⭐`;
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

function getCubeStats(rawNikke) {
    switch (rawNikke.harmony_cube_tid) {
        case 1000303:
            return `Resilience Lv ${rawNikke.harmony_cube_lv}`;
        case 1000304:
            return `Bastion Lv ${rawNikke.harmony_cube_lv}`;
        default:
            return `${rawNikke.harmony_cube_tid} Lv ${rawNikke.harmony_cube_lv}`;
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

    return rows
        .map((r) => `${r.type} (${r.lvl}): \`${r.val}\``)
        .join("\n");
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
        .map(([field, value]) => `${field}: \`${value}\``)
    .join("\n");
}

function formatCacheTimestamp(value) {
    if (!value) {
        return 'unknown';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'unknown';
    }

    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function formatCurrentTimestamp() {
    return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

function formatDataSource(source) {
    return source || 'unknown';
}

function resolveSynchroLevelFromOutpost(account, fallbackLevel) {
    const outpost = account?.outpost_info;

    if (outpost && typeof outpost === 'object') {
        const parsed = Number(outpost.synchro_level);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    if (typeof outpost === 'string') {
        try {
            const parsedOutpost = JSON.parse(outpost);
            const parsed = Number(parsedOutpost?.synchro_level);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        } catch {
            // Ignore parse errors and use fallback.
        }
    }

    return fallbackLevel;
}

export const USER_CHARACTER_UPDATE_BUTTON_ID = 'nikke_user_character_update';

function slug(value) {
    return String(value)
        .toLowerCase()
        .replace(/[:]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

export function buildUserCharacterComponents(intlOpenId, nameCode) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${USER_CHARACTER_UPDATE_BUTTON_ID}:${intlOpenId}:${nameCode}`)
                .setLabel('Update')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary)
        )
    ];
}

export async function buildUserCharacterView(client, intlOpenId, nameCodes, { refresh = false } = {}) {
    const nameCode = getNameCodeByName(nameCodes);

    if (!nameCode) {
        throw createError(
            `Unknown Nikke character: ${nameCodes}`,
            ErrorTypes.VALIDATION,
            `I could not find a Nikke character matching "${nameCodes}".`,
            { expected: true },
        );
    }

    const characterResponse = await getCharacterByName(slug(nameCodes));
    const charJson = await characterResponse.json();

    let payload = null;
    let cacheRecord = null;
    let dataSource = refresh ? 'Live API (forced refresh)' : 'Database cache';
    if (!refresh) {
        cacheRecord = await getUserCharacterCache(client, intlOpenId, nameCode);
        payload = cacheRecord?.data ?? cacheRecord;
    }

    if (!payload) {
        dataSource = 'Live API';
        const response = await getUserCharacterDetails(intlOpenId, [nameCode]);
        if (!response.ok) {
            throw createError(
                `Failed to fetch Nikke user character details for ${intlOpenId}/${nameCode}`,
                ErrorTypes.NETWORK,
                'I could not reach the Nikke API right now. Please try again in a moment.',
            );
        }

        payload = await response.json();
        await upsertUserCharacterCache(client, intlOpenId, nameCode, payload);
        cacheRecord = await getUserCharacterCache(client, intlOpenId, nameCode);
    }

    const units = payload.data.character_details;
    const effects = payload.data.state_effects;
    const lines = ["arm_equip_option1_id", "arm_equip_option2_id", "arm_equip_option3_id", "head_equip_option1_id", "head_equip_option2_id", "head_equip_option3_id", "leg_equip_option1_id", "leg_equip_option2_id", "leg_equip_option3_id", "torso_equip_option1_id", "torso_equip_option2_id", "torso_equip_option3_id"];

    const gear = [];
    lines.forEach(line => {
        if (!units[0][line]) return;
        const effect = effects.find(e => e.id == units[0][line]);
        if (effect) gear.push(effect);
    });

    const OLdict = {};
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
    const account = await getNikkeAccountByOpenId(client, intlOpenId);
    const union = await getNikkeUnionById(client, account?.union_id);
    const unionName = union?.name || 'UNION';
    const synchroLevel = resolveSynchroLevelFromOutpost(account, units[0].lv);

    const embed = createEmbed({
            title: `[${unionName}] ${account?.name ?? intlOpenId}'s ${getNameByCode(units[0].name_code)}`,
            description: '',
            color: getColor('success')
        }).setThumbnail("https://static.dotgg.gg/nikke/characters/" + charJson.img + ".webp");

    embed.addFields(
                { 
                    name: "Basic Info",
                    value: `${formatTable2([
                        ["Synchro-Level", synchroLevel],
                        ["Combat Power", Number(units[0].combat).toLocaleString("en-US")],
                        ["Bond", units[0].attractive_lv],
                        ["Limit Break", getDups(units[0].grade + units[0].core)],
                        ["Doll", getDollStats(units[0])],
                        ["Skills", `${units[0].skill1_lv} / ${units[0].skill2_lv} / ${units[0].ulti_skill_lv}`],
                        ["Cube", getCubeStats(units[0])],
                    ])}`,
                    inline: false 
                },
                {
                    name: "Stats",
                    value: `${formatTable2(OLarray)}`,
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
                {
                    name: "Data Source",
                    value: `Source: ${formatDataSource(dataSource)}\nFetched at: ${formatCurrentTimestamp()}\nUpdated at: ${formatCacheTimestamp(cacheRecord?.updated_at)}`,
                    inline: false
                }
            );

    return {
        embed,
        components: buildUserCharacterComponents(intlOpenId, nameCode),
    };
}

export async function handleUserCharacter(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error('Failed to defer reply:', error);
        return;
    }

    const intl_open_id = interaction.options.getString('intl_open_id');
    const name_codes = interaction.options.getString('name_codes');
    const response = await buildUserCharacterView(client, intl_open_id, name_codes);

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [response.embed],
        components: response.components,
    });
}