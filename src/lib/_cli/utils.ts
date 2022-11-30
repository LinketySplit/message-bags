import type { PrettierOptions } from './types.js';
import prettier from 'prettier';
import { Node, Project } from 'ts-morph';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PACKAGE_NAME } from './constants.js';

export const getObjectPath = (parentPath: string, key: string) => {
  return [parentPath, key].filter((s) => s.length > 0).join('.');
};

export const getTsProject = (): Project => {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json'
  });
  return project;
};

export const isDevelopingThisPackage = async (): Promise<boolean> => {
  try {
    const json = await readFile(join(process.cwd(), 'package.json'), 'utf-8');
    const result = JSON.parse(json);
    if (
      Object.prototype.toString.call(result) === '[object Object]' &&
      result.name === PACKAGE_NAME
    ) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

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

export const encloseComment = (raw: string): string => {
  const trimmedLines = raw
    .split('\n')
    .map((s) => s.replace(/^\s/, ''))
    .map((s) => ` ${s}`);
  return ['', '/**', ...trimmedLines.map((s) => ` *${s}`), ' */', ''].join(
    '\n'
  );
};

export const getPretterOptions = async (): Promise<PrettierOptions> => {
  const options = (await prettier.resolveConfig(process.cwd())) || {};
  return options;
};
export const prettify = (
  source: string,
  filePath: string,
  options: PrettierOptions
): string => {
  options.filepath = filePath;
  return prettier.format(source, options);
};
