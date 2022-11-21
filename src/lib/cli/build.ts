import type { Project, SourceFile } from 'ts-morph';
import { PATH_TO_I18N, TYPE_FILE_NAME } from './constants';
import type { ParsedMessageBag, ParsedI18NResult } from './types';
import { flattenMessageBag } from './utils';

export const build = async (
  project: Project,
  parsedMessageBags: ParsedMessageBag[],
  locales: string[],
  dryRun: boolean
): ParsedI18NResult => {
  for (const bag of parsedMessageBags) {
    await buildMessageBag(project, bag, locales);
  }
  if (!dryRun) {
    await project.save();
  }
};

const buildMessageBag = async (
  project: Project,
  parsedMessageBag: ParsedMessageBag,
  locales: string[]
) => {
  //
};
const buildMessageBagTypeFile = (
  project: Project,
  messageBag: ParsedMessageBag
): ParsedMessageBagTypeFile => {
  const filePath = `${PATH_TO_I18N}/${messageBag.messageBagId}/${TYPE_FILE_NAME}.ts`;
  let file = project.getSourceFile(filePath);
  const fileExists = file !== undefined;
  if(file) {

  } else {
    file = project.createSourceFile(filePath);
  
  }
};

const validateMessageBagTypeFile = (file: SourceFile, bag: ParsedMessageBag) => {
  const
  const flattenedBagProps = flattenMessageBag(bag.properties)
}
