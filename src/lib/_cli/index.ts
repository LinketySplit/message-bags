#!/usr/bin/env node

import sade from 'sade';
import { getTsProject } from './get-ts-project.js';
import { logBuildResults, logMessageBags } from './log.js';
import { parseMessageBags, parseLocales } from './parse.js';
import { build } from './build.js';
import { dim, bold } from './kleur.js';
import { isDevelopingThisPackage } from './utils.js';

const mainAction = async (
  ensuredLocales: string | string[],
  lintOnly: boolean
) => {
  const start = Date.now();
  const isDev = await isDevelopingThisPackage();
  console.log(isDev)
  console.log(dim('Linting project...'));
  const project = getTsProject();
  const locales = parseLocales(project, ensuredLocales);
  const messageBags = parseMessageBags(project, isDev);
  logMessageBags(messageBags);
  const valid = messageBags.filter((b) => b.error === null);
  let isDryRun = lintOnly;
  if (valid.length < messageBags.length) {
    console.log(dim('Invalid message bag definitions found.'));
    isDryRun = true;
  }
  const buildResults = await build(project, valid, locales, isDryRun);
  logBuildResults(buildResults);
  console.log(dim(`Done in ${bold((Date.now() - start) / 1000)}s`));
};
export const main = () => {
  const localeOption = '--locale -l';
  const localeOptionDesc =
    'A locale to add (or ensure already exists). ' +
    'You can repeat this flag for multiple locales. ' +
    'Existing locales will always also be included.';
  const prog = sade('skint').version(`0.0.1`);

  prog
    .command('lint')
    .option(localeOption, localeOptionDesc)
    .example('lint')
    .example('lint --locale en_US --locale es_MX')
    .example('lint -l en_US -l es_MX')
    .describe(`Lint the project.`)
    .action(async (options) => {
      await mainAction(options.locale || [], true);
    });

  prog
    .command('build')
    .option(localeOption, localeOptionDesc)
    .example('build')
    .example('build --locale en_US --locale es_MX')
    .example('build -l en_US -l es_MX')
    .describe(
      `Build/modify translation files based on the defined message bags.`
    )
    .action(async (options) => {
      await mainAction(options.locale || [], false);
    });
  prog.parse(process.argv);
};
main();
