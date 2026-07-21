import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

import { handleLogin, handleCheckLogin } from './modules/nikke_login.js';
import { handleFetchApi } from './modules/nikke_api.js';
import { handleCharacterByName } from './modules/nikke_gg.js';
import { handleUserCharacter } from './modules/nikke_character.js';
import { handleGuildDetails, handleGuildMembers } from './modules/nikke_guild.js';
import { handleUnionRaidData, handleUnionRaidLevelData, handleUnionRaidDataOfGuildSeason, handleUnionRaidLevelDataOfGuildSeason } from './modules/nikke_guild.js';
import { handleQueryGuildCardList } from './modules/nikke_guild.js';
import { handleAccountAdd, handleAccountDelete, handleAccountUpdate } from './modules/nikke_account.js';
import { handleAccountProgress, handleAccountProgressAdd, handleAccountProgressFetch, handleAccountProgressRemove } from './modules/nikke_progress.js';
import { handleUnionCounterDisable, handleUnionCounterEnable, handleUnionSetCounterChannel } from './modules/nikke_union_counter.js';
import { handleAccountProfile, handleCharactersUpdate, handleGetMyGuildInfo, handleGetUserCharacters, handleGetUserDailyContentsProgress, handleGetUserProfile, handleGetUserProfileBasicInfo, handleGetUserProfileOutpostInfo, handleSearchUser } from './modules/nikke_user.js';
import { getNikkeAccounts, getNikkeCharacters, getNikkeUnions } from '../../utils/database.js';

function truncateChoiceName(value, maxLength = 100) {
    return String(value || '').slice(0, maxLength);
}

function buildAccountAutocompleteChoices(accounts, query) {
    const normalizedQuery = String(query || '').toLowerCase();
    return accounts
        .filter((account) => {
            const name = String(account.name || '').toLowerCase();
            const openId = String(account.intl_open_id || '').toLowerCase();
            return !normalizedQuery || name.includes(normalizedQuery) || openId.includes(normalizedQuery);
        })
        .slice(0, 25)
        .map((account) => ({
            name: truncateChoiceName(`${account.name || 'Unknown'} (${account.intl_open_id})`),
            value: String(account.intl_open_id || ''),
        }));
}

function buildUnionAutocompleteChoices(unions, query) {
    const normalizedQuery = String(query || '').toLowerCase();
    return unions
        .filter((union) => {
            const name = String(union.name || '').toLowerCase();
            const unionId = String(union.union_id || '').toLowerCase();
            const area = String(union.area_id ?? '').toLowerCase();
            return !normalizedQuery || name.includes(normalizedQuery) || unionId.includes(normalizedQuery) || area.includes(normalizedQuery);
        })
        .slice(0, 25)
        .map((union) => ({
            name: truncateChoiceName(
                union.area_id !== null && union.area_id !== undefined
                    ? `${union.name} (${union.union_id}) Area ${union.area_id}`
                    : `${union.name} (${union.union_id})`
            ),
            value: String(union.union_id || ''),
        }));
}

function buildGuildIdAutocompleteChoices(unions, query) {
    const normalizedQuery = String(query || '').toLowerCase();
    return unions
        .map((union) => {
            const numericUnionId = Number.parseInt(String(union.union_id), 10);
            if (!Number.isInteger(numericUnionId)) {
                return null;
            }

            return {
                union,
                guildId: numericUnionId,
            };
        })
        .filter(Boolean)
        .filter(({ union, guildId }) => {
            const name = String(union.name || '').toLowerCase();
            const unionId = String(union.union_id || '').toLowerCase();
            const guildIdText = String(guildId);
            const area = String(union.area_id ?? '').toLowerCase();
            return !normalizedQuery || name.includes(normalizedQuery) || unionId.includes(normalizedQuery) || guildIdText.includes(normalizedQuery) || area.includes(normalizedQuery);
        })
        .slice(0, 25)
        .map(({ union, guildId }) => ({
            name: truncateChoiceName(
                union.area_id !== null && union.area_id !== undefined
                    ? `${union.name} (${guildId}) Area ${union.area_id}`
                    : `${union.name} (${guildId})`
            ),
            value: guildId,
        }));
}

function buildCharacterAutocompleteChoices(characters, query) {
    const normalizedQuery = String(query || '').toLowerCase();
    return characters
        .filter((character) => {
            const name = String(character.name || '').toLowerCase();
            const nameCode = String(character.name_code || '').toLowerCase();
            const id = String(character.id || '').toLowerCase();
            return !normalizedQuery || name.includes(normalizedQuery) || nameCode.includes(normalizedQuery) || id.includes(normalizedQuery);
        })
        .slice(0, 25)
        .map((character) => ({
            name: truncateChoiceName(`${character.name} (${character.name_code})`),
            value: String(character.name || ''),
        }));
}

export default {
    async data(client) {
        return new SlashCommandBuilder()
            .setName('nikke')
            .setDescription('Nikke commands.')
            .addSubcommandGroup(group =>
                group
                    .setName('account')
                    .setDescription('Manage Nikke accounts')
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('add')
                            .setDescription('Add a Nikke account if it does not already exist')
                            .addStringOption(option =>
                                option
                                    .setName('name')
                                    .setDescription('Display name for the account')
                                    .setRequired(true)
                            )
                            .addStringOption(option =>
                                option
                                    .setName('account_input')
                                    .setDescription('Account link or raw string containing openid=')
                                    .setRequired(true)
                            )
                            .addStringOption(option =>
                                option
                                    .setName('discord_tag')
                                    .setDescription('Discord mention, user ID, or tag for reminder pings (optional)')
                                    .setRequired(false)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('update')
                            .setDescription('Update the union id for an existing Nikke account')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('Account open id')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                            .addStringOption(option =>
                                option
                                    .setName('union_id')
                                    .setDescription('New union id for the account')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('delete')
                            .setDescription('Delete a Nikke account from the database')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('Account open id')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('profile')
                            .setDescription('Get account profile from Nikke API')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the user to fetch profile for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('basic')
                            .setDescription('Get user profile basic info from Nikke API')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the user to fetch profile basic info for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('outpost')
                            .setDescription('Get user profile outpost info from Nikke API')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the user to fetch profile outpost info for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('daily')
                            .setDescription('Get user daily contents progress from Nikke API')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the user to fetch daily contents progress for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
            )
            .addSubcommandGroup(group =>
                group
                    .setName('union')
                    .setDescription('Union automation commands')
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('counter-enable')
                            .setDescription('Enable reminder checks for a union')
                            .addStringOption(option =>
                                option
                                    .setName('union_id')
                                    .setDescription('Union to monitor')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('counter-disable')
                            .setDescription('Disable reminder checks for a union')
                            .addStringOption(option =>
                                option
                                    .setName('union_id')
                                    .setDescription('Union to stop monitoring')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('set-counter-channel')
                            .setDescription('Set the channel where union reminder pings are sent')
                            .addStringOption(option =>
                                option
                                    .setName('union_id')
                                    .setDescription('Union to configure')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                            .addChannelOption(option =>
                                option
                                    .setName('channel')
                                    .setDescription('Channel to send reminder pings in')
                                    .setRequired(true)
                                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                            )
                    )
            )
            .addSubcommandGroup(group =>
                group
                    .setName('progress')
                    .setDescription('Progress cache commands')
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('view')
                            .setDescription('Get account progress from the database')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the account to fetch progress for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('fetch')
                            .setDescription('Fetch latest account progress and store it in the database')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the account to fetch progress for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('add')
                            .setDescription('Manually add or update an account progress entry')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the account to add progress for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                            .addBooleanOption(option =>
                                option
                                    .setName('tracked')
                                    .setDescription('Whether this account progress should be tracked')
                                    .setRequired(false)
                            )
                    )
                    .addSubcommand(subcommand =>
                        subcommand
                            .setName('remove')
                            .setDescription('Manually remove an account progress entry')
                            .addStringOption(option =>
                                option
                                    .setName('intl_open_id')
                                    .setDescription('OpenID of the account to remove progress for')
                                    .setRequired(true)
                                    .setAutocomplete(true)
                            )
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('login')
                    .setDescription('Generate login token for Nikke API')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('checklogin')
                    .setDescription('Check login status for Nikke API')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('fetch-api')
                    .setDescription('Direct API call to Nikke API')
                    .addStringOption(option =>
                        option
                            .setName('endpoint')
                            .setDescription('The API endpoint to call')
                            .setRequired(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('method')
                            .setDescription('The HTTP method to use')
                            .setRequired(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('payload')
                            .setDescription('The payload for the API request')
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('character')
                    .setDescription('Get character info from NikkeGG API')
                    .addStringOption(option =>
                        option
                            .setName('name')
                            .setDescription('Nikke name, no spaces')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('user-character')
                    .setDescription('Get character info from Nikke API for a specific user')
                    .addStringOption(option =>
                        option
                            .setName('intl_open_id')
                            .setDescription('OpenID of the user to fetch character info for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('name_codes')
                            .setDescription('Nikke name codes')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('guild-details')
                    .setDescription('Get guild details from Nikke API')
                    .addIntegerOption(option =>
                        option
                            .setName('guild_id')
                            .setDescription('ID of the guild to fetch details for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('guild-members')
                    .setDescription('Get guild members from Nikke API')
                    .addIntegerOption(option =>
                        option
                            .setName('guild_id')
                            .setDescription('ID of the guild to fetch details for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('union-raid-data')
                    .setDescription('Get union raid data from Nikke API')
                    .addIntegerOption(option =>
                        option
                            .setName('guild_id')
                            .setDescription('ID of the guild to fetch details for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('intl_open_id')
                            .setDescription('OpenID of the user to fetch character info for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('union-raid-level-data')
                    .setDescription('Get union raid level data from Nikke API')
                    .addIntegerOption(option =>
                        option
                            .setName('guild_id')
                            .setDescription('ID of the guild to fetch details for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option
                            .setName('intl_open_id')
                            .setDescription('OpenID of the user to fetch character info for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('level')
                            .setDescription('ID of the season to fetch union raid level data for')
                            .setRequired(false)
                            .addChoices(
                                { name: 'Level 1', value: 1 },
                                { name: 'Level 2', value: 2 },
                                { name: 'Level 3', value: 3 },
                                { name: 'Level 4', value: 4 },
                            )
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('union-raid-data-of-season')
                    .setDescription('Get union raid data of a guild season from Nikke API')
                    .addIntegerOption(option =>
                        option
                            .setName('guild_id')
                            .setDescription('ID of the guild to fetch details for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('season_id')
                            .setDescription('ID of the season to fetch union raid data for')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Season 1', value: 100001 },
                                { name: 'Season 2', value: 100002 },
                                { name: 'Season 41', value: 1000041 },
                            )
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('union-raid-level-data-of-season')
                    .setDescription('Get union raid level data of a guild season from Nikke API')
                    .addIntegerOption(option =>
                        option
                            .setName('guild_id')
                            .setDescription('ID of the guild to fetch details for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('season_id')
                            .setDescription('ID of the season to fetch union raid data for')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Season 30', value: 1000039 },
                                { name: 'Season 40', value: 1000040 },
                                { name: 'Season 41', value: 1000041 },
                                { name: 'Season 42', value: 1000042 },
                            )
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('query-guild-card-list')
                    .setDescription('Query the guild card list from Nikke API')
                    .addStringOption(option =>
                        option
                            .setName('cursor')
                            .setDescription('Cursor for pagination')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('guild_rank')
                            .setDescription('Guild rank filter')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('guild_rank_num')
                            .setDescription('Guild rank number filter')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('keyword')
                            .setDescription('Keyword filter')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('page_size')
                            .setDescription('Number of results per page')
                            .setRequired(false)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('my-guild-info')
                    .setDescription('Get my guild info from Nikke API')
                    .addStringOption(option =>
                        option
                            .setName('intl_open_id')
                            .setDescription('OpenID of the user to fetch guild info for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('get-user-characters')
                    .setDescription('Get user characters from Nikke API')
                    .addStringOption(option =>
                        option
                            .setName('intl_open_id')
                            .setDescription('OpenID of the user to fetch characters for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('characters-update')
                    .setDescription('Fetch KAARAKO characters and insert missing name_codes into nikke_characters')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('get-user-profile')
                    .setDescription('Get user profile from Nikke API')
                    .addStringOption(option =>
                        option
                            .setName('intl_open_id')
                            .setDescription('OpenID of the user to fetch profile for')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('search-user')
                    .setDescription('Search for a user in Nikke API')
                    .addIntegerOption(option =>
                        option
                            .setName('limit')
                            .setDescription('Maximum number of users to return')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('next_page_cursor')
                            .setDescription('Cursor for the next page of results')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('user_name')
                            .setDescription('Name of the user to search for')
                            .setRequired(false)
                    )
            )
            ;
    },

    async autocomplete(interaction, client) {
        try {
            const focused = interaction.options.getFocused(true);
            const query = String(focused.value || '').trim().toLowerCase();

            if (focused.name === 'intl_open_id') {
                const accounts = await getNikkeAccounts(client, { seedDefaults: false });
                await interaction.respond(buildAccountAutocompleteChoices(accounts, query));
                return;
            }

            if (focused.name === 'union_id') {
                const unions = await getNikkeUnions(client);
                await interaction.respond(buildUnionAutocompleteChoices(unions, query));
                return;
            }

            if (focused.name === 'guild_id') {
                const unions = await getNikkeUnions(client);
                await interaction.respond(buildGuildIdAutocompleteChoices(unions, query));
                return;
            }

            if (focused.name === 'name_codes') {
                const characters = await getNikkeCharacters(client);
                await interaction.respond(buildCharacterAutocompleteChoices(characters, query));
                return;
            }

            await interaction.respond([]);
        } catch (error) {
            logger.error('Error handling Nikke autocomplete:', {
                error: error.message,
                guildId: interaction.guildId,
                commandName: interaction.commandName,
            });
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction, guildConfig, client) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommandGroup === 'account') {
                switch (subcommand) {
                    case 'add':
                        await handleAccountAdd(interaction, client);
                        break;
                    case 'update':
                        await handleAccountUpdate(interaction, client);
                        break;
                    case 'delete':
                        await handleAccountDelete(interaction, client);
                        break;
                    case 'profile':
                        await handleAccountProfile(interaction, client);
                        break;
                    case 'basic':
                        await handleGetUserProfileBasicInfo(interaction, client);
                        break;
                    case 'outpost':
                        await handleGetUserProfileOutpostInfo(interaction, client);
                        break;
                    case 'daily':
                        await handleGetUserDailyContentsProgress(interaction, client);
                        break;
                    default:
                        await InteractionHelper.safeReply(interaction, {
                            embeds: [errorEmbed('Unknown account subcommand.')],
                            flags: MessageFlags.Ephemeral,
                        }).catch(logger.error);
                }
                return;
            }

            if (subcommandGroup === 'union') {
                switch (subcommand) {
                    case 'counter-enable':
                        await handleUnionCounterEnable(interaction, client);
                        break;
                    case 'counter-disable':
                        await handleUnionCounterDisable(interaction, client);
                        break;
                    case 'set-counter-channel':
                        await handleUnionSetCounterChannel(interaction, client);
                        break;
                    default:
                        await InteractionHelper.safeReply(interaction, {
                            embeds: [errorEmbed('Unknown union subcommand.')],
                            flags: MessageFlags.Ephemeral,
                        }).catch(logger.error);
                }
                return;
            }

            if (subcommandGroup === 'progress') {
                switch (subcommand) {
                    case 'view':
                        await handleAccountProgress(interaction, client);
                        break;
                    case 'fetch':
                        await handleAccountProgressFetch(interaction, client);
                        break;
                    case 'add':
                        await handleAccountProgressAdd(interaction, client);
                        break;
                    case 'remove':
                        await handleAccountProgressRemove(interaction, client);
                        break;
                    default:
                        await InteractionHelper.safeReply(interaction, {
                            embeds: [errorEmbed('Unknown progress subcommand.')],
                            flags: MessageFlags.Ephemeral,
                        }).catch(logger.error);
                }
                return;
            }

            switch (subcommand) {
                case 'login':
                    await handleLogin(interaction, client);
                    break;
                case 'checklogin':
                    await handleCheckLogin(interaction, client);
                    break;
                case 'fetch-api':
                    await handleFetchApi(interaction, client);
                    break;
                case 'character':
                    await handleCharacterByName(interaction, client);
                    break;
                case 'user-character':
                    await handleUserCharacter(interaction, client);
                    break;
                case 'guild-details':
                    await handleGuildDetails(interaction, client);
                    break;
                case 'guild-members':
                    await handleGuildMembers(interaction, client);
                    break;
                case 'union-raid-data':
                    await handleUnionRaidData(interaction, client);
                    break;
                case 'union-raid-level-data':
                    await handleUnionRaidLevelData(interaction, client);
                    break;
                case 'union-raid-data-of-season':
                    await handleUnionRaidDataOfGuildSeason(interaction, client);
                    break;
                case 'union-raid-level-data-of-season':
                    await handleUnionRaidLevelDataOfGuildSeason(interaction, client);
                    break;
                case 'query-guild-card-list':
                    await handleQueryGuildCardList(interaction, client);
                    break;
                case 'my-guild-info':
                    await handleGetMyGuildInfo(interaction, client);
                    break;
                case 'get-user-characters':
                    await handleGetUserCharacters(interaction, client);
                    break;
                case 'characters-update':
                    await handleCharactersUpdate(interaction, client);
                    break;
                case 'get-user-profile':
                    await handleGetUserProfile(interaction, client);
                    break;
                case 'search-user':
                    await handleSearchUser(interaction, client);
                    break;
                default:
                    await InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed('Unknown subcommand.')],
                        flags: MessageFlags.Ephemeral,
                    }).catch(logger.error);
            }
        } catch (error) {
            logger.error(`Error in Nikke ${subcommand}:`, error);

            const errorEmbedMsg = createEmbed({
                title: '❌ Error',
                description: 'An error occurred while processing your request.',
                color: getColor('error'),
            });

            if (!interaction.replied && !interaction.deferred) {
                await InteractionHelper.safeReply(interaction, { embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
            } else {
                await interaction.followUp({ embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
            }
        }
    },
};
