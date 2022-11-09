import glob from 'tiny-glob';
import { LintError } from '../utils/errors.js';
import { parseSourceFile } from './parse-source-file.js';
import type { ParseSourceFilesResult, ParsedSourceCallResult } from '../types.js';
import { PATH_TO_I18N } from '$lib/shared.js';

export const parseSourceFiles = async (): Promise<ParseSourceFilesResult> => {
  const result: ParseSourceFilesResult = {
    callResults: [],
    callCount: 0,
    errorCount: 0
  };
  const globPattern = 'src/**/*.{js,svelte,ts}';
  const files = await glob(globPattern);
  for (const sourceFilePath of files) {
    if (sourceFilePath.startsWith(PATH_TO_I18N)) {
      continue;
    }
    const fileResult = await parseSourceFile(sourceFilePath);
    if (fileResult) {
      result.callResults.push(...fileResult.callResults);
    }
  }
  const uniqueCallsById: ParsedSourceCallResult[] = [];
  result.callResults.forEach((c) => {
    if (c.error) {
      return;
    }
    const other = uniqueCallsById.find((o) => o.messageId === c.messageId);
    if (other) {
      c.error = new LintError(
        `The messageId "${c.messageId}" has already been used in ${other.sourceFilePath} on line ${other.line}. All ids must be unique.`,
        c.sourceFilePath,
        c.line,
        c.column
      );
      return;
    }
    uniqueCallsById.push(c);
  });

  return result;
};
