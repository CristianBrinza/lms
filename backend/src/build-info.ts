/** Set by scripts/build.mjs for the bundled server; development and tests run from source. */
declare const __APP_VERSION__: string | undefined;
declare const __APP_BUILT_AT__: string | undefined;

export const BUILD = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
  builtAt: typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : null,
} as const;
