import { PATH_TO_I18N, TRANSLATIONS_FILE_NAME, TYPE_FILE_NAME } from './constants.js';
export const getMessageBagDirectoryPath = (
  messageBagId: string
): string => {
  return `${PATH_TO_I18N}/${messageBagId}`;
};
export const getMessageBagTypeFilePath = (
  messageBagId: string
): string => {
  return `${getMessageBagDirectoryPath(messageBagId)}/${TYPE_FILE_NAME}.ts`;
};

export const getMessageBagTranslationsFilePath = (
  messageBagId: string,
  locale: string
): string => {
  return `${getMessageBagDirectoryPath(messageBagId)}/${TRANSLATIONS_FILE_NAME}.${locale}.ts`;
};
