import {
    getEnabledNikkeUnionCounters,
    getNikkeAccountsByUnionId,
    getNikkeAccountProfileSection,
    incrementNikkeAccountPingCount,
} from '../utils/database.js';
import { logger } from '../utils/logger.js';

function parseDailyProgressEntry(value) {
    if (Array.isArray(value)) {
        return value[0] || null;
    }

    if (value && typeof value === 'object') {
        return value;
    }

    return null;
}

function parseDiscordUserId(discordTag) {
    const value = String(discordTag || '').trim();
    if (!value) {
        return null;
    }

    const mentionMatch = value.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        return mentionMatch[1];
    }

    if (/^\d{17,20}$/.test(value)) {
        return value;
    }

    return null;
}

async function resolveUserForPing(client, discordTag) {
    if (!discordTag) {
        return null;
    }

    const directId = parseDiscordUserId(discordTag);
    if (directId) {
        try {
            return await client.users.fetch(directId);
        } catch (error) {
            logger.warn(`Could not resolve Discord user id ${directId} for Nikke ping`);
        }
    }

    const trimmed = String(discordTag).trim().toLowerCase();
    const cacheMatch = client.users.cache.find((user) => {
        if (!user) return false;
        return user.tag.toLowerCase() === trimmed || user.username.toLowerCase() === trimmed;
    });

    return cacheMatch || null;
}

async function sendUnionPing(client, union, account, message) {
    try {
        const user = await resolveUserForPing(client, account.discord_tag);
        if (!user) {
            return false;
        }

        const channelId = union?.counter_channel_id;
        let delivered = false;

        if (channelId) {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel && typeof channel.send === 'function') {
                await channel.send({
                    content: `<@${user.id}> ${message}`,
                    allowedMentions: { users: [user.id] },
                });
                delivered = true;
            }
        }

        if (!delivered) {
            await user.send(`[${union?.name || union?.union_id || 'Union'}] ${message}`);
            delivered = true;
        }

        if (!delivered) {
            return false;
        }

        await incrementNikkeAccountPingCount(client, account.intl_open_id);
        return true;
    } catch (error) {
        logger.warn(`Failed sending Nikke union counter ping for ${account.intl_open_id}: ${error.message}`);
        return false;
    }
}

function isDailyMissionWindowUtcPlus3(date = new Date()) {
    // Rollback behavior (UTC+3 window only):
    // const utcHour = date.getUTCHours();
    // const utcMinute = date.getUTCMinutes();
    // const hourInUtcPlus3 = (utcHour + 3) % 24;
    //
    // if (hourInUtcPlus3 < 21 || hourInUtcPlus3 > 22) {
    //     return false;
    // }
    //
    // return utcMinute === 0 || utcMinute === 30;

    const utcMinute = date.getUTCMinutes();

    // Testing mode: run this check every 5 minutes.
    return utcMinute % 5 === 0;
}

async function refreshDailyProgress(client, account, areaId) {
    const result = await getNikkeAccountProfileSection(client, {
        intl_open_id: account.intl_open_id,
        section: 'daily_progress',
        refresh: true,
        area_id: areaId,
    });

    if (!result.success) {
        return null;
    }

    return parseDailyProgressEntry(result.data);
}

export async function runUnionOutpostStorageCounterCheck(client) {
    try {
        const unions = await getEnabledNikkeUnionCounters(client);
        if (unions.length === 0) {
            return;
        }

        for (const union of unions) {
            const areaId = Number.parseInt(String(union.area_id), 10) || 84;
            const accounts = await getNikkeAccountsByUnionId(client, union.union_id);

            for (const account of accounts) {
                const progress = await refreshDailyProgress(client, account, areaId);
                if (!progress) {
                    continue;
                }

                const fullness = Number(progress.outpost_battle_storage_fullness);
                if (!Number.isFinite(fullness) || fullness < 0.5) { // Temp threshold for testing; adjust as needed
                    continue;
                }

                await sendUnionPing(
                    client,
                    union,
                    account,
                    `Nikke alert for ${account.name || account.intl_open_id}: outpost storage fullness is ${(fullness * 100).toFixed(1)}%. Please collect rewards soon.`,
                );
            }
        }
    } catch (error) {
        logger.error('Error running Nikke union outpost counter check:', error);
    }
}

export async function runUnionDailyMissionCounterCheck(client) {
    try {
        if (!isDailyMissionWindowUtcPlus3(new Date())) {
            return;
        }

        const unions = await getEnabledNikkeUnionCounters(client);
        if (unions.length === 0) {
            return;
        }

        for (const union of unions) {
            const areaId = Number.parseInt(String(union.area_id), 10) || 84;
            const accounts = await getNikkeAccountsByUnionId(client, union.union_id);

            for (const account of accounts) {
                const progress = await refreshDailyProgress(client, account, areaId);
                if (!progress) {
                    continue;
                }

                const points = Number(progress.daily_mission_receivable_points);
                if (!Number.isFinite(points) || points <= 0) {
                    continue;
                }

                await sendUnionPing(
                    client,
                    union,
                    account,
                    `Nikke alert for ${account.name || account.intl_open_id}: you have ${points} receivable daily mission points.`,
                );
            }
        }
    } catch (error) {
        logger.error('Error running Nikke union daily mission counter check:', error);
    }
}
