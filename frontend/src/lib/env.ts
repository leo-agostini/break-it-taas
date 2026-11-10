/**
 * Single source of truth for the frontend's environment variables.
 *
 * Every `import.meta.env.VITE_*` read lives here — modules import `env`
 * instead of touching `import.meta.env` directly, so defaults and validation
 * stay in one place.
 *
 * Note: `VITE_API_PROXY_TARGET` is intentionally *not* here. It is consumed by
 * `vite.config.ts` through `process.env` at config time (Node), never by
 * application code, and importing this module there would not work.
 */

declare global {
  interface ImportMetaEnv {
    /** Base URL the browser uses to reach the backend API. */
    readonly VITE_API_URL?: string;
    /** Base URL the SSR process uses to reach the backend API. */
    readonly VITE_API_SERVER_URL?: string;
    /** Grafana Faro collector URL. Empty disables browser telemetry. */
    readonly VITE_FARO_URL?: string;
  }
}

const DEFAULT_API_URL = '/api';

/** Base URL the browser uses to reach the backend API. */
export const API_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

/**
 * Base URL the SSR process uses to reach the backend API. Falls back to
 * {@link API_URL}, which may be a relative path resolved against the incoming
 * request origin.
 */
export const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL ?? API_URL;

/**
 * Grafana Faro collector (Alloy's faro.receiver). Empty, the default, turns
 * browser telemetry off, so a build without the observability stack never
 * tries to reach a collector that is not there.
 */
export const FARO_URL = import.meta.env.VITE_FARO_URL ?? '';

/** Vite's build mode (`development`, `production`, ...). */
export const MODE = import.meta.env.MODE;

/** True when running the dev server. */
export const IS_DEV = import.meta.env.DEV;

/** True when running a production build. */
export const IS_PROD = import.meta.env.PROD;

/** True when the code is executing in the SSR process instead of the browser. */
export const IS_SSR = import.meta.env.SSR;

export const env = {
  API_URL,
  API_SERVER_URL,
  FARO_URL,
  MODE,
  IS_DEV,
  IS_PROD,
  IS_SSR,
} as const;
