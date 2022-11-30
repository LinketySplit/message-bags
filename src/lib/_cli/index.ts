#!/usr/bin/env node

import kleur from 'kleur';
import sade from 'sade';
import { PATH_TO_I18N } from './constants.js';
import { findLocales } from './find-locales.js';
import { lintI18n } from './lint-i18n.js';
import { build } from './build.js';
import { getTsProject } from './utils.js';

export const main = () => {
  const localeOption = '--locale -l';
  const localeOptionDesc =
    'A locale to add (or ensure already exists). ' +
    'You can repeat this flag for multiple locales. ' +
    'Existing locales will always also be included.';
  const prog = sade('message-bags').version(`v0.1.0`);

  prog
    .command('lint')
    .option(localeOption, localeOptionDesc)
    .example('lint')
    .example('lint --locale en_US --locale es_MX')
    .example('lint -l en_US -l es_MX')
    .describe(
      `Lint the project's current translations in ${kleur.underline(PATH_TO_I18N)}. ` +
        `For each message bag and locale, it displays the message translations, ` + 
        `including those that are missing, invalid or deprecated. ` +
        `Note that the message definitions are read from the ` +
        `${kleur.underline(`${PATH_TO_I18N}/message/bag/id/type.ts`)} file in each message bag directory, ` + 
        `not from the ${kleur.bold('current message definitions')} in your source code. ` +
        `To see changes that would need to be made to translations based on the ${kleur.bold('current message definitions')} ` +
        `in your source code, run ${kleur.cyan(`skint build --dry-run`)}.`
    )
    .action(async (options) => {
      const project = getTsProject();
      const locales = findLocales(project, options.locale || []);
      lintI18n(project, locales);
    });

  prog
    .command('build')
    .option(localeOption, localeOptionDesc)
    .option('--dry-run -d', 'Lint the changes that will need to be made to translation files based on the current source code definitions.')
    .example('build')
    .example('build --locale en_US --locale es_MX')
    .example('build -l en_US -l es_MX')
    .describe(
      `Build translation files based on the current message definitions in your source code.` + 
      `For each message bag, updates the type definition in ${kleur.underline(`${PATH_TO_I18N}/message/bag/id/type.ts`)}.` +
      `Adds missing locale translation files with the untranslated messages.` +
      `Existing translation files will not be modified -- they need to be updated by hand.` 

    )
    .action(async (options) => {
      const project = getTsProject();
      const locales = findLocales(project, options.locale || []);
      const dryRun = options.d === true;
      await build(project, locales, dryRun)
    });
  prog.parse(process.argv);
};
main();
