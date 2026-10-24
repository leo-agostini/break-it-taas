import app from '@adonisjs/core/services/app';
import { defineConfig, stores } from '@adonisjs/session';
import env from '#start/env';

/**
 * The session cookie is the only auth credential (ADR-008). Frontend and
 * backend are served from unrelated public domains, so in production the
 * cookie has to be `SameSite=None; Secure` for the browser to attach it to the
 * frontend's cross-site XHRs. Local same-host development keeps `Lax`.
 */
const sameSite = env.get('SESSION_SAMESITE', 'lax');

const sessionConfig = defineConfig({
  enabled: true,
  cookieName: 'breakit-session',
  clearWithBrowser: false,

  /**
   * Idle lifetime. Every authenticated request touches the session, so an
   * active user is never logged out mid-work; seven days matches the refresh
   * token window the JWT setup used to offer.
   */
  age: '7d',

  cookie: {
    path: '/',
    httpOnly: true,
    // Browsers reject SameSite=None without Secure.
    secure: env.get('SESSION_SECURE', app.inProduction) || sameSite === 'none',
    sameSite,
  },

  store: env.get('SESSION_DRIVER'),

  stores: {
    cookie: stores.cookie(),
  },
});

export default sessionConfig;
