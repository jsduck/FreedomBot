import { logger } from '../../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import {
    ACCOUNT_PROFILE_BACK_BUTTON_ID,
    ACCOUNT_PROFILE_FORWARD_BUTTON_ID,
    ACCOUNT_PROFILE_UPDATE_BUTTON_ID,
    buildAccountProfileView,
} from '../../../commands/Nikke/modules/nikke_user.js';

function parseAreaId(value) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : 84;
}

function parseViewIndex(value) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : 0;
}

async function renderAccountProfile(interaction, client, intlOpenId, areaId, viewIndex, { refresh = false } = {}) {
    const response = await buildAccountProfileView(client, intlOpenId, areaId, viewIndex, { refresh });
    await interaction.message.edit({
        embeds: [response.embed],
        components: response.components,
        files: response.file ? [response.file] : [],
    });
}

export const accountProfileBackHandler = {
    name: ACCOUNT_PROFILE_BACK_BUTTON_ID,
    customId: ACCOUNT_PROFILE_BACK_BUTTON_ID,
    async execute(interaction, client, args = []) {
        try {
            const [intlOpenId, areaIdRaw, viewIndexRaw] = args;
            if (!intlOpenId) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'This account profile button is missing account information.',
                });
            }

            await interaction.deferUpdate();
            await renderAccountProfile(
                interaction,
                client,
                intlOpenId,
                parseAreaId(areaIdRaw),
                parseViewIndex(viewIndexRaw) - 1,
            );
        } catch (error) {
            logger.error('Error in Nikke account profile back button:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: ACCOUNT_PROFILE_BACK_BUTTON_ID,
                handler: 'nikke_account_profile_back',
            });
        }
    },
};

export const accountProfileForwardHandler = {
    name: ACCOUNT_PROFILE_FORWARD_BUTTON_ID,
    customId: ACCOUNT_PROFILE_FORWARD_BUTTON_ID,
    async execute(interaction, client, args = []) {
        try {
            const [intlOpenId, areaIdRaw, viewIndexRaw] = args;
            if (!intlOpenId) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'This account profile button is missing account information.',
                });
            }

            await interaction.deferUpdate();
            await renderAccountProfile(
                interaction,
                client,
                intlOpenId,
                parseAreaId(areaIdRaw),
                parseViewIndex(viewIndexRaw) + 1,
            );
        } catch (error) {
            logger.error('Error in Nikke account profile forward button:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: ACCOUNT_PROFILE_FORWARD_BUTTON_ID,
                handler: 'nikke_account_profile_forward',
            });
        }
    },
};

export const accountProfileUpdateHandler = {
    name: ACCOUNT_PROFILE_UPDATE_BUTTON_ID,
    customId: ACCOUNT_PROFILE_UPDATE_BUTTON_ID,
    async execute(interaction, client, args = []) {
        try {
            const [intlOpenId, areaIdRaw, viewIndexRaw] = args;
            if (!intlOpenId) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'This account profile button is missing account information.',
                });
            }

            await interaction.deferUpdate();
            await renderAccountProfile(
                interaction,
                client,
                intlOpenId,
                parseAreaId(areaIdRaw),
                parseViewIndex(viewIndexRaw),
                { refresh: true },
            );
        } catch (error) {
            logger.error('Error in Nikke account profile update button:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: ACCOUNT_PROFILE_UPDATE_BUTTON_ID,
                handler: 'nikke_account_profile_update',
            });
        }
    },
};

export default [
    accountProfileBackHandler,
    accountProfileForwardHandler,
    accountProfileUpdateHandler,
];
