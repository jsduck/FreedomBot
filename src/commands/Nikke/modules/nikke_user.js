import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getMyGuildInfo, getUserGameInfo, getUserProfileBasicInfo, getUserProfileOutpostInfo, getUserDailyContentsProgress, searchUser, getUserProfile, getUserCharacters, safeJSON } from '../../../services/nikke.js';

export async function handleSearchUser(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to check guild details.")]
        }).catch(logger.error);
        return;
    }

    const limit = interaction.options.getInteger("limit") || 20;
    const next_page_cursor = interaction.options.getString("next_page_cursor") || "";
    const user_name = interaction.options.getString("user_name") || "";

    try {
        const res = await searchUser(limit, next_page_cursor, user_name);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`searchUser\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error searching user:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to search for the user. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserProfile(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user profile.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");

    try {
        const res = await getUserProfile(intl_open_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserProfile\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error getting user profile:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user profile. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserCharacters(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user characters.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = interaction.options.getInteger("nikke_area_id") || 84; // Default to global area ID

    try {
        const res = await getUserCharacters(intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserCharacters\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error getting user characters:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user characters. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserGameInfo(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user game info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");

    try {
        const res = await getUserGameInfo(intl_open_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserGameInfo\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error getting user game info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user game info. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserProfileBasicInfo(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user profile basic info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = interaction.options.getInteger("nikke_area_id") || 84; // Default to global area ID

    try {
        const res = await getUserProfileBasicInfo(intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserProfileBasicInfo\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error getting user profile basic info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user profile basic info. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserProfileOutpostInfo(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user profile outpost info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = interaction.options.getInteger("nikke_area_id") || 84; // Default to global area ID

    try {
        const res = await getUserProfileOutpostInfo(intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserProfileOutpostInfo\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error getting user profile outpost info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user profile outpost info. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetUserDailyContentsProgress(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to retrieve user daily contents progress.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = interaction.options.getInteger("nikke_area_id") || 84; // Default to global area ID

    try {
        const res = await getUserDailyContentsProgress(intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUserDailyContentsProgress\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error getting user daily contents progress:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get the user daily contents progress. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGetMyGuildInfo(interaction, client) {
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
            embeds: [errorEmbed("You need **Administrator** permission to retrieve my guild info.")]
        }).catch(logger.error);
        return;
    }

    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = interaction.options.getInteger("nikke_area_id") || 84; // Default to global area ID

    try {
        const res = await getMyGuildInfo(intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getMyGuildInfo\`\`.`,
                    color: getColor('success')
                }).addFields(
                    { name: "Response Preview", value: `\`\`\`json\n${preview}\n\`\`\`` }
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
        logger.error("Error getting my guild info:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to get my guild info. Please try again.")]
        }).catch(logger.error);
    }
}