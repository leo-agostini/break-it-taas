import { check } from 'k6';
import http from 'k6/http';
import {
  buildScenario,
  buildThresholds,
  needsResponseBodies,
  resolveBreakingPoint,
  thresholdsBreached,
} from './profile.js';

const config = JSON.parse(__ENV.RUN_CONFIG_JSON || '{}');
const loadProfile = config.loadProfile || { mode: 'CONSTANT', config: {} };

const scenario = buildScenario(loadProfile, {
  maxVUsCap: Number(__ENV.K6_MAX_VUS_CAP) || undefined,
});

export const options = {
  // Bodies cost memory, so they are only kept when a step actually asserts on
  // their content.
  discardResponseBodies: !needsResponseBodies(config.steps),
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    test_run: scenario,
  },
  thresholds: buildThresholds(config.thresholdPolicy),
};

function buildUrl(step) {
  const path = step.path.startsWith('/') ? step.path : `/${step.path}`;
  return `${config.targetSystem.baseUrl}${path}`;
}

function runStep(step) {
  const method = (step.method || 'GET').toUpperCase();
  const headers = step.headers || {};
  const body = step.body ? JSON.stringify(step.body) : undefined;
  const requestTimeoutMs = Math.max(100, Number(config.requestTimeoutMs || 3000));
  const response = http.request(method, buildUrl(step), body, {
    headers,
    timeout: `${requestTimeoutMs}ms`,
  });

  if (!Array.isArray(step.checks)) {
    return;
  }

  const assertions = {};
  for (const rule of step.checks) {
    if (rule.kind === 'STATUS_CODE') {
      assertions[`status=${rule.expected}`] = (res) => res.status === rule.expected;
    }
    if (rule.kind === 'RESPONSE_TIME_LT') {
      assertions[`rt<${rule.maxMs}`] = (res) => res.timings.duration < rule.maxMs;
    }
    if (rule.kind === 'BODY_CONTAINS') {
      assertions[`body contains ${rule.value}`] = (res) =>
        String(res.body || '').includes(rule.value);
    }
  }

  if (Object.keys(assertions).length > 0) {
    check(response, assertions);
  }
}

export default function () {
  const steps = Array.isArray(config.steps) && config.steps.length > 0
    ? config.steps
    : [{ path: '/health', method: 'GET', checks: [] }];

  for (const step of steps) {
    runStep(step);
  }
}

export function handleSummary(data) {
  const elapsedSeconds = Number(data.state?.testRunDurationMs || 0) / 1000;
  const aborted = thresholdsBreached(data);

  // Spread k6's own summary at the top level: the backend projection reads
  // `summary.metrics.*`, and this is the only writer of the file now that
  // run.sh no longer passes --summary-export.
  return {
    '/tmp/summary.json': JSON.stringify({
      ...data,
      execution: {
        testType: config.testType || null,
        scenario: scenario.executor,
        configuredRate: scenario.rate ?? scenario.startRate ?? null,
        configuredTimeUnit: scenario.timeUnit ?? null,
        configuredVus: scenario.vus ?? scenario.startVUs ?? null,
        elapsedSeconds,
        aborted,
        // Where the system gave out — the number a BREAKPOINT test exists for.
        breakingPointRate: aborted
          ? resolveBreakingPoint(loadProfile, elapsedSeconds)
          : null,
        vusMax: data.metrics?.vus_max?.values?.value ?? null,
      },
    }),
  };
}
