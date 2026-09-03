// Pure translation from the backend's run config into k6 options.
//
// Kept free of k6 imports so it can be unit-tested from the backend suite
// (backend/src/tests/runner/k6-profile.spec.ts); script.js supplies the parts
// that actually need the k6 runtime.

const TIME_UNIT_TO_SECONDS = {
  SECONDS: 1,
  MINUTES: 60,
  HOURS: 3600,
};

const DEFAULT_MAX_VUS_CAP = 2000;

export const toK6Duration = (duration, timeUnit) => {
  const unit = (timeUnit || 'SECONDS').toUpperCase();
  const totalSeconds =
    Math.max(1, Number(duration || 1)) * (TIME_UNIT_TO_SECONDS[unit] || 1);
  return `${totalSeconds}s`;
};

export const toK6TimeUnit = (timeUnit) => {
  const unit = (timeUnit || 'SECONDS').toUpperCase();
  if (unit === 'MINUTES') return '1m';
  if (unit === 'HOURS') return '1h';
  return '1s';
};

/**
 * Sizes the VU pool that serves the requested arrival rate.
 *
 * Arrival-rate executors need enough VUs to keep issuing requests at the target
 * rate; if the pool runs dry k6 drops iterations, which surfaces later as
 * `generatorLimited` on the run report.
 */
export const estimateVuEnvelope = (ratePerTimeUnit, timeUnit, config = {}) => {
  const expectedResponseTimeMs = Math.max(
    1,
    Number(config.expectedResponseTimeMs || 50),
  );
  const secondsPerTimeUnit =
    timeUnit === '1m' ? 60 : timeUnit === '1h' ? 3600 : 1;
  const ratePerSecond =
    Math.max(1, Number(ratePerTimeUnit || 1)) / secondsPerTimeUnit;
  const estimatedConcurrent = ratePerSecond * (expectedResponseTimeMs / 1000);
  const preAllocatedVUs = Math.max(1, Math.ceil(estimatedConcurrent * 2));
  const configuredMaxCap = Number(config.maxVUsCap || DEFAULT_MAX_VUS_CAP);
  const maxCap =
    Number.isFinite(configuredMaxCap) && configuredMaxCap > 0
      ? configuredMaxCap
      : DEFAULT_MAX_VUS_CAP;
  const maxVUs = Math.min(
    maxCap,
    Math.max(preAllocatedVUs + 10, Math.ceil(estimatedConcurrent * 6)),
  );

  return { preAllocatedVUs, maxVUs };
};

export const buildScenario = (loadProfile, options = {}) => {
  const profile = loadProfile || { mode: 'CONSTANT', config: {} };
  const config = profile.config || {};

  if (profile.mode === 'RAMP') {
    const stages = Array.isArray(config.stages) ? config.stages : [];
    const initialRate = Math.max(0, Number(config.initialRate || 0));
    const timeUnit = toK6TimeUnit(config.timeUnit);
    const mappedStages = stages.map((stage) => ({
      // A target of 0 is meaningful — it is how a ramp-down ends — so it must
      // not be clamped up to 1 the way a rate ceiling would be.
      target: Math.max(0, Number(stage.target || 0)),
      duration: toK6Duration(stage.duration, config.timeUnit),
    }));
    const maxTarget = mappedStages.reduce(
      (acc, item) => Math.max(acc, item.target),
      initialRate,
    );
    const vus = estimateVuEnvelope(maxTarget, timeUnit, {
      ...options,
      ...config,
    });

    return {
      executor: 'ramping-arrival-rate',
      startRate: initialRate,
      timeUnit,
      preAllocatedVUs: vus.preAllocatedVUs,
      maxVUs: vus.maxVUs,
      stages:
        mappedStages.length > 0
          ? mappedStages
          : [{ target: initialRate, duration: '10s' }],
    };
  }

  const targetRate = Math.max(1, Number(config.targetRate || 1));
  const duration = toK6Duration(config.duration, config.timeUnit);
  const timeUnit = toK6TimeUnit(config.timeUnit);
  const vus = estimateVuEnvelope(targetRate, timeUnit, {
    ...options,
    ...config,
  });

  return {
    executor: 'constant-arrival-rate',
    duration,
    rate: targetRate,
    timeUnit,
    preAllocatedVUs: vus.preAllocatedVUs,
    maxVUs: vus.maxVUs,
  };
};

/**
 * Translates the threshold policy into k6 thresholds.
 *
 * With `abortOnFail`, k6 stops the run as soon as a threshold is breached —
 * the mechanic a BREAKPOINT test depends on to find where the system gives
 * out. `delayAbortEval` keeps the first noisy seconds of a ramp from aborting
 * the run before it has meaningfully started.
 */
export const buildThresholds = (thresholdPolicy = {}) => {
  const abortOnFail = Boolean(thresholdPolicy.abortOnFail);
  const wrap = (expression) =>
    abortOnFail
      ? { threshold: expression, abortOnFail: true, delayAbortEval: '10s' }
      : expression;

  const thresholds = {};
  const durationExpressions = [];

  if (typeof thresholdPolicy.maxErrorRate === 'number') {
    thresholds.http_req_failed = [wrap(`rate<${thresholdPolicy.maxErrorRate}`)];
  }
  if (typeof thresholdPolicy.maxP95ResponseTimeMs === 'number') {
    durationExpressions.push(wrap(`p(95)<${thresholdPolicy.maxP95ResponseTimeMs}`));
  }
  if (typeof thresholdPolicy.maxP99ResponseTimeMs === 'number') {
    durationExpressions.push(wrap(`p(99)<${thresholdPolicy.maxP99ResponseTimeMs}`));
  }
  if (durationExpressions.length > 0) {
    thresholds.http_req_duration = durationExpressions;
  }
  if (typeof thresholdPolicy.minCheckSuccessRate === 'number') {
    thresholds.checks = [wrap(`rate>${thresholdPolicy.minCheckSuccessRate}`)];
  }

  return thresholds;
};

/**
 * k6 discards response bodies by default here to save memory, but that makes a
 * BODY_CONTAINS check compare against an empty string and always fail.
 */
export const needsResponseBodies = (steps) => {
  if (!Array.isArray(steps)) return false;
  return steps.some(
    (step) =>
      Array.isArray(step.checks) &&
      step.checks.some((rule) => rule.kind === 'BODY_CONTAINS'),
  );
};

/**
 * The arrival rate the profile had reached at a given point in the run.
 *
 * When an abortOnFail threshold stops a BREAKPOINT test, this is the number
 * that matters: the load the target system could no longer sustain. Stages ramp
 * linearly from the previous target, so the rate is interpolated within the
 * stage the run was in when it stopped.
 */
export const resolveBreakingPoint = (loadProfile, elapsedSeconds) => {
  const profile = loadProfile || { mode: 'CONSTANT', config: {} };
  const config = profile.config || {};

  if (profile.mode !== 'RAMP') {
    return Math.max(0, Number(config.targetRate || 0));
  }

  const stages = Array.isArray(config.stages) ? config.stages : [];
  const unit = (config.timeUnit || 'SECONDS').toUpperCase();
  const secondsPerUnit = TIME_UNIT_TO_SECONDS[unit] || 1;

  let rateAtStageStart = Math.max(0, Number(config.initialRate || 0));
  let remaining = Math.max(0, Number(elapsedSeconds || 0));

  for (const stage of stages) {
    const target = Math.max(0, Number(stage.target || 0));
    const stageSeconds = Math.max(1, Number(stage.duration || 1)) * secondsPerUnit;

    if (remaining < stageSeconds) {
      const progress = remaining / stageSeconds;
      return rateAtStageStart + (target - rateAtStageStart) * progress;
    }

    remaining -= stageSeconds;
    rateAtStageStart = target;
  }

  return rateAtStageStart;
};

/** True when any k6 threshold in the summary was breached. */
export const thresholdsBreached = (summary) => {
  const metrics = (summary && summary.metrics) || {};
  return Object.values(metrics).some((metric) => {
    const thresholds = (metric && metric.thresholds) || {};
    return Object.values(thresholds).some(
      (result) => result && result.ok === false,
    );
  });
};
