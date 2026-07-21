import { logger } from '../../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import { buildUserCharacterView, USER_CHARACTER_UPDATE_BUTTON_ID } from '../../../commands/Nikke/modules/nikke_character.js';

export const userCharacterUpdateHandler = {
    name: USER_CHARACTER_UPDATE_BUTTON_ID,
    customId: USER_CHARACTER_UPDATE_BUTTON_ID,
    async execute(interaction, client, args = []) {
        try {
            const [intlOpenId, nameCode] = args;

            if (!intlOpenId || !nameCode) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'This update button is missing character information.',
                });
            }

            await interaction.deferUpdate();

            const response = await buildUserCharacterView(client, intlOpenId, String(nameCode), { refresh: true });

            await interaction.message.edit({
                embeds: response.embeds || [response.embed],
                components: response.components,
            });
        } catch (error) {
            logger.error('Error in Nikke user-character update button:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: USER_CHARACTER_UPDATE_BUTTON_ID,
                handler: 'nikke_user_character',
            });
        }
    },
};

export default [userCharacterUpdateHandler];