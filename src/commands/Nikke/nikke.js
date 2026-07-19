import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
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
import { handleAccountProfile, handleGetMyGuildInfo, handleGetUserDailyContentsProgress, handleGetUserProfileOutpostInfo, handleGetUserProfileBasicInfo, handleGetUserCharacters, handleGetUserProfile, handleSearchUser } from './modules/nikke_user.js';
import { addNikkeAccount, deleteNikkeAccount, getNikkeAccountChoices, getNikkeAreaChoices, getNikkeUnionChoices, getNikkeUnionGuildChoices, setNikkeUnionCounterChannel, setNikkeUnionCounterDisabled, setNikkeUnionCounterEnabled, syncNikkeAccountProfile, updateNikkeAccountUnionId } from '../../utils/database.js';

function extractIntlOpenIdFromInput(input) {
    const raw = String(input || '').trim();
    if (!raw) {
        return null;
    }

    try {
        const temp = raw.split('id=')[1]?.split('&')[0]?.replaceAll('%3D', '=');
        if (!temp) {
            return null;
        }

        const decoded = atob(temp);
        const intlOpenId = decoded.split('-')[1]?.trim();
        return intlOpenId || null;
    } catch {
        return null;
    }
}

async function handleAccountAdd(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer account add interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to add Nikke accounts.')],
        }).catch(logger.error);
        return;
    }

    const name = interaction.options.getString('name', true).trim();
    const accountInput = interaction.options.getString('account_input', true).trim();
    const intlOpenId = extractIntlOpenIdFromInput(accountInput);
    const discordTag = interaction.options.getString('discord_tag', false)?.trim() || null;

    if (!intlOpenId) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed(
                'Invalid Account Input',
                'Could not extract `intl_open_id` from the provided string. Include a value containing `openid=`.'
            )],
        }).catch(logger.error);
        return;
    }

    const result = await addNikkeAccount(client, {
        name,
        intl_open_id: intlOpenId,
        discord_tag: discordTag,
    });

    if (!result.success) {
        if (result.reason === 'already_exists') {
            const existing = result.account;
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed(
                    'Account Already Exists',
                    existing
                        ? `${existing.name} is already stored for open id ${existing.intl_open_id}${existing.union_id ? ` and union id ${existing.union_id}` : ''}.`
                        : 'That account is already stored in the database.'
                )],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to add the Nikke account right now.')],
        }).catch(logger.error);
        return;
    }

    const profileSyncResult = await syncNikkeAccountProfile(client, {
        intl_open_id: result.account.intl_open_id,
        union_id: result.account.union_id,
    });

    const profileSyncMessage = profileSyncResult.success
        ? `\nSaved profile payloads (basic_info, outpost_info, daily_progress) in nikke_accounts for area ${profileSyncResult.area_id}${profileSyncResult.union_id ? ` and derived union id ${profileSyncResult.union_id} from profile gsn` : ''}.`
        : '\nAccount profile payload sync failed. You can retry by re-adding or updating this account later.';

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Account Added',
            `Stored ${result.account.name} with open id ${result.account.intl_open_id}${result.account.discord_tag ? ` and Discord tag ${result.account.discord_tag}` : ''}.${profileSyncMessage}`
        )],
    }).catch(logger.error);
}

async function handleUnionCounterEnable(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer union counter enable interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to enable union counters.')],
        }).catch(logger.error);
        return;
    }

    const unionId = interaction.options.getString('union_id', true).trim();
    const result = await setNikkeUnionCounterEnabled(client, unionId, interaction.user.id);

    if (!result.success) {
        if (result.reason === 'union_not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Union Not Found', `No Nikke union exists for union id ${unionId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to enable the union counter right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Union Counter Enabled',
            `Enabled reminders for union ${result.union.name} (${result.union.union_id}).\nTracked members from nikke_accounts: ${result.member_count}.\nTesting mode is active with 5-minute checks.`
        )],
    }).catch(logger.error);
}

async function handleUnionCounterDisable(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer union counter disable interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to disable union counters.')],
        }).catch(logger.error);
        return;
    }

    const unionId = interaction.options.getString('union_id', true).trim();
    const result = await setNikkeUnionCounterDisabled(client, unionId, interaction.user.id);

    if (!result.success) {
        if (result.reason === 'union_not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Union Not Found', `No Nikke union exists for union id ${unionId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to disable the union counter right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Union Counter Disabled',
            `Disabled reminders for union ${result.union.name} (${result.union.union_id}).`
        )],
    }).catch(logger.error);
}

async function handleUnionSetCounterChannel(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer union set-counter-channel interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to set union counter channels.')],
        }).catch(logger.error);
        return;
    }

    const unionId = interaction.options.getString('union_id', true).trim();
    const channel = interaction.options.getChannel('channel', true);

    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Invalid Channel', 'Please choose a text or announcement channel.')],
        }).catch(logger.error);
        return;
    }

    const result = await setNikkeUnionCounterChannel(client, unionId, channel.id, interaction.user.id);

    if (!result.success) {
        if (result.reason === 'union_not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Union Not Found', `No Nikke union exists for union id ${unionId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to set the union counter channel right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Union Counter Channel Set',
            `Set reminder channel for union ${result.union.name} (${result.union.union_id}) to ${channel}.`
        )],
    }).catch(logger.error);
}

async function handleAccountUpdate(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer account update interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to update Nikke accounts.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();
    const unionId = interaction.options.getString('union_id', true).trim();

    const result = await updateNikkeAccountUnionId(client, {
        intl_open_id: intlOpenId,
        union_id: unionId,
    });

    if (!result.success) {
        if (result.reason === 'not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Account Not Found', `No Nikke account exists for open id ${intlOpenId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to update the Nikke account right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Account Updated',
            `Updated ${result.account.name} (${result.account.intl_open_id}) to union id ${result.account.union_id ?? 'none'}.`
        )],
    }).catch(logger.error);
}

async function handleAccountDelete(interaction, client) {
    try {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.error('Failed to defer account delete interaction:', error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('You need **Administrator** permission to delete Nikke accounts.')],
        }).catch(logger.error);
        return;
    }

    const intlOpenId = interaction.options.getString('intl_open_id', true).trim();

    const result = await deleteNikkeAccount(client, intlOpenId);

    if (!result.success) {
        if (result.reason === 'not_found') {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Account Not Found', `No Nikke account exists for open id ${intlOpenId}.`)],
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Database Error', 'Unable to delete the Nikke account right now.')],
        }).catch(logger.error);
        return;
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Account Deleted',
            `Deleted ${result.account.name} (${result.account.intl_open_id}) from the database.`
        )],
    }).catch(logger.error);
}

export default {
    async buildData(client) {
        const accountChoices = await getNikkeAccountChoices(client);
        const unionChoices = await getNikkeUnionChoices(client);
        const guildChoices = await getNikkeUnionGuildChoices(client);
        const areaChoices = await getNikkeAreaChoices(client);

        return new SlashCommandBuilder()
        .setName("nikke")
        .setDescription("Nikke commands.")
        .addSubcommandGroup(group =>
            group
                .setName("account")
                .setDescription("Manage Nikke accounts")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("add")
                        .setDescription("Add a Nikke account if it does not already exist")
                        .addStringOption(option =>
                            option
                                .setName("name")
                                .setDescription("Display name for the account")
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option
                                .setName("account_input")
                                .setDescription("Account link or raw string containing openid=")
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
                        .setName("update")
                        .setDescription("Update the union id for an existing Nikke account")
                        .addStringOption(option =>
                            option
                                .setName("intl_open_id")
                                .setDescription("Account open id")
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option
                                .setName("union_id")
                                .setDescription("New union id for the account")
                            .setRequired(true)
                            .addChoices(...unionChoices)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("delete")
                        .setDescription("Delete a Nikke account from the database")
                        .addStringOption(option =>
                            option
                                .setName("intl_open_id")
                                .setDescription("Account open id")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('profile')
                        .setDescription('View basic, outpost, and daily profile data in a paged embed')
                        .addStringOption(option =>
                            option
                                .setName('intl_open_id')
                                .setDescription('Account open id')
                                .setRequired(true)
                                .addChoices(...accountChoices)
                        )
                        .addIntegerOption(option =>
                            option
                                .setName('nikke_area_id')
                                .setDescription('Nikke area ID')
                                .setRequired(false)
                                .addChoices(...areaChoices)
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
                                .addChoices(...unionChoices)
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
                                .addChoices(...unionChoices)
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
                                .addChoices(...unionChoices)
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
                        .addChoices(...accountChoices)
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
                .addIntegerOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(...guildChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("guild-members")
                .setDescription("Get guild members from Nikke API")
                .addIntegerOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(...guildChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-data")
                .setDescription("Get union raid data from Nikke API")
                .addIntegerOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(...guildChoices)
                )
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch character info for")
                        .setRequired(true)
                        .addChoices(...accountChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-level-data")
                .setDescription("Get union raid level data from Nikke API")
                .addIntegerOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(...guildChoices)
                )
                .addStringOption(option =>
                    option
                        .setName("intl_open_id")
                        .setDescription("OpenID of the user to fetch character info for")
                        .setRequired(true)
                        .addChoices(...accountChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("level")
                        .setDescription("ID of the season to fetch union raid level data for")
                        .setRequired(false)
                        .addChoices(
                            { name: "Level 1", value: 1 },
                            { name: "Level 2", value: 2 },
                            { name: "Level 3", value: 3 },
                            { name: "Level 4", value: 4 }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-data-of-season")
                .setDescription("Get union raid data of a guild season from Nikke API")
                .addIntegerOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(...guildChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("season_id")
                        .setDescription("ID of the season to fetch union raid data for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Season 1", value: 100001 },
                            { name: "Season 2", value: 100002 },
                            { name: "Season 41", value: 1000041 }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName("area_id")
                        .setDescription("Area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("union-raid-level-data-of-season")
                .setDescription("Get union raid level data of a guild season from Nikke API")
                .addIntegerOption(option =>
                    option
                        .setName("guild_id")
                        .setDescription("ID of the guild to fetch details for")
                        .setRequired(true)
                        .addChoices(...guildChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("season_id")
                        .setDescription("ID of the season to fetch union raid data for")
                        .setRequired(true)
                        .addChoices(
                            { name: "Season 30", value: 1000039 },
                            { name: "Season 40", value: 1000040 },
                            { name: "Season 41", value: 1000041 },
                            { name: "Season 42", value: 1000042 }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName("area_id")
                        .setDescription("Area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
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
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
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
                        .addChoices(...accountChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
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
                        .addChoices(...accountChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
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
                        .addChoices(...accountChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
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
                        .addChoices(...accountChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
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
                        .addChoices(...accountChoices)
                )
                .addIntegerOption(option =>
                    option
                        .setName("nikke_area_id")
                        .setDescription("Nikke area ID")
                        .setRequired(false)
                        .addChoices(...areaChoices)
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
                        .addChoices(...accountChoices)
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
                        default:
                            await InteractionHelper.safeReply(interaction, {
                                embeds: [errorEmbed('Unknown account subcommand.')],
                                flags: MessageFlags.Ephemeral
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
                    case "union-raid-data-of-season":
                        await handleUnionRaidDataOfGuildSeason(interaction, client);
                        break;
                    case "union-raid-level-data-of-season":
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
    };