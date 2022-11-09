import type { ILintError } from './utils/errors.js';

export type ParseSourceFilesResult = {
  callResults: ParsedSourceCallResult[];
  callCount: number;
  errorCount: number;
};
export type ParsedSourceFileResult = {
  sourceFilePath: string;
  callResults: ParsedSourceCallResult[];
};
export type SourceCallType = 'function' | 'string';

export type ParsedSourceCallResult = {
  sourceFilePath: string;
  line: number;
  column: number;
  messageId: string | null;
  messageKey: string | null;
  messageBagId: string | null;
  type: SourceCallType | null;
  description: string[] | null;
  fnDataType: string | null;
  fnBody: string | null;
  strBody: string | null;
  error: ILintError | null;
};
export type ValidParsedSourceCallResult<T = SourceCallType> =
  ParsedSourceCallResult & {
    messageId: string;
    messageKey: string;
    messageBagId: string;
    type: T;
    description: string[];
    error: null;
    fnDataType: T extends 'function' ? string : null;
    fnBody: T extends 'function' ? string : null;
    strBody: T extends 'string' ? string : null;
  };

export type ParsedTranslationFilesResult = {
  locales: string[];
  localesFound: string[];
  localesToAdd: string[]
}

export type TranslationFileResult = {
  messageBagId: string;
};
