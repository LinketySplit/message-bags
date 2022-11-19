#!/usr/bin/env node

import sade from 'sade';
import { getTsProject } from './get-ts-project.js';
import { logMessageBags } from './log.js';
import { parseMessageBags } from './parse-message-bags.js';
import { parseI18N } from './parse-i18n.js';
import { bold, underline, red, green, dim } from './kleur.js';
export const main = () => {
  const localeOption = '--locale -l';
  const localeOptionDesc =
    'A locale to add (or ensure already exists). ' +
    'You can repeat this flag for multiple locales. ' +
    'Existing locales will always also be included.';
  const prog = sade('skint').version(`0.0.1`);

  prog
    .command('build')
    .option(localeOption, localeOptionDesc)
    .example('build')
    .example('bulid --locale en_US --locale es_MX')
    .example('build -l en_US -l es_MX')
    .describe(`Build the project's translation files.`)
    .action(async (options) => {
      const ensuredLocales = options.locale || [];
      const project = getTsProject();
      console.log(dim('Parsing call expressions...'));
      const { messageBags, valid } = parseMessageBags(project);
      
      logMessageBags({ messageBags, valid });
      if (!valid) {
        console.log(red('Build cancelled. Please correct the errors.'));
        return;
      }
      // const parseI18NResult = parseI18N(
      //   project,
      //   parsedMessageBags,
      //   ensuredLocales
      // );

      //console.log(parseI18NResult.locales);
    });
  prog.parse(process.argv);
};
main();
