import { test } from '@japa/runner';
import {
  buildScenario,
  buildThresholds,
  needsResponseBodies,
  resolveBreakingPoint,
  thresholdsBreached,
} from '../../../../ops/k6-runner/profile.js';

test.group('k6 runner scenario building', () => {
  test('runs a CONSTANT profile as a constant arrival rate', ({ expect }) => {
    const scenario = buildScenario({
      mode: 'CONSTANT',
      config: { targetRate: 50, duration: 30, timeUnit: 'SECONDS' },
    });

    expect(scenario.executor).toBe('constant-arrival-rate');
    expect(scenario.rate).toBe(50);
    expect(scenario.duration).toBe('30s');
    expect(scenario.timeUnit).toBe('1s');
  });

  test('converts a CONSTANT duration expressed in minutes', ({ expect }) => {
    const scenario = buildScenario({
      mode: 'CONSTANT',
      config: { targetRate: 10, duration: 5, timeUnit: 'MINUTES' },
    });

    expect(scenario.duration).toBe('300s');
    expect(scenario.timeUnit).toBe('1m');
  });

  test('runs a RAMP profile as a ramping arrival rate with mapped stages', ({
    expect,
  }) => {
    const scenario = buildScenario({
      mode: 'RAMP',
      config: {
        initialRate: 0,
        timeUnit: 'MINUTES',
        stages: [
          { target: 100, duration: 5 },
          { target: 100, duration: 30 },
          { target: 0, duration: 5 },
        ],
      },
    });

    expect(scenario.executor).toBe('ramping-arrival-rate');
    expect(scenario.stages).toEqual([
      { target: 100, duration: '300s' },
      { target: 100, duration: '1800s' },
      { target: 0, duration: '300s' },
    ]);
  });

  test('keeps a spike ramp-down to zero rather than clamping it up to 1', ({
    expect,
  }) => {
    const scenario = buildScenario({
      mode: 'RAMP',
      config: {
        initialRate: 0,
        timeUnit: 'MINUTES',
        stages: [
          { target: 2000, duration: 2 },
          { target: 0, duration: 1 },
        ],
      },
    });

    expect(scenario.stages?.[1]).toEqual({ target: 0, duration: '60s' });
  });
});

test.group('k6 runner threshold building', () => {
  test('builds plain thresholds when the run should not abort', ({
    expect,
  }) => {
    const thresholds = buildThresholds({
      maxErrorRate: 0.05,
      maxP95ResponseTimeMs: 500,
      abortOnFail: false,
    });

    expect(thresholds.http_req_failed).toEqual(['rate<0.05']);
    expect(thresholds.http_req_duration).toEqual(['p(95)<500']);
  });

  test('aborts the run on threshold failure when abortOnFail is set', ({
    expect,
  }) => {
    // This is what makes a BREAKPOINT test stop at the breaking point instead
    // of playing out its whole ramp.
    const thresholds = buildThresholds({
      maxP95ResponseTimeMs: 500,
      abortOnFail: true,
    });

    expect(thresholds.http_req_duration).toEqual([
      { threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '10s' },
    ]);
  });

  test('applies minCheckSuccessRate as a checks threshold', ({ expect }) => {
    const thresholds = buildThresholds({
      minCheckSuccessRate: 0.98,
      abortOnFail: false,
    });

    expect(thresholds.checks).toEqual(['rate>0.98']);
  });

  test('builds no thresholds when the policy is empty', ({ expect }) => {
    expect(buildThresholds({ abortOnFail: false })).toEqual({});
  });
});

test.group('k6 runner response body handling', () => {
  test('keeps response bodies when a step checks their content', ({
    expect,
  }) => {
    const steps = [
      {
        path: '/',
        method: 'GET',
        checks: [{ kind: 'BODY_CONTAINS', value: 'ok' }],
      },
    ];

    expect(needsResponseBodies(steps)).toBe(true);
  });

  test('discards response bodies when no step inspects them', ({ expect }) => {
    const steps = [
      {
        path: '/',
        method: 'GET',
        checks: [{ kind: 'STATUS_CODE', expected: 200 }],
      },
    ];

    expect(needsResponseBodies(steps)).toBe(false);
  });
});

test.group('k6 runner breaking point', () => {
  test('interpolates the rate a ramp had reached when it was aborted', ({
    expect,
  }) => {
    const loadProfile = {
      mode: 'RAMP',
      config: {
        initialRate: 0,
        timeUnit: 'SECONDS',
        stages: [{ target: 1000, duration: 100 }],
      },
    };

    // Aborted 40s into a linear 0 -> 1000 ramp: the system gave out at ~400/s.
    expect(resolveBreakingPoint(loadProfile, 40)).toBe(400);
  });

  test('carries the rate forward across completed stages', ({ expect }) => {
    const loadProfile = {
      mode: 'RAMP',
      config: {
        initialRate: 0,
        timeUnit: 'SECONDS',
        stages: [
          { target: 1000, duration: 100 },
          { target: 2000, duration: 100 },
        ],
      },
    };

    expect(resolveBreakingPoint(loadProfile, 150)).toBe(1500);
  });

  test('reports the fixed rate for a constant profile', ({ expect }) => {
    const loadProfile = {
      mode: 'CONSTANT',
      config: { targetRate: 50, duration: 30, timeUnit: 'SECONDS' },
    };

    expect(resolveBreakingPoint(loadProfile, 12)).toBe(50);
  });

  test('clamps to the final target when the run outlasts its stages', ({
    expect,
  }) => {
    const loadProfile = {
      mode: 'RAMP',
      config: {
        initialRate: 0,
        timeUnit: 'SECONDS',
        stages: [{ target: 800, duration: 10 }],
      },
    };

    expect(resolveBreakingPoint(loadProfile, 999)).toBe(800);
  });

  test('detects a breached threshold in the k6 summary', ({ expect }) => {
    const summary = {
      metrics: {
        http_req_duration: { thresholds: { 'p(95)<500': { ok: false } } },
      },
    };

    expect(thresholdsBreached(summary)).toBe(true);
  });

  test('reports no breach when every threshold held', ({ expect }) => {
    const summary = {
      metrics: {
        http_req_duration: { thresholds: { 'p(95)<500': { ok: true } } },
      },
    };

    expect(thresholdsBreached(summary)).toBe(false);
  });
});
