import { test } from '@japa/runner';
import {
  parseNodeSelector,
  resolveRunnerScheduling,
} from '#modules/runner/runner_scheduling';

test.group('parseNodeSelector', () => {
  test('returns undefined for empty or whitespace-only input', ({ expect }) => {
    expect(parseNodeSelector(undefined)).toBeUndefined();
    expect(parseNodeSelector('')).toBeUndefined();
    expect(parseNodeSelector('   ')).toBeUndefined();
  });

  test('parses a single key=value pair', ({ expect }) => {
    expect(parseNodeSelector('cloud.google.com/gke-nodepool=runners')).toEqual({
      'cloud.google.com/gke-nodepool': 'runners',
    });
  });

  test('parses multiple comma-separated pairs and trims surrounding space', ({
    expect,
  }) => {
    expect(parseNodeSelector('disktype=ssd, workload = runner ')).toEqual({
      disktype: 'ssd',
      workload: 'runner',
    });
  });

  test('throws on an entry without a separator', ({ expect }) => {
    expect(() => parseNodeSelector('disktype')).toThrow(/RUNNER_NODE_SELECTOR/);
  });

  test('throws on an entry with an empty key or value', ({ expect }) => {
    expect(() => parseNodeSelector('=ssd')).toThrow(/RUNNER_NODE_SELECTOR/);
    expect(() => parseNodeSelector('disktype=')).toThrow(
      /RUNNER_NODE_SELECTOR/,
    );
  });
});

test.group('resolveRunnerScheduling', () => {
  test('resolves to an empty policy when nothing is configured (kind default)', ({
    expect,
  }) => {
    expect(resolveRunnerScheduling(undefined, undefined)).toEqual({});
    expect(resolveRunnerScheduling('', '')).toEqual({});
  });

  test('resolves runtime class and node selector when configured (GKE Sandbox)', ({
    expect,
  }) => {
    expect(
      resolveRunnerScheduling('gvisor', 'sandbox.gke.io/runtime=gvisor'),
    ).toEqual({
      runtimeClassName: 'gvisor',
      nodeSelector: { 'sandbox.gke.io/runtime': 'gvisor' },
    });
  });
});
