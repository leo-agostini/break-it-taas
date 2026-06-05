import http from 'k6/http';
import { check } from 'k6';

const config = JSON.parse(__ENV.RUN_CONFIG_JSON || '{}');
const loadProfile = config.loadProfile || { mode: 'CONSTANT', config: {} };

const TIME_UNIT_TO_SECONDS = {
  SECONDS: 1,
  MINUTES: 60,
  HOURS: 3600,
};

const estimateVuEnvelope = (ratePerTimeUnit, timeUnit) => {
  const expectedResponseTimeMs = Math.max(
    1,
    Number(loadProfile.config.expectedResponseTimeMs || 50),
  );
  const secondsPerTimeUnit = timeUnit === '1m' ? 60 : timeUnit === '1h' ? 3600 : 1;
  const ratePerSecond = Math.max(1, Number(ratePerTimeUnit || 1)) / secondsPerTimeUnit;
  const estimatedConcurrent = ratePerSecond * (expectedResponseTimeMs / 1000);
  const preAllocatedVUs = Math.max(1, Math.ceil(estimatedConcurrent * 2));
  const defaultMaxCap = 2000;
  const configuredMaxCap = Number(config.maxVUsCap || __ENV.K6_MAX_VUS_CAP || defaultMaxCap);
  const maxCap = Number.isFinite(configuredMaxCap) && configuredMaxCap > 0 ? configuredMaxCap : defaultMaxCap;
  const maxVUs = Math.min(maxCap, Math.max(preAllocatedVUs + 10, Math.ceil(estimatedConcurrent * 6)));

  return { preAllocatedVUs, maxVUs };
};

const toK6Duration = (duration, timeUnit) => {
  const unit = (timeUnit || 'SECONDS').toUpperCase();
  const totalSeconds = Math.max(1, Number(duration || 1)) * (TIME_UNIT_TO_SECONDS[unit] || 1);
  return `${totalSeconds}s`;
};

const toK6TimeUnit = (timeUnit) => {
  const unit = (timeUnit || 'SECONDS').toUpperCase();
  if (unit === 'MINUTES') return '1m';
  if (unit === 'HOURS') return '1h';
  return '1s';
};

const buildScenario = () => {
  if (loadProfile.mode === 'RAMP') {
    const stages = Array.isArray(loadProfile.config.stages) ? loadProfile.config.stages : [];
    const initialRate = Math.max(1, Number(loadProfile.config.initialRate || 1));
    const timeUnit = toK6TimeUnit(loadProfile.config.timeUnit);
    const mappedStages = stages.map((stage) => ({
      target: Math.max(1, Number(stage.target || 1)),
      duration: toK6Duration(stage.duration, loadProfile.config.timeUnit),
    }));
    const maxTarget = mappedStages.reduce((acc, item) => Math.max(acc, item.target), initialRate);
    const vus = estimateVuEnvelope(maxTarget, timeUnit);

    return {
      executor: 'ramping-arrival-rate',
      startRate: initialRate,
      timeUnit,
      preAllocatedVUs: vus.preAllocatedVUs,
      maxVUs: vus.maxVUs,
      stages: mappedStages.length > 0 ? mappedStages : [{ target: initialRate, duration: '10s' }],
    };
  }

  const targetRate = Math.max(1, Number(loadProfile.config.targetRate || 1));
  const duration = toK6Duration(loadProfile.config.duration, loadProfile.config.timeUnit);
  const timeUnit = toK6TimeUnit(loadProfile.config.timeUnit);
  const vus = estimateVuEnvelope(targetRate, timeUnit);

  return {
    executor: 'constant-arrival-rate',
    duration,
    rate: targetRate,
    timeUnit,
    preAllocatedVUs: vus.preAllocatedVUs,
    maxVUs: vus.maxVUs,
  };
};

const scenario = buildScenario();

const thresholdPolicy = config.thresholdPolicy || {};
const thresholds = {};
if (typeof thresholdPolicy.maxErrorRate === 'number') {
  thresholds.http_req_failed = [`rate<${thresholdPolicy.maxErrorRate}`];
}
if (typeof thresholdPolicy.maxP95ResponseTimeMs === 'number') {
  thresholds.http_req_duration = [...(thresholds.http_req_duration || []), `p(95)<${thresholdPolicy.maxP95ResponseTimeMs}`];
}
if (typeof thresholdPolicy.maxP99ResponseTimeMs === 'number') {
  thresholds.http_req_duration = [...(thresholds.http_req_duration || []), `p(99)<${thresholdPolicy.maxP99ResponseTimeMs}`];
}

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    test_run: scenario,
  },
  thresholds,
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
  const metrics = data.metrics || {};
  const httpReqs = metrics.http_reqs || {};
  const httpReqDuration = metrics.http_req_duration || {};
  const httpReqFailed = metrics.http_req_failed || {};

  const enriched = {
    k6: data,
    execution: {
      scenario: scenario.executor,
      configuredRate: scenario.rate ?? scenario.startRate ?? null,
      configuredTimeUnit: scenario.timeUnit ?? null,
      achievedRps: httpReqs.rate ?? null,
      p95Ms: httpReqDuration.values?.['p(95)'] ?? null,
      p99Ms: httpReqDuration.values?.['p(99)'] ?? null,
      failureRate: httpReqFailed.values?.rate ?? null,
      vusMax: metrics.vus_max?.values?.value ?? null,
      cpuLimitSaturated: null,
    },
  };

  return {
    '/tmp/summary.json': JSON.stringify(enriched),
  };
}
