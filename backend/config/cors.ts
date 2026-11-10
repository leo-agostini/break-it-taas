import { defineConfig } from '@adonisjs/cors';
import env from '#start/env';

/**
 * Credentials (the session cookie) ride on every cross-origin request, so the
 * origin must be an explicit allowlist: browsers reject
 * `Access-Control-Allow-Origin: *` together with credentials. `*` is accepted
 * here only as a local-dev shortcut that reflects the request Origin back.
 */
const configuredOrigin = env.get('CORS_ORIGIN', '*').trim();
const origin =
  configuredOrigin === '*'
    ? true
    : configuredOrigin
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

const corsConfig = defineConfig({
  enabled: true,
  origin,
  methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
});

export default corsConfig;
