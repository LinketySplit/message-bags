#!/usr/bin/env node

/**
 * !!!! NOTE !!!
 * All the imports of shared things need to include .js in the path.
 */
import sade from 'sade';
import { bold, gray, green, red, dim, underline } from 'kleur/colors';
import { FUNC_NAME } from './shared.js'
import { parseSourceFiles } from './parse-source/parse-source-files.js';
import type { ValidParsedSourceCallResult } from './types.js';
import { buildFiles } from './build/build-files.js';
import { parseTranslationFiles } from './parse-translations/parse-translations.js';


export const lint = async () => {
  const start = Date.now();
  const filesResult = await parseSourceFiles();
  const { callResults } = filesResult;

  callResults.forEach((r) => {
    const fd = `${underline(r.sourceFilePath)} [${r.line},${r.column}]`;
    if (r.error) {
      console.log(red(`✗ ${fd}`), gray(r.error.message));
    } else {
      console.log(green(`✓ ${fd}`),  dim(r.description ? r.description[0].trim() : 'No description found.'));
    }
  });
  const elapsed = Date.now() - start;
  console.log(
    dim(`Linting done in ${bold(elapsed)}ms.`),
    dim(`${bold(callResults.length)} calls to ${FUNC_NAME} found.`)
  );
  const errors = callResults.filter((c) => c.error !== null);
  if (errors.length > 0) {
    console.log(red(`${bold(errors.length)} invalid calls found.`));
  }
  const foo = await parseTranslationFiles(filesResult.callResults as ValidParsedSourceCallResult[], [] )
  return filesResult;
};

export const build = async (localesToAdd: string[]) => {
  const filesResult = await lint();
  if (filesResult.errorCount > 0) {
    console.log(red('Build cancelled because errors were found.'))
  }
  const valid: ValidParsedSourceCallResult[] = filesResult.callResults.filter(c => c.error === null) as ValidParsedSourceCallResult[];
  const tResult = await parseTranslationFiles(valid, localesToAdd);
  if (! tResult.locales.length) {
    console.log(red(`No existing locales found and no new locales specified.`));
    console.log(dim('Add a locale with the -l <LOCALE> flag.'))
    return;
  }
  await buildFiles(valid, tResult.locales);
};
export const main = () => {
  const prog = sade('skint');

  prog
    .command('lint')
    .describe(
      `Lint the project's message definitions and corresponding translations.`
    )
    .example('lint')
    .action(async () => {
      await lint();
    });
  prog
    .command('build')
    .option('--locale -l', 'A locale to add (or ensure already exists). You can repeat this flag for multiple locales. Existing locales will always also be included.')
    .example('build')
    .example('build -l en_US -l es_MX')
    .describe(
      `Build the project's translation files.`
    )
    .action(async (options) => {
      await build(options.locale || []);
    });
  prog.parse(process.argv);
};
main();
