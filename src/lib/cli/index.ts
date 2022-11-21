#!/usr/bin/env node

import sade from 'sade';
import { getTsProject } from './get-ts-project.js';
import { logMessageBags } from './log.js';
import { parseProject } from './parse.js';
import { write } from './write.js';
import { red, dim } from './kleur.js';
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
    .action((options) => {
      const project = getTsProject();
      const ensuredLocales = options.locale || [];
      const result = parseProject(project, ensuredLocales);
      
      
      
    });

  prog
    .command('build')
    .option(localeOption, localeOptionDesc)
    .example('build')
    .example('bulid --locale en_US --locale es_MX')
    .example('build -l en_US -l es_MX')
    .describe(`Build the project's translation files.`)
    .action(async (options) => {
      //
    });
  prog.parse(process.argv);
};
main();
