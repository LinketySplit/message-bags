export type MessageBag = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: MessageBag | string | ((...args: any) => string);
};

export type SkintConfig = {
  /**
   * The path from the project root, without a leading slash.
   * @example 'src/translations'
   */
  translationModulesPath: string;

  /**
   * The result of calling...
   * `import.meta.glob(</path/to/translations/dir>, {import: 'messages'})`
   *
   * The first argument to `import.meta.glob` must match `translationsPath`, but with a leading slash.
   * This is because `import.meta.glob` only accepts a string literal. In other words,
   * you have to define the string twice in the config, once as `translationsPath` and again
   * in the call to `import.meta.glob`.
   *
   * The second argument must be exactly `{import: 'messages'}`.
   *
   * @example `import.meta.glob('/src/translations', {import: 'messages'})`
   */
  translationModuleLoaders: Record<string, () => Promise<unknown>>;
};
