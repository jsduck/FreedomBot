import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import { handleLogin, handleCheckLogin } from './modules/nikke_login.js';
import { handleFetchApi } from './modules/nikke_api.js';

import { handleCharacterByName } from './modules/nikke_gg.js';
import { handleUserCharacter } from './modules/nikke_character.js';
import { handleGuildDetails, handleGuildMembers } from './modules/nikke_guild.js';
import { handleUnionRaidData, handleUnionRaidLevelData, handleUnionRaidDataOfGuildSeason, handleUnionRaidLevelDataOfGuildSeason } from './modules/nikke_guild.js';
import { handleQueryGuildCardList } from './modules/nikke_guild.js';
import { handleGetMyGuildInfo, handleGetUserDailyContentsProgress, handleGetUserProfileOutpostInfo, handleGetUserProfileBasicInfo, handleGetUserGameInfo, handleGetUserCharacters, handleGetUserProfile, handleSearchUser } from './modules/nikke_user.js';

export default {
    data: new SlashCommandBuilder()
        .setName("nikke")
        .setDescription("Nikke commands.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("login")
                .setDescription("Generate login token for Nikke API")
            )
        .addSubcommand(subcommand =>
            subcommand
                .setName("checklogin")
                .setDescription("Check login status for Nikke API")
            )
        .addSubcommand(subcommand =>
            subcommand
                .setName("fetch-api")
                .setDescription("Direct API call to Nikke API")
                .addStringOption(option =>
                    option
                        .setName("endpoint")
                        .setDescription("The API endpoint to call")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("method")
                        .setDescription("The HTTP method to use")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("payload")
                        .setDescription("The payload for the API request")
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("character")
                .setDescription("Get character info from NikkeGG API")
                .addStringOption(option =>
                    option
                        .setName("name")
                        .setDescription("Nikke name, no spaces")
                        .setRequired(true)   
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("user-character")
                .setDescription("Get character info from Nikke API for a specific user")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch character info for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("name_codes")
                        .setDescription("Nikke name codes")
                        .setRequired(true)   
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("guild-details")
                .setDescription("Get guild details from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Avaricia", value: 25471 }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("guild-members")
                .setDescription("Get guild members from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Avaricia", value: 25471 }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-data")
                .setDescription("Get union raid data from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Avaricia", value: 25471 }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch character info for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-level-data")
                .setDescription("Get union raid level data from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Avaricia", value: 25471 }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch character info for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-data-of-guild-season")
                .setDescription("Get union raid data of a guild season from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Avaricia", value: 25471 }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("season_id")
                        .setDescription("ID of the season to fetch union raid data for")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("area_id")
                        .setDescription("Area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-level-data-of-guild-season")
                .setDescription("Get union raid level data of a guild season from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Avaricia", value: 25471 }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("season_id")
                        .setDescription("ID of the season to fetch union raid data for")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("area_id")
                        .setDescription("Area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("query-guild-card-list")
                .setDescription("Query the guild card list from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("cursor")
                        .setDescription("Cursor for pagination")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("guild_rank")
                        .setDescription("Guild rank filter")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("guild_rank_num")
                        .setDescription("Guild rank number filter")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("keyword")
                        .setDescription("Keyword filter")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("page_size")
                        .setDescription("Number of results per page")
                        .setRequired(false)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("my-guild-info")
                .setDescription("Get my guild info from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch guild info for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("user-daily-contents-progress")
                .setDescription("Get user daily contents progress from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch daily contents progress for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("get-user-profile-outpost-info")
                .setDescription("Get user profile outpost info from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch profile outpost info for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("get-user-profile-basic-info")
                .setDescription("Get user profile basic info from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch profile basic info for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("get-user-game-info")
                .setDescription("Get user game info from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch game info for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("get-user-characters")
                .setDescription("Get user characters from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch characters for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(
                            { name: "global", value: 84 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("get-user-profile")
                .setDescription("Get user profile from Nikke API")
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch profile for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Kaarako", value: "3166452414820481224" },
                            { name: "Demi", value: "16338490109246680481" },
                            { name: "Shaito", value: "12167197956671690221" },
                            { name: "Fizix", value: "5877343215992272387" },
                            { name: "Jae", value: "15097183441877165889" },
                            { name: "Effelon", value: "16338490109246680481" },
                            { name: "Fesha", value: "12816795455667592937" },
                            { name: "Nelex", value: "1175532717634698043" }                 
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("search-user")
                .setDescription("Search for a user in Nikke API")
                .addIntegerOption(option =>
                    option
                        .setName("limit")
                        .setDescription("Maximum number of users to return")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("next_page_cursor")
                        .setDescription("Cursor for the next page of results")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("user_name")
                        .setDescription("Name of the user to search for")
                        .setRequired(false)
                )
            )
        , async execute(interaction, client) {
            const subcommand = interaction.options.getSubcommand();
            
            try {
                switch (subcommand) {
                    case "login":
                        await handleLogin(interaction, client);
                        break;
                    case "checklogin":
                        await handleCheckLogin(interaction, client);
                        break;
                    case "fetch-api":
                        await handleFetchApi(interaction, client);
                        break;
                    case "character":
                        await handleCharacterByName(interaction, client);
                        break;
                    case "user-character":
                        await handleUserCharacter(interaction, client);
                        break;
                    case "guild-details":
                        await handleGuildDetails(interaction, client);
                        break;
                    case "guild-members":
                        await handleGuildMembers(interaction, client);
                        break;
                    case "union-raid-data":
                        await handleUnionRaidData(interaction, client);
                        break;
                    case "union-raid-level-data":
                        await handleUnionRaidLevelData(interaction, client);
                        break;
                    case "union-raid-data-of-guild-season":
                        await handleUnionRaidDataOfGuildSeason(interaction, client);
                        break;
                    case "union-raid-level-data-of-guild-season":
                        await handleUnionRaidLevelDataOfGuildSeason(interaction, client);
                        break;
                    case "query-guild-card-list":
                        await handleQueryGuildCardList(interaction, client);
                        break;
                    case "my-guild-info":
                        await handleGetMyGuildInfo(interaction, client);
                        break;
                    case "user-daily-contents-progress":
                        await handleGetUserDailyContentsProgress(interaction, client);
                        break;
                    case "get-user-profile-outpost-info":
                        await handleGetUserProfileOutpostInfo(interaction, client);
                        break;
                    case "get-user-profile-basic-info":
                        await handleGetUserProfileBasicInfo(interaction, client);
                        break;
                    case "get-user-game-info":
                        await handleGetUserGameInfo(interaction, client);
                        break;
                    case "get-user-characters":
                        await handleGetUserCharacters(interaction, client);
                        break;
                    case "get-user-profile":
                        await handleGetUserProfile(interaction, client);
                        break;
                    case "search-user":
                        await handleSearchUser(interaction, client);
                        break;
                    default:
                        await InteractionHelper.safeReply(interaction, {
                            embeds: [errorEmbed("Unknown subcommand.")],
                            flags: MessageFlags.Ephemeral
                        }).catch(logger.error);
                }
            } catch (error) {
                logger.error(`Error in Nikke ${subcommand}:`, error);
            
                const errorEmbedMsg = createEmbed({ 
                    title: "❌ Error", 
                    description: "An error occurred while processing your request.",
                    color: getColor('error')
                });

                if (!interaction.replied && !interaction.deferred) {
                    await InteractionHelper.safeReply(interaction, { embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
                } else {
                    await interaction.followUp({ embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
                }
            }
                
        }

}

