#!/usr/bin/env node

/**
 * !!!! NOTE !!!
 * All the imports of shared things need to include .js in the path.
 */
import sade from 'sade';
import { lint } from './lint.js';
import { build } from './build.js';

export const main = () => {
  const localeOption = '--locale -l';
  const localeOptionDesc =
    'A locale to add (or ensure already exists). ' +
    'You can repeat this flag for multiple locales. ' +
    'Existing locales will always also be included.';
  const prog = sade('skint')
    .version(`0.0.1`);

  prog
    .command('lint')
    .option(localeOption, localeOptionDesc)
    .describe(
      `Lint the project's message definitions and corresponding translations.`
    )
    .example('lint')
    .example('lint --locale en_US --locale es_MX')
    .example('lint -l en_US -l es_MX')
    .action(async (options) => {
      lint(options.locale || []);
    });
  prog
    .command('build')
    .option(localeOption, localeOptionDesc)
    .example('build')
    .example('bulid --locale en_US --locale es_MX')
    .example('build -l en_US -l es_MX')
    .describe(`Build the project's translation files.`)
    .action(async (options) => {
      await build(options.locale || []);
    });
  prog.parse(process.argv);
};
main();
