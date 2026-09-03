import { describe, expect, it } from 'bun:test';
import {
  parseNodeSelector,
  resolveRunnerScheduling,
} from '@/infra/queue/runner-scheduling';

describe('parseNodeSelector', () => {
  it('returns undefined for empty or whitespace-only input', () => {
    expect(parseNodeSelector(undefined)).toBeUndefined();
    expect(parseNodeSelector('')).toBeUndefined();
    expect(parseNodeSelector('   ')).toBeUndefined();
  });

  it('parses a single key=value pair', () => {
    expect(parseNodeSelector('cloud.google.com/gke-nodepool=runners')).toEqual({
      'cloud.google.com/gke-nodepool': 'runners',
    });
  });

  it('parses multiple comma-separated pairs and trims surrounding space', () => {
    expect(parseNodeSelector('disktype=ssd, workload = runner ')).toEqual({
      disktype: 'ssd',
      workload: 'runner',
    });
  });

  it('throws on an entry without a separator', () => {
    expect(() => parseNodeSelector('disktype')).toThrow(/RUNNER_NODE_SELECTOR/);
  });

  it('throws on an entry with an empty key or value', () => {
    expect(() => parseNodeSelector('=ssd')).toThrow(/RUNNER_NODE_SELECTOR/);
    expect(() => parseNodeSelector('disktype=')).toThrow(
      /RUNNER_NODE_SELECTOR/,
    );
  });
});

describe('resolveRunnerScheduling', () => {
  it('resolves to an empty policy when nothing is configured (kind default)', () => {
    expect(resolveRunnerScheduling(undefined, undefined)).toEqual({});
    expect(resolveRunnerScheduling('', '')).toEqual({});
  });

  it('resolves runtime class and node selector when configured (GKE Sandbox)', () => {
    expect(
      resolveRunnerScheduling('gvisor', 'sandbox.gke.io/runtime=gvisor'),
    ).toEqual({
      runtimeClassName: 'gvisor',
      nodeSelector: { 'sandbox.gke.io/runtime': 'gvisor' },
    });
  });
});
