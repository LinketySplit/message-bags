import prettier from 'prettier';

export const prettify = async (
  source: string,
  filePath: string
): Promise<string> => {
  const options = (await prettier.resolveConfig(process.cwd())) || {};
  options.filepath = filePath;
  return prettier.format(source, options);
};
