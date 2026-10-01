import { ConfigError, loadConfig } from '../src/config';
import { loadDotEnv } from '../src/lib/dotenv';

/** `yarn check-env` (or ENV_FILE=../deploy/.env yarn check-env): says what the API still needs. */
loadDotEnv(process.env.ENV_FILE ?? '.env');
try {
  const config = loadConfig(process.env);
  console.info(`[check-env] OK — ${config.env}, app ${config.appUrl}, cookies ${config.cookieSecure ? 'secure' : 'plain (http)'}, proxy key ${config.proxySecret ? 'set' : 'not set'}`);
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`[check-env] ${error.message}`);
    process.exit(1);
  }
  throw error;
}
