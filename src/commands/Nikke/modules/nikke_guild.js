import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getGuildDetail, getGuildMembers, getUnionRaidData, getUnionRaidLevelData, getUnionRaidDataOfGuildSeason, getUnionRaidLevelDataOfGuildSeason, queryGuildCardList, safeJSON } from '../../../services/nikke.js';

export async function handleGuildDetails(interaction, client) {
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

    const guild_id = interaction.options.getInteger("guild_id");
    const nikke_area_id = null;
    try {
        const res = await getGuildDetail(guild_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`GetGuildDetail\`.`,
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
        logger.error("Error checking guild details:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check guild details. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleGuildMembers(interaction, client) {
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

    const guild_id = interaction.options.getInteger("guild_id");
    const nikke_area_id = null;
    try {
        const res = await getGuildMembers(guild_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`GetGuildMembers\`.`,
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
        logger.error("Error checking guild members:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check guild members. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleUnionRaidData(interaction, client) {
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

    const guild_id = interaction.options.getInteger("guild_id");
    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = null;
    try {
        const res = await getUnionRaidData(guild_id, intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUnionRaidData\`.`,
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
        logger.error("Error checking union raid data:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check union raid data. Please try again.")]
        }).catch(logger.error);
    }
}

function getInfoFromLevel(json, level) {
    return json.data.level_info.find(info => info.level === level);
}

export async function handleUnionRaidLevelData(interaction, client) {
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

    const guild_id = interaction.options.getInteger("guild_id");
    const intl_open_id = interaction.options.getString("intl_open_id");
    const nikke_area_id = null;
    const level = interaction.options.getInteger("level") || 1; 
    try {
        const res = await getUnionRaidLevelData(guild_id, intl_open_id, nikke_area_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const level_info = getInfoFromLevel(data, level);

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUnionRaidLevelData\`.`,
                    color: getColor('success')
                });

            if (level_info) {
                //console.log(level_info);
                for (const item of level_info.boss_info) {
                    //console.log(item);

                    embed.addFields(
                        { 
                            name: `${item.name_localvalues.en}`, 
                            value: `HP: ${BigInt(item.current_hp).toLocaleString("en-US")} / MAX_HP: ${BigInt(item.max_hp).toLocaleString("en-US")}` 
                        }
                    );
                }
            }
            
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
        logger.error("Error checking union raid level data:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check union raid level data. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleUnionRaidDataOfGuildSeason(interaction, client) {
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

    const area_id = null;
    const guild_id = interaction.options.getInteger("guild_id");
    const season_id = interaction.options.getInteger("season_id");
    try {
        const res = await getUnionRaidDataOfGuildSeason(area_id, guild_id, season_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUnionRaidDataOfGuildSeason\`.`,
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
        logger.error("Error checking union raid data of guild season:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check union raid data of guild season. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleUnionRaidLevelDataOfGuildSeason(interaction, client) {
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

    const area_id = null;
    const guild_id = interaction.options.getInteger("guild_id");
    const season_id = interaction.options.getInteger("season_id");
    try {
        const res = await getUnionRaidLevelDataOfGuildSeason(area_id, guild_id, season_id);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`getUnionRaidLevelDataOfGuildSeason\`.`,
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
        logger.error("Error checking union raid level data of guild season:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to check union raid level data of guild season. Please try again.")]
        }).catch(logger.error);
    }
}

export async function handleQueryGuildCardList(interaction, client) {
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

    const cursor = interaction.options.getString("cursor");
    const guild_rank = interaction.options.getInteger("guild_rank");
    const guild_rank_num = interaction.options.getInteger("guild_rank_num");
    const keyword = interaction.options.getString("keyword");
    const nikke_area_id = null;
    const page_size = interaction.options.getInteger("page_size");
    try {
        const res = await queryGuildCardList(cursor, guild_rank, guild_rank_num, keyword, nikke_area_id, page_size);
        if (res.ok) {
            const data = await res.json();
            const json = safeJSON(data, 2);
            const length = json.length;

            const preview = safeJSON(data, 2).slice(0, 1000); // fits in embed
            const embed = createEmbed({
                    title: "✅ API Call Successful",
                    description: `Successfully called Nikke API endpoint \`queryGuildCardList\`.`,
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
        logger.error("Error querying guild card list:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while trying to query the guild card list. Please try again.")]
        }).catch(logger.error);
    }
}