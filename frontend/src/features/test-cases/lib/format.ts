export function shortId(id: string): string {
  return id.slice(0, 8);
}

// These render during SSR, so locale and timezone must be pinned — resolving
// them from the environment yields different output on the Node server than in
// the browser and trips a hydration mismatch. UTC is also the sane default for
// comparing load-test runs.
const LOCALE = 'en-US';

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return `${new Date(iso).toLocaleString(LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })} UTC`;
}

/**
 * Reads the current time, so its output differs between the server render and
 * the client render. Only call it behind `useHydrated()`.
 */
export function formatRelative(iso?: string): string {
  if (!iso) return '—';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return '—';

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatPercent(value?: number, digits = 1): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMs(value?: number): string {
  if (value == null) return '—';
  return `${Math.round(value)} ms`;
}

export function formatNumber(value?: number): string {
  if (value == null) return '—';
  return value.toLocaleString(LOCALE);
}

export function formatRps(value?: number): string {
  if (value == null) return '—';
  return `${value.toLocaleString(LOCALE)} rps`;
}
