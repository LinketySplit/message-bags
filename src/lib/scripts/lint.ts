import kleurPkg from 'kleur';
import { parseProject } from './parse.js';
import type { ParsedProjectResult } from './shared.js';
const { bold, underline, red, green, dim } = kleurPkg;
export const lint = (localesToAdd: string[]): ParsedProjectResult => {
  const start = Date.now();
  console.log(dim('Linting calls...'));
  const result = parseProject(localesToAdd);
  const {total, valid, invalid} = result.sourceCallsResult.callCounts;
  const countMessages = [
    `${total} call${total !== 1 ? 's' : ''} found.`
  ];
  if (valid > 0) {
    countMessages.push(`${green(valid)} valid.`);
  }
  if (invalid > 0) {
    countMessages.push(`${red(invalid)} invalid.`);
  }
  console.log(...countMessages);

  result.sourceCallsResult.calls.forEach((call) => {
    if (call.error) {
      console.log(red('✗'), underline(call.fileName), dim(call.lineCol));
      console.log(
        red(' '),
        bold(red(`Error ${call.error.lineCol}:`)),
        call.error.message
      );
    } else {
      console.log(green('✓'), underline(call.fileName), dim(call.lineCol));
    }
  });
  if (invalid === 0) {
    console.log();
    console.log(
      result.sourceCallsResult.messageBags.length,
      `message bag${result.sourceCallsResult.messageBags.length === 1 ? '' : 's'} found.`
    );
    console.log('---------------------');
    result.sourceCallsResult.messageBags.forEach((bag) => {
      console.log(`Id: ${bag.messageBagId}`);
      console.log(`Definitions: ${bag.definitions.length}`);
      bag.definitions.forEach((def) => {
        console.log('   -', def.objectPath, def.definitionNode.getKindName());
      });
      console.log('---------------------');
    });
  }
  console.log(dim(`Done linting in ${(Date.now() - start) / 1000}s`));
  console.log(result.localeNames)
  return result;
};
