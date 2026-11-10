import { FARO_URL, IS_SSR, MODE } from '@/lib/env';
import {
  faro,
  getWebInstrumentations,
  initializeFaro,
} from '@grafana/faro-react';
import { isAxiosError } from 'axios';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

/*
 * Browser telemetry through Grafana Faro (ADR-009). Faro sends to Alloy's
 * faro.receiver, which writes everything to Loki, where the Frontend dashboard
 * reads it.
 *
 * The web instrumentations already cover uncaught errors and promise
 * rejections, console output, web vitals and sessions. Three things are
 * reported by hand, with the helpers below: page views, errors that React
 * Router catches itself, and failed API calls. There is no Faro React Router
 * integration because its helpers wrap <Routes> or the router factory, and
 * framework mode owns both; its own URL-change detection also missed
 * client-side navigations in testing, hence the explicit page_view event.
 */

export function initObservability() {
  if (IS_SSR || !FARO_URL) return;

  initializeFaro({
    url: FARO_URL,
    app: { name: 'breakit-frontend', environment: MODE },
    // Persistent sessions survive reloads, so "sessions" on the dashboard
    // counts visits rather than page loads.
    sessionTracking: { enabled: true, persistent: true },
    instrumentations: getWebInstrumentations({ captureConsole: true }),
    // Faro reports console.error as an exception by default, which would mix
    // logged messages into the exception count; keep them as error-level logs.
    consoleInstrumentation: { consoleErrorAsLog: true },
  });
}

/** `faro.api` only exists once initObservability has run in a browser. */
export function reportError(error: unknown) {
  if (!faro.api) return;

  faro.api.pushError(error instanceof Error ? error : new Error(String(error)));
}

/**
 * Failed API calls are handled by the UI (toasts, redirects), so they never
 * reach Faro's global error handler. Only server errors and requests that got
 * no response are reported; 4xx responses are expected outcomes such as an
 * expired session or a validation message.
 */
export function reportApiError(error: unknown) {
  if (!faro.api || !isAxiosError(error)) return;

  const status = error.response?.status;
  if (status !== undefined && status < 500) return;

  faro.api.pushEvent('api_error', {
    status: String(status ?? 'network'),
    method: (error.config?.method ?? 'get').toUpperCase(),
    url: error.config?.url ?? '',
  });
}

/**
 * One `page_view` event per location, the first render included. Only the
 * pathname is sent: query strings can carry user input.
 */
export function useTrackPageViews() {
  const { pathname } = useLocation();

  useEffect(() => {
    faro.api?.pushEvent('page_view', { path: pathname });
  }, [pathname]);
}
