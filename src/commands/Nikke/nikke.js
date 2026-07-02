import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import fetch from "node-fetch";
import fetchCookie from "fetch-cookie";

const fetchWithCookies = fetchCookie(fetch);

const players = [
    {
        name: "Kaarako",
        link: "https://www.blablalink.com/shiftyspad?uid=MjkwODAtMzE2NjQ1MjQxNDgyMDQ4MTIyNA%3D%3D"
    }
]

// These MUST match browser requests exactly
const COMMON_HEADERS = {
    "content-type": "application/json",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://www.blablalink.com",
    "referer": "https://www.blablalink.com/",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "x-channel-type": "2",
    "x-language": "en",
    "x-common-params": JSON.stringify({
        game_id: "16",
        area_id: "global",
        source: "pc_web",
        intl_game_id: "29080",
        language: "en",
        env: "prod",
        data_statistics_scene: "outer",
        data_statistics_page_id: "https://www.blablalink.com/login?to=/&back_to=/",
        data_statistics_client_type: "pc_web",
        data_statistics_lang: "en"
    })
};

var token = "";

const nikkeBase = [
    { id: 203201, name_code: 5017, name: "Miranda", getol: true },
    { id: 235201, name_code: 5066, name: "Helm", getol: true },
    { id: 235301, name_code: 5098, name: "Helm: Aquamarine", getol: true },
    { id: 204301, name_code: 5110, name: "D: Killer Wife", getol: true },
    { id: 258001, name_code: 5122, name: "Phantom", getol: true },
    { id: 218301, name_code: 5127, name: "Maiden: Ice Rose", getol: true },
    { id: 201601, name_code: 5129, name: "Rapi: Red Hood", getol: true },
    { id: 235401, name_code: 5130, name: "Mast: Romantic Maid", getol: true },
    { id: 235501, name_code: 5131, name: "Anchor: Innocent Maid", getol: true },
    { id: 258101, name_code: 5140, name: "Arcana", getol: true },
    { id: 110201, name_code: 5001, name: "Maxwell", getol: true },
    { id: 108201, name_code: 5011, name: "Liter", getol: true },
    { id: 110101, name_code: 5024, name: "Drake", getol: true },
    { id: 111101, name_code: 1020, name: "Jackal", getol: true },
    { id: 110001, name_code: 1010, name: "Laplace", getol: true },
    { id: 145001, name_code: 5099, name: "Naga", getol: true },
    { id: 145101, name_code: 5100, name: "Tia", getol: true },
    { id: 119201, name_code: 5081, name: "Tove", getol: true },
    { id: 139101, name_code: 5077, name: "Ein", getol: true },
    { id: 140301, name_code: 5121, name: "Quency: Escape Queen", getol: true },
    { id: 129001, name_code: 1019, name: "Mana", getol: true },
    { id: 141201, name_code: 5134, name: "Trina", getol: true },
    { id: 116201, name_code: 5138, name: "Mihara: Bonding Chain", getol: true },
    { id: 150201, name_code: 5146, name: "Elegg: Boom and Shock", getol: true },
    { id: 321001, name_code: 5003, name: "Exia", getol: true },
    { id: 319101, name_code: 5004, name: "Alice", getol: true },
    { id: 327001, name_code: 5008, name: "Blanc", getol: true },
    { id: 327101, name_code: 5009, name: "Noir", getol: true },
    { id: 311201, name_code: 1022, name: "Viper", getol: true },
    { id: 339201, name_code: 5069, name: "Rei", getol: true },
    { id: 301501, name_code: 5097, name: "Anis: Sparkling Summer", getol: true },
    { id: 319401, name_code: 5103, name: "Ludmilla: Winter Owner", getol: true },
    { id: 338201, name_code: 5092, name: "Leona", getol: true },
    { id: 331401, name_code: 5113, name: "Soda: Twinkling Bunny", getol: true },
    { id: 328301, name_code: 5116, name: "Rosanna: Chic Ocean", getol: true },
    { id: 328401, name_code: 5117, name: "Sakura: Bloom in Summer", getol: true },
    { id: 327201, name_code: 5049, name: "Rouge", getol: true },
    { id: 352001, name_code: 5135, name: "Bready", getol: true },
    { id: 422001, name_code: 5012, name: "Snow White", getol: true },
    { id: 423101, name_code: 5013, name: "Isabel", getol: true },
    { id: 422201, name_code: 5041, name: "Scarlet", getol: true },
    { id: 426001, name_code: 5044, name: "Modernia", getol: true },
    { id: 423301, name_code: 5061, name: "Dorothy", getol: true },
    { id: 447001, name_code: 5101, name: "Red Hood", getol: true },
    { id: 422501, name_code: 5105, name: "Scarlet: Black Shadow", getol: true },
    { id: 433001, name_code: 5065, name: "Crown", getol: true },
    { id: 422601, name_code: 5123, name: "Rapunzel: Pure Grace", getol: true },
    { id: 451101, name_code: 5124, name: "Cinderella", getol: true },
    { id: 451401, name_code: 5125, name: "Grave", getol: true },
    { id: 451301, name_code: 5137, name: "Little Mermaid", getol: true },
    { id: 423401, name_code: 5145, name: "Dorothy: Serendipity", getol: true },
    { id: 580101, name_code: 5090, name: "Power", getol: true },
    { id: 581001, name_code: 5094, name: "2B", getol: true },
    { id: 581101, name_code: 5095, name: "A2", getol: true },
    { id: 582001, name_code: 5108, name: "Rem", getol: true },
    { id: 582101, name_code: 5109, name: "Emilia", getol: true },
    { id: 583001, name_code: 5118, name: "Asuka", getol: true },
    { id: 583101, name_code: 5119, name: "Rei", getol: true },
    { id: 583201, name_code: 5120, name: "Mari", getol: true },
    { id: 583501, name_code: 5133, name: "Asuka: WILLE", getol: true },
    { id: 583401, name_code: 5132, name: "Rei (Tentative Name)", getol: true },
    { id: 585001, name_code: 5142, name: "EVE", getol: true },
    { id: 585101, name_code: 5143, name: "Raven", getol: true },
    { id: 314301, name_code: 5150, name: "Blooming Bunny", getol: true },
    { id: 331501, name_code: 5151, name: "Ade: Agent Bunny", getol: true },
    { id: 422301, name_code: 5155, name: "Nayuta", getol: true },
    { id: 426201, name_code: 5156, name: "Liberalio", getol: true },
    { id: 17501,  name_code: 5159, name: "Diesel: Winter Sweets", getol: true },
    { id: 17301,  name_code: 5160, name: "Brid: Silent Track", getol: true },
    { id: 447101, name_code: 5161, name: "Snow White: Heavy Arms", getol: true },
    { id: 231501, name_code: 5163, name: "Velvet", getol: true },
    { id: 328101, name_code: 1021, name: "Moran", getol: true},
    { id: 217001, name_code: 5007, name: "Privaty", getol: true},
    { id: 239001, name_code: 5088, name: "Zwei", getol: true},
    { id: 108001, name_code: 5021, name: "Centi", getol: true},
    { id: 586001, name_code: 5164, name: "Chisat", getol: true},
    { id: 586101, name_code: 5165, name: "Takina", getol: true},
    { id: 301701, name_code: 5169, name: "Anis", getol: true },
    { id: 101801, name_code: 5170, name: "Neon", getol: true },
    { id: 360001, name_code: 5172, name: "Mint", getol: true },
];

async function clogin() {
    var response = await fetchWithCookies("https://api.blablalink.com/api/user/CheckLogin", {
        method: "POST",
        headers: { 
            ...COMMON_HEADERS,
            "x-token": token
        }
    });
    const res = await response.json();

    //console.log("CheckLogin Headers:", response.headers.raw());

    return res;
}

async function login() {
    var response = await fetchWithCookies("https://api.blablalink.com/api/user/Login", {
        method: "POST",
        headers: COMMON_HEADERS,
        body: JSON.stringify({
            game_openid:"16338490109246680481",
            game_channelid:131,
            game_token:"34d5f9dcf73ccfe137eab4612a47a83801796841",
            game_id:"29080",
            game_expire_time:1785623494,
            game_uid:"1818698667806006",
            game_user_name:"Player_jddztnHq",
            game_user_region:"704",
            game_adult_status:1,
            game_email:"niikke900@gmail.com"
        }),
        credentials: "include"
    });
    const res = await response.json();

    //console.log("Login Headers:", response.headers.raw());
    //console.log("Login Set-Cookie:", response.headers.raw()["set-cookie"]);

    if (!response.headers.raw()["set-cookie"]) {
        throw new Error("Login failed: No cookies received");
    }

    token = res.data?.token;
    return res;
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

async function getUnitDetails(listofnikkeids, uid) {
    var response = await fetchWithCookies("https://api.blablalink.com/api/game/proxy/Game/GetUserCharacterDetails", {
        method: "POST",
        body: JSON.stringify({
            intl_open_id: "16338490109246680481",
            name_codes: [5170],
            nikke_area_id: 84
        }),
        headers: {
            ...COMMON_HEADERS,
            "x-token": token
        }
    });
    const res = await response.json();
    
    console.log("getUnitDetails Headers:", response.headers.raw());
    console.log("getUnitDetails JSON:", res);

    const units = res.data.character_details,
        effects = res.data.state_effects;
    const lines = ["arm_equip_option1_id", "arm_equip_option2_id", "arm_equip_option3_id", "head_equip_option1_id", "head_equip_option2_id", "head_equip_option3_id", "leg_equip_option1_id", "leg_equip_option2_id", "leg_equip_option3_id", "torso_equip_option1_id", "torso_equip_option2_id", "torso_equip_option3_id"];

    const OLedUnits = units.map(nikke => {
        const gear = [];
        var gears = [];
        var gearItem = [];

        var count = 0;
        lines.forEach(line => {
            count++;
            if (!nikke[line]) return;
            
            const effect = effects.find(e => e.id == nikke[line]);
            if (effect) gear.push(effect);
            gearItem.push({line: effect});
            console.log(gearItem);

            if (count > 2) {
                count = 0;
                gears.push(gearItem);
                gearItem = [];
            }
        });
        console.log(gears);
        var OLdict = {};
        extractOLvalue(gear, OLdict);
        return {
            name_code: nikke.name_code,
            ol: OLdict,
            skillz: `${nikke.skill1_lv}|${nikke.skill2_lv}|${nikke.ulti_skill_lv}`,
            skill1: nikke.skill1_lv,
            skill2: nikke.skill2_lv,
            skill_burst: nikke.ulti_skill_lv,
            dups: getDups(nikke.grade + nikke.core),
            bond: nikke.attractive_lv,
            doll: getDollStats(nikke),
            gears: gears
        };
    });
    return OLedUnits;
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
                var lg = await login();
                //console.log(lg);

                //var clg = await clogin();
                //console.log(clg);

                var units = await getUnitDetails(1, 1);
                console.log(units);
                console.log(units[0].ol);
                console.log(units[0].gears);

                const embed = new createEmbed()
                .setColor(0x00AEEF)
                .setTitle('Neon: Vision Eye')
                .setDescription('Test')
                //.setThumbnail('https://tse2.mm.bing.net/th/id/OIP.CCAX0VqoevWmHKG1Nul7gQAAAA?rs=1&pid=ImgDetMain&o=7&rm=3')
                .addFields(
                    {
                    name: '',
                    value: [
                        '**Bond:** '+ units[0].bond,
                        '**LB:** '+ units[0].dups,
                        '**Skills:** '+ units[0].skillz,
                        '**Doll:** ' + units[0].doll,
                        '**Cube:** Quantum 8 | None',
                        '**CP:** 385,288 | 371,714'
                    ].join('\n'),
                    inline: false
                    },
                    {
                    name: '',
                    value: [
                        '**ELE:** '+ units[0].ol.IncElementDmg +' | **ATK:** '+ units[0].ol.StatAtk +' | **Max Ammo:** 0.00',
                        '**Hit Rate:** 0.00% | **Crit Rate:** 0.00% | **Crit DMG:** '+ units[0].ol.StatCriticalDamage +'%',
                        '**DEF:** 0.00% | **Charge Speed:** '+ units[0].ol.StatChargeTime +'% | **Charge DMG:** 0.00%'
                    ].join('\n'),
                    inline: false
                    },
                    {
                    name: '',
                    value: [
                        'Head (5): **ELE** 15.15% | **ATK** 6.18% | **Charge Speed** 4.04%',
                        'Chest (5): **ELE** 24.96% | **ATK** 4.77% | **Charge Speed** 2.57%',
                        'Gloves (5): **Charge Speed** 1.98% | **Max Ammo** 64.82% | **ELE** 9.54%',
                        'Boots (5): **ATK** 5.47% | **Charge Speed** 3.16% | **ELE** 12.34%'
                    ].join('\n'),
                    inline: false
                    },
                    {
                    name: '',
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

