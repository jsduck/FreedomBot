import { logger } from '../../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import {
    buildUserDailyContentsProgressView,
    buildUserProfileBasicInfoView,
    buildUserProfileOutpostInfoView,
    USER_DAILY_CONTENTS_PROGRESS_UPDATE_BUTTON_ID,
    USER_PROFILE_BASIC_INFO_UPDATE_BUTTON_ID,
    USER_PROFILE_OUTPOST_INFO_UPDATE_BUTTON_ID,
} from '../../../commands/Nikke/modules/nikke_user.js';

function parseAreaId(value) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

async function executeProfileRefresh(interaction, client, args, buildView, handlerId, handlerName) {
    const [intlOpenId, areaIdRaw] = args;

    if (!intlOpenId) {
        return replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: 'This update button is missing account information.',
        });
    }

    await interaction.deferUpdate();

    const response = await buildView(client, intlOpenId, parseAreaId(areaIdRaw), { refresh: true });
    await interaction.message.edit({
        embeds: [response.embed],
        components: response.components,
        files: response.file ? [response.file] : [],
    });

    return true;
}

export const userProfileBasicInfoUpdateHandler = {
    name: USER_PROFILE_BASIC_INFO_UPDATE_BUTTON_ID,
    customId: USER_PROFILE_BASIC_INFO_UPDATE_BUTTON_ID,
    async execute(interaction, client, args = []) {
        try {
            await executeProfileRefresh(
                interaction,
                client,
                args,
                buildUserProfileBasicInfoView,
                USER_PROFILE_BASIC_INFO_UPDATE_BUTTON_ID,
                'nikke_user_profile_basic_info',
            );
        } catch (error) {
            logger.error('Error in Nikke user-profile basic info update button:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: USER_PROFILE_BASIC_INFO_UPDATE_BUTTON_ID,
                handler: 'nikke_user_profile_basic_info',
            });
        }
    },
};

export const userProfileOutpostInfoUpdateHandler = {
    name: USER_PROFILE_OUTPOST_INFO_UPDATE_BUTTON_ID,
    customId: USER_PROFILE_OUTPOST_INFO_UPDATE_BUTTON_ID,
    async execute(interaction, client, args = []) {
        try {
            await executeProfileRefresh(
                interaction,
                client,
                args,
                buildUserProfileOutpostInfoView,
                USER_PROFILE_OUTPOST_INFO_UPDATE_BUTTON_ID,
                'nikke_user_profile_outpost_info',
            );
        } catch (error) {
            logger.error('Error in Nikke user-profile outpost info update button:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: USER_PROFILE_OUTPOST_INFO_UPDATE_BUTTON_ID,
                handler: 'nikke_user_profile_outpost_info',
            });
        }
    },
};

export const userDailyContentsProgressUpdateHandler = {
    name: USER_DAILY_CONTENTS_PROGRESS_UPDATE_BUTTON_ID,
    customId: USER_DAILY_CONTENTS_PROGRESS_UPDATE_BUTTON_ID,
    async execute(interaction, client, args = []) {
        try {
            await executeProfileRefresh(
                interaction,
                client,
                args,
                buildUserDailyContentsProgressView,
                USER_DAILY_CONTENTS_PROGRESS_UPDATE_BUTTON_ID,
                'nikke_user_daily_contents_progress',
            );
        } catch (error) {
            logger.error('Error in Nikke user daily contents progress update button:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: USER_DAILY_CONTENTS_PROGRESS_UPDATE_BUTTON_ID,
                handler: 'nikke_user_daily_contents_progress',
            });
        }
    },
};

export default [
    userProfileBasicInfoUpdateHandler,
    userProfileOutpostInfoUpdateHandler,
    userDailyContentsProgressUpdateHandler,
];
