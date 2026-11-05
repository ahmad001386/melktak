import { postgresDb } from '../src/server/db/postgres.js';
import { getPlatformCredentials } from '../src/server/config/runtime.js';
 
// Execute offline while the application is stopped; credentials come only from environment.
try {
  if (!getPlatformCredentials()) throw new Error('Platform administrator environment variables are required.');
  await postgresDb.init();
  console.log('Platform administrator provisioned. Changed passwords revoke previous sessions.');
} catch {
  console.error('Provisioning failed. Check configuration and database access; existing data was preserved.');
  process.exitCode = 1;
} finally {
  if (postgresDb.pg) await postgresDb.pg.close();
}
 