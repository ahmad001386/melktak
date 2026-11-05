export function getPlatformPath(env = process.env): string {
  const value = env.PLATFORM_PATH?.trim();
  if (!value) {
    if (env.NODE_ENV === 'production') throw new Error('PLATFORM_PATH is required in production.');
    return '/platform';
  }
  // One literal path segment: safe in Express routes, HTML and inline JavaScript.
  if (!/^\/[a-zA-Z][a-zA-Z0-9_-]{15,79}$/.test(value) || /^\/(api|assets|uploads|shared)(?:-|_|$)/i.test(value)) {
    throw new Error('PLATFORM_PATH must be a unique / followed by 16–80 letters, digits, underscores or hyphens.');
  }
  return value;
}

export function getPlatformCredentials(env = process.env) {
  const username = env.PLATFORM_ADMIN_USERNAME?.trim().toLowerCase();
  const password = env.PLATFORM_ADMIN_PASSWORD;
  if (!username && !password && env.NODE_ENV !== 'production') return null;
  if (!username || !/^[a-z0-9_.-]{3,80}$/.test(username) || !password || password.length < 16 || Buffer.byteLength(password) > 72) {
    throw new Error('Configure PLATFORM_ADMIN_USERNAME (3–80 characters) and PLATFORM_ADMIN_PASSWORD (16+ characters, at most 72 UTF-8 bytes).');
  }
  if (/^(REPLACE|CHANGE|YOUR_|example)/i.test(password)) throw new Error('Replace the example platform password with a generated secret.');
  return { username, password };
}

export function validateRuntimeConfig() {
  getPlatformPath();
  getPlatformCredentials();
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_DATA === 'true') {
    throw new Error('Demo seeding is not allowed in production.');
  }
}

// Production uses the explicitly configured platform owner. Legacy/default
// accounts remain in the database for audit, but cannot authenticate.
export function platformAdminAllowed(username: string): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return username === getPlatformCredentials()?.username;
}
