import type { TestType } from '@/features/test-cases/types/test-case';
import type { TestRunStatus } from '@/features/test-cases/types/test-run';

export const runStatusStyles: Record<
  TestRunStatus,
  { dot: string; badge: string; label: string }
> = {
  CREATED: {
    label: 'Created',
    dot: 'bg-zinc-400',
    badge: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
  QUEUED: {
    label: 'Queued',
    dot: 'bg-sky-400',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  RUNNING: {
    label: 'Running',
    dot: 'bg-amber-400 animate-pulse',
    badge:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  SUCCEEDED: {
    label: 'Succeeded',
    dot: 'bg-emerald-400',
    badge:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  FAILED: {
    label: 'Failed',
    dot: 'bg-red-400',
    badge: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  },
  TIMEOUT: {
    label: 'Timeout',
    dot: 'bg-orange-400',
    badge:
      'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: 'bg-slate-400',
    badge:
      'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
};

export const testTypeStyles: Record<TestType, string> = {
  SPIKE: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  STRESS:
    'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  SMOKE: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  AVG_LOAD:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  SOAK: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  BREAKPOINT:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

const TERMINAL_STATUSES: TestRunStatus[] = [
  'SUCCEEDED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
];

export function isTerminal(status: TestRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const RUN_POLL_INTERVAL_MS = 5000;

export function isRunActive(run: { status: TestRunStatus }): boolean {
  return !isTerminal(run.status);
}

export function hasActiveRun(runs?: Array<{ status: TestRunStatus }>): boolean {
  return runs?.some(isRunActive) ?? false;
}

export const loadModesByTestType: Record<
  TestType,
  Array<'CONSTANT' | 'RAMP'>
> = {
  SMOKE: ['CONSTANT'],
  SOAK: ['CONSTANT'],
  SPIKE: ['RAMP'],
  BREAKPOINT: ['RAMP'],
  AVG_LOAD: ['CONSTANT', 'RAMP'],
  STRESS: ['CONSTANT', 'RAMP'],
};
