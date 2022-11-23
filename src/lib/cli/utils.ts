
import prettier from 'prettier';
import type { Node } from 'ts-morph';


export const getStrippedNodeComment = (node: Node): string | null => {
  const stripComment = (input: string): string => {
    return input
      .split(`\n`)
      .map((s) => {
        return extractLineContent(s);
      })
      .filter((s, i, arr) => {
        let empty = [...arr.slice(0, i + 1)].map((s) => s.trim().length === 0);
        if (empty.indexOf(false) === -1) {
          return false;
        }
        empty = [...arr.slice(i)].map((s) => s.trim().length === 0);
        if (empty.indexOf(false) === -1) {
          return false;
        }

        return true;
      })
      .join('\n');
  };
  const extractLineContent = (s: string) => {
    const rxStart = /(^\s*\/\/+)|(^\s*\/\*+)|(^\s*\*+)/;
    const rxEnd = /\*+\/\s*$/;
    let trimmed = s.replace(rxEnd, '');
    const startResult = rxStart.exec(trimmed);
    if (startResult) {
      trimmed = trimmed.replace(startResult[0], '');
    }
    return trimmed;
  };

  const unstripped = node.getFullText().slice(0, node.getLeadingTriviaWidth());
  const stripped = stripComment(unstripped);
  return stripped.trim().length === 0 ? null : stripped;
};

export const encloseComment = (lines: string[]): string => {
  return [
    '',
    '/**',
    ...lines.map(s => ` *${s}`),
    ' */',
    ''
  ].join('\n')
}

export type PrettierOptions = prettier.Options;

export const getPretterOptions = async (): Promise<PrettierOptions> => {
  const options = (await prettier.resolveConfig(process.cwd())) || {};
  return options
}
export const prettify = (
  source: string,
  filePath: string,
  options: PrettierOptions
): string => {
  options.filepath = filePath;
  return prettier.format(source, options);
};



