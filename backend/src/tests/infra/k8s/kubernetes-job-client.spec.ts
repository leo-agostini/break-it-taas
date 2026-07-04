import { describe, expect, it } from 'bun:test';

describe('KubernetesJobClient', () => {
  it('does not build an in-cluster server from unusable Kubernetes env values', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.RUNNER_SHARED_SECRET =
      process.env.RUNNER_SHARED_SECRET ?? 'runner-secret';
    process.env.RUNNER_CALLBACK_BASE_URL =
      process.env.RUNNER_CALLBACK_BASE_URL ?? 'http://localhost:3001';

    const { KubernetesJobClient } = await import(
      '@/infra/k8s/kubernetes-job-client'
    );

    expect(KubernetesJobClient.resolveInClusterServer(undefined, '443')).toBe(
      undefined,
    );
    expect(
      KubernetesJobClient.resolveInClusterServer('undefined', 'undefined'),
    ).toBe(undefined);
    expect(KubernetesJobClient.resolveInClusterServer('null', '443')).toBe(
      undefined,
    );
    expect(KubernetesJobClient.resolveInClusterServer('10.43.0.1', '443')).toBe(
      'https://10.43.0.1:443',
    );
  });

  it('detects self-signed certificate errors through wrapped causes', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.RUNNER_SHARED_SECRET =
      process.env.RUNNER_SHARED_SECRET ?? 'runner-secret';
    process.env.RUNNER_CALLBACK_BASE_URL =
      process.env.RUNNER_CALLBACK_BASE_URL ?? 'http://localhost:3001';

    const { KubernetesJobClient } = await import(
      '@/infra/k8s/kubernetes-job-client'
    );

    const error = new Error('request failed', {
      cause: new Error('self signed certificate in certificate chain'),
    });

    expect(KubernetesJobClient.isTlsChainError(error)).toBe(true);
  });
});
