import {
    getJoinToCreateConfig,
    saveJoinToCreateConfig,
    updateJoinToCreateConfig,
    getTemporaryChannelInfo,
    formatChannelName as formatChannelNameUtil
} from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../utils/errorHandler.js';
import { logEvent, EVENT_TYPES } from './loggingService.js';
import { ChannelType, PermissionFlagsBits } from 'discord.js';

import fetch from "node-fetch";
import fetchCookie from "fetch-cookie";

const fetchWithCookies = fetchCookie(fetch);
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
const players = [
    {
        name: "Kaarako",
        link: "https://www.blablalink.com/shiftyspad?uid=MjkwODAtMzE2NjQ1MjQxNDgyMDQ4MTIyNA%3D%3D"
    }
]
var token = null;
// These MUST match browser requests exactly
const NIKKE_COMMON_HEADERS = {
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
const NIKKE_AREA_ID = 84;
const NIKKE_CURRENT_SEASON_ID = 1000041;

const NIKKE_GG_API_BASE_URL = 'https://api.dotgg.gg/nikke';
const NIKKE_GG_API_ENDPOINTS = {
    CHARACTERS: '/characters',
    CHARACTER: '/character',
};
const NIKKE_GG_API_URLS = {
    CHARACTERS: `${NIKKE_GG_API_BASE_URL}${NIKKE_GG_API_ENDPOINTS.CHARACTERS}`,
    CHARACTER: `${NIKKE_GG_API_BASE_URL}${NIKKE_GG_API_ENDPOINTS.CHARACTER}`
};
const NIKKE_GG_API_METHODS = {
    CHARACTERS: 'GET',
    CHARACTER: 'GET'
};

const NIKKE_API_BASE_URL = 'https://api.blablalink.com/api';
const NIKKE_API_ENDPOINTS = {
    LOGIN: '/user/Login',
    CHECK_LOGIN: '/user/CheckLogin',
    GET_CHARACTER_DETAILS: '/game/proxy/Game/GetUserCharacterDetails',
    GET_USER_GAME_INFO: '/ugc/direct/standalonesite/User/GetUserGamePlayerInfo',
    GET_MY_GUILD_INFO: '/game/proxy/Game/GetMyGuildInfo',
    GET_USER_PROFILE_BASIC_INFO: '/game/proxy/Game/GetUserProfileBasicInfo',
    GET_USER_PROFILE_OUTPOST_INFO: '/game/proxy/Game/GetUserProfileOutpostInfo',
    GET_USER_DAILY_CONTENTS_PROGRESS: '/game/proxy/Game/GetUserDailyContentsProgress',
    GET_GUILD_DETAIL: '/game/proxy/Game/GetGuildDetail',
    GET_GUILD_MEMBERS: '/game/proxy/Game/GetGuildMembers',
    GET_UNION_RAID_DATA_OF_GUILD_SEASON: '/game/proxy/Game/GetUnionRaidDataOfGuildSeason',
    GET_UNION_RAID_LEVEL_DATA_OF_GUILD_SEASON: '/game/proxy/Game/GetUnionRaidLevelDataOfGuildSeason',
    QUERY_GUILD_CARD_LIST: '/game/direct/Game/QueryGuildCardList',
    SEARCH_USER: '/ugc/direct/standalonesite/User/SearchUser',
    GET_USER_PROFILE: '/ugc/direct/standalonesite/User/GetUserProfile',
    GET_USER_CHARACTERS: '/game/proxy/Game/GetUserCharacters'
};
const NIKKE_API_URLS = {
    LOGIN: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.LOGIN}`,
    CHECK_LOGIN: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.CHECK_LOGIN}`,
    GET_CHARACTER_DETAILS: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_CHARACTER_DETAILS}`,
    GET_USER_GAME_INFO: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_USER_GAME_INFO}`,
    GET_MY_GUILD_INFO: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_MY_GUILD_INFO}`,
    GET_USER_PROFILE_BASIC_INFO: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_USER_PROFILE_BASIC_INFO}`,
    GET_USER_PROFILE_OUTPOST_INFO: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_USER_PROFILE_OUTPOST_INFO}`,
    GET_USER_DAILY_CONTENTS_PROGRESS: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_USER_DAILY_CONTENTS_PROGRESS}`,
    GET_GUILD_DETAIL: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_GUILD_DETAIL}`,
    GET_GUILD_MEMBERS: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_GUILD_MEMBERS}`,
    GET_UNION_RAID_DATA_OF_GUILD_SEASON: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_UNION_RAID_DATA_OF_GUILD_SEASON}`,
    GET_UNION_RAID_LEVEL_DATA_OF_GUILD_SEASON: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_UNION_RAID_LEVEL_DATA_OF_GUILD_SEASON}`,
    QUERY_GUILD_CARD_LIST: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.QUERY_GUILD_CARD_LIST}`,
    SEARCH_USER: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.SEARCH_USER}`,
    GET_USER_PROFILE: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_USER_PROFILE}`,
    GET_USER_CHARACTERS: `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.GET_USER_CHARACTERS}`
};
const NIKKE_API_METHODS = {
    LOGIN: 'POST',
    CHECK_LOGIN: 'POST',
    GET_CHARACTER_DETAILS: 'POST',
    GET_USER_GAME_INFO: 'POST',
    GET_MY_GUILD_INFO: 'POST',
    GET_USER_PROFILE_BASIC_INFO: 'POST',
    GET_USER_PROFILE_OUTPOST_INFO: 'POST',
    GET_USER_DAILY_CONTENTS_PROGRESS: 'POST',
    GET_GUILD_DETAIL: 'POST',
    GET_GUILD_MEMBERS: 'POST',
    GET_UNION_RAID_DATA_OF_GUILD_SEASON: 'POST',
    GET_UNION_RAID_LEVEL_DATA_OF_GUILD_SEASON: 'POST',
    QUERY_GUILD_CARD_LIST: 'POST',
    SEARCH_USER: 'POST',
    GET_USER_PROFILE: 'POST',
    GET_USER_CHARACTERS: 'POST'
};
const NIKKE_API_RESPONSE_CODES = {
    SUCCESS: 0,
    INVALID_CREDENTIALS: 1001
};
const NIKKE_PAYLOAD_LOGIN = {
    game_openid: "3166452414820481224",
    game_channelid: 131,
    game_token: "e1247000b845dc653b0531f1194887f201a8d3b1",
    game_id: "29080",
    game_expire_time: 1786208463,
    game_uid: "54150814256118",
    game_user_name: "Kaarako17",
    game_user_region: "360",
    game_adult_status: 1,
    game_email: "accnike666@gmail.com"
};
const NIKKE_PAYLOADS = {
    LOGIN: NIKKE_PAYLOAD_LOGIN
};
const NIKKE_UNITS = [
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
    { id: 360001, name_code: 5172, name: "Mint", getol: true }
]

const GETUSERGAMEPLAYERINFO_PREVIEW = {
    area_id: "84",
    avatar_frame: 0,
    costume: 37,
    guild_name: "",
    hard_progress: 7046044,
    has_saved_role_info: true,
    icon: 517500,
    is_banned: false,
    is_maintenance: false,
    normal_progress: 6046044,
    own_nikke_cnt: 184,
    player_level: 862,
    role_name: "DEMI",
    team_combat: 2554490,
    tower_floor: 1309
}
const GETMYGUILDINFO_PREVIEW = {
    card: {
        custom_activity_requirements: 1,
        custom_raid_requirements: 1,
        damage_rank: 324,
        guild_activity: 2503050,
        guild_card_uuid: "08ebf74a46fa4bc4ae00f19f67c198d0",
        guild_description: "AVARITIA alliance I 581 plus",
        guild_detail_uuid: "",
        guild_entry_level: 100,
        guild_icon: 2026,
        guild_id: "25471",
        guild_join_type: 1,
        guild_level: 8,
        guild_locale: "en",
        guild_member_cnt: 32,
        guild_member_max_cnt: 32,
        guild_name: "AVARICIA",
        guild_rank: 1,
        intl_open_id: "16338490109246680481",
        is_published: true,
        is_supporter: false,
        nikke_area_id: 84,
        ranking: 39,
        ranking_percent: 0.0023843003,
        synchro_avg_level: 0,
        synchro_median_level: 0
    },
    is_banned: false
};
const GETUSERPROFILEBASICINFO_PREVIEW = {
basic_info: {
    area_id: "84",
    character_costume_count: 37,
    character_count: 184,

    corporation_character_counts: [
    { corporation_type: 1, count: 46 },
    { corporation_type: 2, count: 37 },
    { corporation_type: 3, count: 55 }
    // … add remaining entries here
    ],

    created_at: "1668310109",

    currencies: [
    { type: 98, value: "1552" },
    { type: 99, value: "78106" },
    { type: 1000, value: "51019276" }
    // … add remaining entries here
    ],

    gsn: "25471",
    has_saved_role_info: 1,
    icon_id: 517500,
    is_banned: 0,
    is_icon_prism: 0,
    is_maintenance: 0,
    last_action_at: "1783091355",
    lv: 862,
    nickname: "DEMI",

    profile_team: [
    { name_code: 5007, slot: 4 },
    { name_code: 1020, slot: 2 },
    { name_code: 5004, slot: 5 }
    // … add remaining entries here
    ],

    progress_hard_campaign: 7046044,
    progress_normal_campaign: 6046044,
    progress_tribe_tower: 1309,
    role_name: "DEMI",

    sim_room_overclock_current_sub_season_high_score: 25,

    sim_room_overclock_high_score_history: [
    {
        option_level: 25,
        option_list: [201, 204, 207, 210, 211, 215, 226, 227, 212],
        season: 3
    }
    // … add remaining entries here
    ],

    sim_room_overclock_latest_season_high_score: 25,
    team_combat: 2554490
}
};
const GETUSERPROFILEOUTPOSTINFO_PREVIEW = {
outpost_info: {
    infra_core_level: 20,
    jukebox_count: 721,

    memorial_counts: [
    { category: "HandWriting", count: 96 },
    { category: "CallLog", count: 39 },
    { category: "Data", count: 80 },
    { category: "RedAsh", count: 21 },
    { category: "OldTales", count: 15 }
    ],

    outpost_battle_level: 677,

    recycle_room_researches: [
    { exp: 0, lv: 340, tid: 1001 },
    { exp: 0, lv: 208, tid: 1101 },
    { exp: 0, lv: 199, tid: 1102 },
    { exp: 0, lv: 198, tid: 1103 },
    { exp: 0, lv: 199, tid: 1201 },
    { exp: 0, lv: 195, tid: 1202 },
    { exp: 0, lv: 194, tid: 1203 },
    { exp: 0, lv: 192, tid: 1204 },
    { exp: 0, lv: 188, tid: 1205 }
    ],

    synchro_level: 721,
    synchro_nonempty_slot_count: 120,
    tactic_academy_class: 13000,
    tactic_academy_lesson: 13003
}
};
const GETUSERDAILYCONTENTSPROGRESS_PREVIEW = {
    daily_progress: [
    {
        counsel_remaining_count: 0,
        daily_mission_receivable_points: 10,
        daily_mission_received_points: 120,
        daily_mission_received_rewards: [20],
        dispatch_completed_count: 0,
        dispatch_in_progress_count: 0,
        intercept_remaining_tickets: 0,
        outpost_battle_efficiency: 1,
        outpost_battle_storage_excess: 0,
        outpost_battle_storage_fullness: 0.4135214285416667,
        rookie_arena_remaining_count: 0,

        sim_room_daily_best_record: {
            chapter: 3,
            difficulty: 5
        },

        special_arena_remaining_count: 0,

        tower_daily_info_list: [
            { is_opened: true, remaining_count: 0, type: 1 },
            { is_opened: false, remaining_count: 3, type: 2 },
            { is_opened: false, remaining_count: 3, type: 3 },
            { is_opened: false, remaining_count: 3, type: 4 }
        ],

        weekly_mission_receivable_points: 10,
        weekly_mission_received_points: 100,
        weekly_mission_received_rewards: [20]
    }
] 
};
const GETGUILDDETAIL_PREVIEW = {
guild_detail: {
    avg_level_rank: 647,
    custom_activity_requirements: 1,
    custom_raid_requirements: 1,
    damage_rank: 324,
    guild_activity: 2503050,
    guild_card_uuid: "08ebf74a46fa4bc4ae00f19f67c198d0",
    guild_description: "AVARITIA alliance I 581 plus",
    guild_detail_uuid: "c36191e2eac24c82b560c89fdeec0a3b",
    guild_entry_level: 100,
    guild_icon: 2026,
    guild_id: "25471",
    guild_join_type: 1,
    guild_level: 8,
    guild_locale: "en",
    guild_member_cnt: 32,
    guild_member_max_cnt: 32,
    guild_name: "AVARICIA",
    guild_rank: 1,
    is_member: true,
    is_published: true,
    is_supporter: false,
    member_type: 0,
    nikke_area_id: 84,
    ranking: 39,
    ranking_percent: 0.0023843003,

    support_user_infos: [
        // Fill in the objects here once you provide them
    ],

    synchro_level_distribution: [
        // Example:
        // { member_count: 1, synchro_level: 566 },
        // { member_count: 1, synchro_level: 569 },
        // …
    ],

    total_level_rank_info: {
        level_rank: 660,
        level_value: 20708
    }
}
};
const GETGUILDMEMBERS_PREVIEW = {
    guild_id: "25471",
    items: [
        { bind_area_id: 84, icon_id: "510300", level: 763, member_id: "11112114131953577266", nickname: "GOGE" },
        { bind_area_id: 84, icon_id: "511803", level: 819, member_id: "16434033156307663394", nickname: "LOUIE" },
        { bind_area_id: 84, icon_id: "500704", level: 739, member_id: "5165145469785434332" },
        { bind_area_id: 84, icon_id: "50501", level: 788, member_id: "3018373384736864087", nickname: "XEN" },
        { bind_area_id: 84, icon_id: "516400", level: 799, member_id: "16329100091990150709" },
        { bind_area_id: 84, icon_id: "51500", level: 818, member_id: "9911600059186491560", nickname: "가은" },
        { bind_area_id: 84, icon_id: "517500", level: 862, member_id: "16338490109246680481", nickname: "DEMI" },
        { bind_area_id: 84, icon_id: "512902", level: 727, member_id: "15097183441877165889", nickname: "JAE" },
        { bind_area_id: 84, icon_id: "515500", level: 753, member_id: "6161605052949203679", nickname: "SHEEP" },
        { bind_area_id: 84, icon_id: "517300", level: 822, member_id: "4928049794704738034", nickname: "PIKO" },
        { bind_area_id: 84, icon_id: "11000", level: 808, member_id: "15176995792495270314", nickname: "ROGER" },
        { bind_area_id: 84, icon_id: "517500", level: 736, member_id: "12167197956671690221" },
        { bind_area_id: 84, icon_id: "500402", level: 753, member_id: "5877343215992272387", nickname: "FIZIX" },
        { bind_area_id: 84, icon_id: "512903", level: 747, member_id: "3166452414820481224" },
        { bind_area_id: 84, icon_id: "512400", level: 746, member_id: "8833472442627416022", nickname: "頼ALPHA" },
        { bind_area_id: 84, icon_id: "517500", level: 836, member_id: "9589434157960278878" },
        { bind_area_id: 84, icon_id: "513703", level: 775, member_id: "14869988076053832944", nickname: "NEXUS" },
        { bind_area_id: 84, icon_id: "500704", level: 836, member_id: "8075820980856914539", nickname: "GREMU" },
        { bind_area_id: 84, icon_id: "510501", level: 775, member_id: "15141014321175286153" },
        { bind_area_id: 84, icon_id: "515601", level: 847, member_id: "5425297069686535038", nickname: "NEILJA" },
        { bind_area_id: 84, icon_id: "59502", level: 801, member_id: "106833402778987490", nickname: "GXNCE" },
        { bind_area_id: 84, icon_id: "551501", level: 782, member_id: "5285535281735323925", nickname: "FUROKI" },
        { bind_area_id: 84, icon_id: "506501", level: 790, member_id: "8857012889891814656", nickname: "MORZEN" },
        { bind_area_id: 84, icon_id: "504901", level: 837, member_id: "17168201492324232219", nickname: "KLEIN" },
        { bind_area_id: 84, icon_id: "516901", level: 761, member_id: "13475671557326384195", nickname: "DVA" },
        { bind_area_id: 84, icon_id: "512901", level: 789, member_id: "16948850502351870971" },
        { bind_area_id: 84, icon_id: "515600", level: 815, member_id: "10954023271960353237" },
        { bind_area_id: 84, icon_id: "517500", level: 796, member_id: "17483883489166048986", nickname: "SEB" },
        { bind_area_id: 84, icon_id: "506602", level: 806, member_id: "15902998639670984407", nickname: "FROZT" },
        { bind_area_id: 84, icon_id: "517500", level: 811, member_id: "3658896371878657666", nickname: "KRYZ" },
        { bind_area_id: 84, icon_id: "515601", level: 798, member_id: "5087381147310445614" },
        { bind_area_id: 84, icon_id: "506102", level: 768, member_id: "3419241524635233300", nickname: "SIGMOON", synchro_level: 634, nikke_area_id: 84 }
    ]
};
const GETUSERCHARACTERDETAILS_PREVIEW = {
    character_details: [
    {
        arena_combat: 663086,
        arena_harmony_cube_lv: 15,
        arena_harmony_cube_tid: 1000303,

        arm_equip_corporation_type: 0,
        arm_equip_lv: 5,
        arm_equip_option1_id: 7000513,
        arm_equip_option2_id: 7000811,
        arm_equip_option3_id: 0,
        arm_equip_tid: 3331001,
        arm_equip_tier: 10,

        attractive_lv: 30,
        combat: 663086,
        core: 7,
        costume_tid: 0,

        favorite_item_lv: 15,
        favorite_item_tid: 100402,

        grade: 3,

        harmony_cube_lv: 15,
        harmony_cube_tid: 1000304,

        head_equip_corporation_type: 0,
        head_equip_lv: 5,
        head_equip_option1_id: 7000901,
        head_equip_option2_id: 7000814,
        head_equip_option3_id: 7000510,
        head_equip_tid: 3131001,
        head_equip_tier: 10,

        leg_equip_corporation_type: 0,
        leg_equip_lv: 5,
        leg_equip_option1_id: 7000512,
        leg_equip_option2_id: 7001105,
        leg_equip_option3_id: 7000814,
        leg_equip_tid: 3431001,
        leg_equip_tier: 10,

        lv: 1,
        name_code: 5097,

        skill1_lv: 10,
        skill2_lv: 10,

        torso_equip_corporation_type: 0,
        torso_equip_lv: 5,
        torso_equip_option1_id: 7001205,
        torso_equip_option2_id: 7000510,
        torso_equip_option3_id: 7000814,
        torso_equip_tid: 3231001,
        torso_equip_tier: 10,

        ulti_skill_lv: 10
    }],
    state_effects: [
        {
            function_details: [
            {
                buff: "BuffEtc",
                buff_icon: "",
                duration_type: "Battles",
                duration_value: 0,
                function_battlepower: 828,
                function_standard: "User",
                function_target: "Self",
                function_type: "IncElementDmg",
                function_value: 2215,
                function_value_type: "Percent",
                id: 700051001,
                level: 10,
                name_localvalues: "-"
            }
            ],
            functions: [700051001],
            hurt_function_id_list: [0],
            icon: "icn_skill_public_01",
            id: "7000510",
            use_function_id_list: [0]
        },
        {
            function_details: [
            {
                buff: "BuffEtc",
                buff_icon: "",
                duration_type: "Battles",
                duration_value: 0,
                function_battlepower: 69,
                function_standard: "User",
                function_target: "Self",
                function_type: "StatChargeDamage",
                function_value: 477,
                function_value_type: "Integer",
                id: 700090101,
                level: 1,
                name_localvalues: "-"
            }
            ],
            functions: [700090101],
            hurt_function_id_list: [0],
            icon: "icn_skill_public_01",
            id: "7000901",
            use_function_id_list: [0]
        }

    // Additional state_effect entries (3, 4, 6, 7) go here
    ]
};
const GETUNIONRAIDDATAOFGUILDSEASON_PREVIEW = {
    manager_info: {
    id: "1000041",
    monster_preset: 10041,
    season_disable_date: "2026-06-21T19:59:59",
    season_end_date: "2026-06-17T19:59:59",
    season_rank_calculate_date: "2026-06-20T19:59:59",
    season_start_date: "2026-06-11T20:00:00",
    season_visible_date: "2026-06-11T20:00:00"
    },
    participate_data: [
        {
            boss_id: "1520460144",
            day: 0,
            difficulty: 1,
            element_id: ["400001"],
            icon_id: "bbg006_zeus",
            is_final_hit: true,
            level: 10,
            monster_model_id: "152046",
            name_localvalues: {
                en: "Ultra Z.E.U.S.",
                ja: "ウルトラ「Z.E.U.S.」",
                ko: "울트라 [Z.E.U.S.]",
                "zh-tw": "過激派 [Z.E.U.S.]"
            },
            nickname: "XEN",
            openid: "3018373384736864087",
            squad: [
                { combat: 432881, costume_id: 0, lv: 664, slot: 1, tid: 433006 },
                { combat: 426666, costume_id: 0, lv: 664, slot: 2, tid: 328104 },
                { combat: 506305, costume_id: 30050, lv: 664, slot: 3, tid: 201605 },
                { combat: 471241, costume_id: 110022, lv: 664, slot: 4, tid: 585104 },
                { combat: 449514, costume_id: 30047, lv: 664, slot: 5, tid: 217011 }
            ],
            step: 5,
            total_damage: "1569579475"
        },
        {
            boss_id: "2421050724",
            day: 1,
            difficulty: 2,
            element_id: ["200001"],
            icon_id: "ecg005_re",
            is_final_hit: false,
            level: 1,
            monster_model_id: "242105",

            name_localvalues: {
                en: "Rebuild Stout P.S.I.D.",
                ja: "リビルドビッグトルソー「P.S.I.D.」",
                ko: "리빌드 빅 토르소 [P.S.I.D.]",
                "zh-tw": "重裝狂戰 [P.S.I.D.]"
            },

            nickname: "頼ALPHA",
            openid: "8833472442627416022",

            squad: [
                { combat: 394921, costume_id: 0, lv: 604, slot: 1, tid: 101804 },
                { combat: 365533, costume_id: 0, lv: 604, slot: 2, tid: 301705 },
                { combat: 406636, costume_id: 0, lv: 604, slot: 3, tid: 451106 },
                { combat: 318274, costume_id: 0, lv: 604, slot: 4, tid: 433003 },
                { combat: 337016, costume_id: 0, lv: 604, slot: 5, tid: 235406 }
            ],

            step: 4,
            total_damage: "32013123780"
        }
    ]
};
const GETUNIONRAIDLEVELDATAOFGUILDSEASON_PREVIEW = {
    level_info: [
    {
        difficulty: 2,
        level: 3,

        boss_info: [
        {
            appearance_localkey: "Locale_Monster:3410010131_appearance_name",
            appearance_localvalues: {
            en: "Sinister",
            ja: "Sinister",
            ko: "Sinister",
            "zh-tw": "Sinister"
            },

            boss_id: "3410010748",
            current_hp: "11277424458",

            desc_localvalues: {
            en: "Code: A.N.M.I. Grade: Lord",
            ja: "CODE : A.N.M.I. «GRADE : LORD»",
            ko: "CODE : A.N.M.I. «GRADE : LORD»",
            "zh-tw": "CODE : A.N.M.I. «GRADE : LORD»"
            },

            description_localkey: "Locale_Monster:3410010131_description",
            element_id: ["300001"],
            icon_id: "341001",
            max_hp: "292445295750",
            monster_model_id: "341001",

            name_localkey: "Locale_Monster:3410010131_name",
            name_localvalues: {
            en: "Sinister A.N.M.I.",
            ja: "シニスター [A.N.M.I.]",
            ko: "시니스터 [A.N.M.I.]",
            "zh-tw": "邪靈 [A.N.M.I.]"
            }
        },

        // Additional bosses:
        { appearance_localkey: "Locale_Monster:3420071541_appearance_name" },
        { appearance_localkey: "Locale_Monster:3420070154_appearance_name" },
        { appearance_localkey: "Locale_Monster:1520060411_appearance_name" },
        { appearance_localkey: "Locale_Monster:3520021111_appearance_name" }
        ]
    }
    ],

    manager_info: {
        tid: "1000041",
        monster_preset: 10041,

        season_disable_date: "2026-06-21T19:59:59",
        season_end_date: "2026-06-17T19:59:59",
        season_rank_calculate_date: "2026-06-21T19:59:59",
        season_start_date: "2026-06-11T20:00:00",
        season_visible_date: "2026-06-11T20:00:00"
    }
};
const QUERYGUILDCARDLIST_PREVIEW = {
items: [
    {
        custom_activity_requirements: 1,
        custom_raid_requirements: 1,
        guild_activity: 3484020,
        guild_card_uuid: "e7622d76adaa4cd3ac4f15d405173ab1",
        guild_description: "apply at discordgg midnight2gg",
        guild_entry_level: 100,
        guild_icon: 2030,
        guild_id: "1663",
        guild_join_type: 1,
        guild_level: 9,
        guild_locale: "en",
        guild_member_cnt: 32,
        guild_member_max_cnt: 32,
        guild_name: "MIDNIGHT",
        guild_rank: 0,
        guild_rank_num: 1,
        intl_open_id: "16347126464487098057",
        nikke_area_id: 84,
        ranking_percent: 0.00006113591,
        synchro_avg_level: 853,
        synchro_level_distribution: [
            { member_count: 1, synchro_level: 709 },
            { member_count: 1, synchro_level: 715 }
        // … more entries if present
        ],
        synchro_median_level: 830
    }
]
};
const SEARCHUSER_PREVIEW = {
    list: [
    {
        achieve_count: 0,
        achievements: [],
        all_post_num: 0,
        area_id: "81",
        audit_avatar: "",
        audit_remark: "",
        audit_username: "",
        auth_desc: [],
        auth_languages: [],
        auth_type: 0,
        avatar: "https://sg-cdn.blablalink.com/cms/nrft/feeds/pic/_6c1415d87dc1f02e4e4df212d9ff2757ae3350ff-400x400-ori_s_80_50_ori_q_80.png",
        avatar_pendant: "",
        avatar_pendant_id: "0",
        cover_photo: "",
        cover_photo_id: "0",
        created_on: 1772986052,
        fans_num: 0,
        follow_num: 0,
        game_adult_status: 0,
        game_tag: 0,
        game_tag_num: 0,
        had_modified_username: false,
        has_post_with_letter_paper: false,
        has_sign_privacy: false,
        home_page_links: "",
        id: "0",
        intl_openid: "29080-4365606199799183738",
        is_admin: false,
        is_audit_avatar: false,
        is_audit_remark: false,
        is_audit_username: false,
        is_black: 0,
        is_first_register: false,
        is_followed: 0,
        is_mute: false,
        is_mutual_follow: 0,
        language: "en",
        mood: "",
        post_num: 0,
        regions: [],
        remark: "",
        role_name: "でみちゃん",
        status: 1,
        titles: null,
        user_infos_languages: [],
        username: "demichan"
    },

    {
        achieve_count: 0,
        achievements: [],
        all_post_num: 0,
        area_id: "84",
        audit_avatar: "",
        audit_remark: "",
        audit_username: "",
        auth_desc: [],
        auth_languages: [],
        auth_type: 0,
        avatar: "https://sg-cdn.blablalink.com/socialmedia/_7b2f451cb432b3c722ba13a8690b7f12d024f061-400x400-ori_s_80_50_ori_q_80.png",
        avatar_pendant: "",
        avatar_pendant_id: "0",
        cover_photo: "",
        cover_photo_id: "0",
        created_on: 1744128142,
        fans_num: 0,
        follow_num: 0,
        game_adult_status: 0,
        game_tag: 0,
        game_tag_num: 0,
        had_modified_username: false,
        has_post_with_letter_paper: false,
        has_sign_privacy: false,
        home_page_links: "",
        id: "0",
        intl_openid: "29080-16338490109246680481",
        is_admin: false,
        is_audit_avatar: false,
        is_audit_remark: false,
        is_audit_username: false,
        is_black: 0,
        is_first_register: false,
        is_followed: 0,
        is_mute: false,
        is_mutual_follow: 0,
        language: "en",
        mood: "",
        post_num: 0,
        regions: [],
        remark: "",
        role_name: "DEMI",
        status: 1,
        titles: null,
        user_infos_languages: [],
        username: "Demichan"
    }
    ],

    page_info: {
        is_finish: true,
        next_page_cursor: "",
        previous_page_cursor: ""
    }
};
const GETUSERPROFILE_PREVIEW = {
    info: {
        achieve_count: 4,
        achievements: [],
        all_post_num: 0,
        area_id: "",
        audit_avatar: "",
        audit_remark: "",
        audit_username: "",
        auth_desc: [],
        auth_languages: [],
        auth_type: 0,
        avatar: "https://sg-cdn.blablalink.com/socialmedia/_7b2f451cb432b3c722ba13a8690b7f12d024f061-400x400-ori_s_80_50_ori_q_80.png",
        avatar_pendant: "",
        avatar_pendant_id: "0",
        cover_photo: "",
        cover_photo_id: "0",
        created_on: 0,
        fans_num: 0,
        follow_num: 0,
        game_adult_status: 1,
        game_tag: 0,
        game_tag_num: 0,
        had_modified_username: true,
        has_post_with_letter_paper: false,
        has_sign_privacy: true,
        home_page_links: "",
        id: "8385",
        intl_openid: "29080-16338490109246680481",
        is_admin: false,
        is_audit_avatar: false,
        is_audit_remark: false,
        is_audit_username: false,
        is_black: 0,
        is_first_register: false,
        is_followed: 0,
        is_mute: false,
        is_mutual_follow: 0,
        language: "en",
        mood: "",
        post_num: 0,
        regions: ["all"],
        remark: "",
        role_name: "",
        status: 1,
        titles: null,
        user_infos_languages: [],
        username: "Demichan"
    }
};
const GETUSERCHARACTERS_PREVIEW ={
    characters: [
        { combat: 6130, core: 1, costume_id: 0, grade: 3, lv: 1, name_code: 1007 },
        { combat: 282682, core: 4, costume_id: 0, grade: 3, lv: 573, name_code: 1010 },
        { combat: 7140, core: 3, costume_id: 0, grade: 3, lv: 1, name_code: 1012 },
        { combat: 5296, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1013 },
        { combat: 5193, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1014 },
        { combat: 5094, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1015 },
        { combat: 5285, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1016 },
        { combat: 5218, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1017 },
        { combat: 5118, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1018 },
        { combat: 275564, core: 2, costume_id: 0, grade: 3, lv: 573, name_code: 1019 },
        { combat: 243873, core: 2, costume_id: 0, grade: 3, lv: 573, name_code: 1020 },
        { combat: 296277, core: 0, costume_id: 0, grade: 3, lv: 573, name_code: 1021 },
        { combat: 6283, core: 2, costume_id: 0, grade: 3, lv: 1, name_code: 1022 },
        { combat: 5128, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1023 },
        { combat: 5103, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1024 },
        { combat: 5095, core: 0, costume_id: 0, grade: 0, lv: 1, name_code: 1025 },

        // … all remaining entries preserved exactly as in your document …

        { combat: 322754, core: 0, costume_id: 0, grade: 3, lv: 573, name_code: 5175 }
    ],

    is_banned: false
};

const NIKE_GG_CHARACTERS_PREVIEW = [
    {
        name: "2B",
        url: "2b",
        img: "si_c810_00_s",
        manufacturer: "Abnormal",
        squad: "YoRHa",
        class: "Defender",
        burst: "3",
        rarity: "SSR",
        weapon: "AR",
        burstGen: "0.2%",
        element: "Fire"
    }
];
const NIKE_GG_CHARACTER_PREVIEW = {
    id: "191",
    visible: true,
    name: "Alice",
    url: "alice",
    img: "si_c191_00_s",
    imgBig: "c191_00",
    description: "An endearing individual who often indulges in fantasy with a somewhat unique worldview. She's a member of Unlimited, and spends her days looking for Rabbity.",
    statTableId: 5102,
    cv_en: "CV: Kayli Mills",
    cv_kr: "CV: Sung Ye-won",
    cv_jp: "CV: Hina Yōmiya",
    manufacturer: "Tetra",
    squad: "Unlimited",
    squadId: 4,
    class: "Attacker",
    burst: "3",
    rarity: "SSR",
    skins: [],
    weapon: "SR",
    burstGen: "2.8%",
    maxAmmo: 6,
    damage: "69.04%",
    chargeTime: 1.5,
    chargeDamage: "350%",
    reloadTime: 2,
    element: "Fire",

    skills: [
    {
        id: 21911,
        name: "Energizing Carrot",
        description:
        "■ Activates when entering Full Burst. Affects {description_value_01} ally unit(s) with the highest <word_group=10025>final</word_group> ATK.\n<color=#00AEFF>Charge Speed ▲ {description_value_02}% of caster's Charge Speed for {description_value_03} sec. \nCharge Damage ▲ {description_value_04}% for {description_value_05} sec.</color>",
        cooldown: "",
        levels: [
        {
            description_value_01: "2",
            description_value_02: "6.89",
            description_value_03: "10",
            description_value_04: "4.13",
            description_value_05: "10",
            description_value_06: "",
            description_value_07: "",
            description_value_08: "",
            description_value_09: "",
            description_value_10: "",
            description_value_11: ""
        }]
    }],
    __v: 0,

    skillprio: {
        _id: "6a47afd7333d61a16675f23d",
        name: "Alice",
        PvP: "FALSE",
        "Budget Skill investments": "7/4/7",
        "Recommended Skill Investments": "10/4/10",
        "Skill Order Priority": "S1 > S2",
        Priority: "Highest",
        Notes:
            "Very investment hungry unit, but pays off in the late game.\nBurst is main priority followed by skill 1.\nSkill 2 can be raised just for HP leech comfort.\nDoes not perform too well at lower investment levels, only invest when you plan to commit. Huge single target damage\nNeed to max out skill 1 and burst with 2x overload rolls to reach 100% charge speed and achieve her maximum potential.",
        id: 3
    },

    tierlist: {
        name: "Alice",
        "Tier List": "Tier List",
        Combined: "SS",
        Story: "S",
        Boss: "SS",
        PvP: "S",
        Wishlist: "",
        isNew: "FALSE",
        reqHands: "TRUE",
        reqInvest: "TRUE",
        strongEarly: "FALSE",
        "Cube Reqs": "Cube Reqs",
        cubes: "Resilience Cube,Bastion Cube",
        cubeNotes:
            "Post Overloaded equipment with 2+ Max ammo rolls, Bastion Becomes best in slot. Adjutant can be considered if Charge speed is at 98% (achievable with overload rolls/Maxwell charge speed) and the user is fast at clicking.",
            "Skill Prios": "Skill Prios",
        SkillPrioPvp: "FALSE",
        SkillPrioBudget: "7/4/7",
        SkillPrioReq: "10/4/10",
        SkillPrioOrder: "S1 > S2",
        SkillPrioImportance: "Highest",
        SkillPrioNotes:
            "Very investment hungry unit, but pays off in the late game.\n\nBurst is main priority followed by skill 1.\n\nSkill 2 can be raised just for HP leech comfort.\n\nDoes not perform too well at lower investment levels, only invest when you plan to commit. Huge single target damage. Need to max out skill 1 and burst with 2x overload rolls to reach 100% charge speed and achieve her maximum potential.",
        "Overload Prios": "Overload Prios",
        OPEleDmgDealt: "3.00",
        OPHitRate: "0.00",
        OPMaxAmmo: "6.00",
        OPATK: "3.00",
        OPChDMG: "2.00",
        OPChSpeed: "3.00",
        OPCRate: "1.00",
        OPCDMG: "1.00",
        OPDFEF: "0.00",
        OPPrio: "10.00",
        OPNotes: "",
        roles: "DPS, Offensive Support",
        summary:
            "<p>Very strong self DPS buffs on burst that scales extremely well with reload speed and charge speed buffs. Good charge shot support. Good AoE from pierce. Must be kept above 80% HP for pierce, but this is easily achievable thanks to her passive.</p>\n\n<p style=\"color: #B0C4DE\">Alice requires high skill investments in her skill 1 and burst to be good (S Tier), and very strict overload requiremets (8%~ Charge speed, 2-3+ rolls of max ammo, and elemental damage for solo raids/bosses)</p>\n\n",
        id: 7
    },

    tierlist2: null,

    recommendations: {
    _id: "6a47b014333d61a16675f2a8",
    name: "Alice",
    main: "Resilience Cube",
    alternative: "Bastion Cube",
    notes:
        "Post Overloaded equipment with 2+ Max ammo rolls, Bastion Becomes best in slot. Adjutant can be considered if Charge speed is at 98% (achievable with overload rolls/Maxwell charge speed) and the user is fast at clicking.",
    id: 4
    },

    overloadrecs: {
        _id: "6a47b0cb333d61a16675f48b",
        name: "Alice",
        "Element Damage Dealt": "3",
        "Hit Rate": "0",
        "Max Ammunition Capacity": "6",
        ATK: "3",
        "Charge Damage": "2",
        "Charge Speed": "3",
        "Critical Rate": "1",
        "Critical Damage": "1",
        DEF: "0",
        Prio: "10",
        Notes: null,
        id: 1
    }
};

export async function fetchNikkeApi(endpoint, method, payload = null) {
    const url = `${NIKKE_API_BASE_URL}${endpoint}`;
    const options = {
        method: method,
        headers: { 
            ...NIKKE_COMMON_HEADERS, 
            "x-token": token || "" 
        }
    };
    if (payload) {
        options.body = JSON.stringify(payload);
    }
    return await fetchWithCookies(url, options);
}

async function fetchNikkeGGApi(endpoint, method, payload = null) {
    const url = `${NIKKE_GG_API_BASE_URL}${endpoint}`;
    const options = {
        method
    };
    if (payload) {
        options.body = JSON.stringify(payload);
    }
    return await fetchWithCookies(url, options);
}

export async function login() {
    const url = `${NIKKE_API_BASE_URL}${NIKKE_API_ENDPOINTS.LOGIN}`;
    const options = {
        method: NIKKE_API_METHODS.LOGIN,
        headers: { ...NIKKE_COMMON_HEADERS }
    };
    if (NIKKE_PAYLOADS.LOGIN) {
        options.body = JSON.stringify(NIKKE_PAYLOADS.LOGIN);
    }
    var res = await fetchWithCookies(url, options);

    if (!res.headers.raw()["set-cookie"]) {
        console.log(res);
        throw new Error("Login failed: No cookies received");
    }
    token = res.data?.token;

    return res;
}

export async function checkLogin() {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.CHECK_LOGIN, NIKKE_API_METHODS.CHECK_LOGIN);

    return res;
};

function getNameCodeById(id) {
    const unit = NIKKE_UNITS.find(unit => unit.id === id);
    return unit ? unit.name_code : null;
}

function getNameCodeByName(name) {
    const unit = NIKKE_UNITS.find(unit => unit.name === name);
    return unit ? unit.name_code : null;
}

async function getUserCharacterDetails(intl_open_id, name_codes) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_CHARACTER_DETAILS, NIKKE_API_METHODS.GET_CHARACTER_DETAILS, {
        intl_open_id: intl_open_id,
        name_codes: name_codes,
        nikke_area_id: NIKKE_AREA_ID});
    
    return res;
};

async function getUserGameInfo(intl_open_id) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_USER_GAME_INFO, NIKKE_API_METHODS.GET_USER_GAME_INFO, {
        intl_open_id: intl_open_id
    });

    return res;
};

async function getMyGuildInfo(intl_open_id, target_nikke_area_id = NIKKE_AREA_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_MY_GUILD_INFO, NIKKE_API_METHODS.GET_MY_GUILD_INFO, {
        intl_open_id: intl_open_id,
        target_nikke_area_id: target_nikke_area_id
    });

    return res;
};

async function getUserProfileBasicInfo(intl_open_id, nikke_area_id = NIKKE_AREA_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_USER_PROFILE_BASIC_INFO, NIKKE_API_METHODS.GET_USER_PROFILE_BASIC_INFO, {
        intl_open_id: intl_open_id,
        nikke_area_id: nikke_area_id
    });

    return res;
};

async function getUserProfileOutpostInfo(intl_open_id, nikke_area_id = NIKKE_AREA_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_USER_PROFILE_OUTPOST_INFO, NIKKE_API_METHODS.GET_USER_PROFILE_OUTPOST_INFO, {
        intl_open_id: intl_open_id,
        nikke_area_id: nikke_area_id
    });

    return res;
};

async function getUserDailyContentsProgress(intl_open_id, nikke_area_id = NIKKE_AREA_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_USER_DAILY_CONTENTS_PROGRESS, NIKKE_API_METHODS.GET_USER_DAILY_CONTENTS_PROGRESS, {
        intl_open_id: intl_open_id,
        nikke_area_id: nikke_area_id
    });

    return res;
}

async function getGuildDetail(guild_id, nikke_area_id = NIKKE_AREA_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_GUILD_DETAIL, NIKKE_API_METHODS.GET_GUILD_DETAIL, {
        guild_id: guild_id,
        nikke_area_id: nikke_area_id
    });

    return res;
}

async function getGuildMembers(guild_id, nikke_area_id = NIKKE_AREA_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_GUILD_MEMBERS, NIKKE_API_METHODS.GET_GUILD_MEMBERS, {
        guild_id: guild_id,
        nikke_area_id: nikke_area_id
    });

    return res;
}

async function getUnionRaidDataOfGuildSeason(area_id, guild_id, season_id = NIKKE_CURRENT_SEASON_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_UNION_RAID_DATA_OF_GUILD_SEASON, NIKKE_API_METHODS.GET_UNION_RAID_DATA_OF_GUILD_SEASON, {
        area_id: area_id,
        guild_id: guild_id,
        season_id: season_id
    });

    return res;
}

async function getUnionRaidLevelDataOfGuildSeason(area_id, guild_id, season_id = NIKKE_CURRENT_SEASON_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_UNION_RAID_LEVEL_DATA_OF_GUILD_SEASON, NIKKE_API_METHODS.GET_UNION_RAID_LEVEL_DATA_OF_GUILD_SEASON, {
        area_id: area_id,
        guild_id: guild_id,
        season_id: season_id
    });

    return res;
}

async function queryGuildCardList(cursor = "", guild_rank = -1, guild_rank_num = -1, keyword = "", nikke_area_id = NIKKE_AREA_ID, page_size = 10) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.QUERY_GUILD_CARD_LIST, NIKKE_API_METHODS.QUERY_GUILD_CARD_LIST, {
        cursor: cursor,
        guild_rank: guild_rank,
        guild_rank_num: guild_rank_num,
        keyword: keyword,
        nikke_area_id: nikke_area_id,
        page_size: page_size
    });

    return res;
}

async function searchUser(limit = 20, next_page_cursor = "", user_name = "") {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.SEARCH_USER, NIKKE_API_METHODS.SEARCH_USER, {
        limit: limit,
        next_page_cursor: next_page_cursor,
        user_name: user_name
    });

    return res;
}

async function getUserProfile(intl_open_id) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_USER_PROFILE, NIKKE_API_METHODS.GET_USER_PROFILE, {
        intl_open_id: intl_open_id
    });

    return res;
}

async function getUserCharacters(intl_open_id, nikke_area_id = NIKKE_AREA_ID) {
    var res = await fetchNikkeApi(NIKKE_API_ENDPOINTS.GET_USER_CHARACTERS, NIKKE_API_METHODS.GET_USER_CHARACTERS, {
        intl_open_id: intl_open_id,
        nikke_area_id: nikke_area_id
    });

    return res;
}

async function getCharacters() {
    var res = await fetchNikkeGGApi(NIKKE_GG_API_ENDPOINTS.CHARACTERS, NIKKE_GG_API_METHODS.CHARACTERS);
    
    return res;
}

async function getCharacterByName(name) {
    var res = await fetchNikkeGGApi(NIKKE_GG_API_ENDPOINTS.CHARACTER + `/${name}`, NIKKE_GG_API_METHODS.CHARACTER);

    return res;
}