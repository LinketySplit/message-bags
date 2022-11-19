import type { SkintConfig } from './types';

const configGlob = import.meta.glob('/src/sk18nt.config.ts', {
  import: 'default'
});

export const loadConfig = async (): Promise<SkintConfig> => {
  let config: SkintConfig | undefined;
  if (configGlob['/src/sk18nt.config.ts']) {
    config = (await configGlob['/src/sk18nt.config.ts']()) as
      | SkintConfig
      | undefined;
  }
  if (!config) {
    throw new Error(
      `Skint config not defined. are you sure you've defined a config in src/sk18nt.config.ts?`
    );
  }
  return config;
};
