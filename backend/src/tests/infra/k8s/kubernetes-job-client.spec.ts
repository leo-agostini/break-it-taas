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

  it('detects the untrusted-chain messages Bun and Node each report', async () => {
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

    // The kind API server presents a self-signed chain. Bun and Node describe
    // the same rejection differently, and only the fetch fallback below can
    // supply the kubeconfig CA, so every wording has to route to it.
    const messages = [
      'unable to verify the first certificate',
      'unable to get local issuer certificate',
      'self-signed certificate in certificate chain',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
    ];

    for (const message of messages) {
      expect(KubernetesJobClient.isTlsChainError(new Error(message))).toBe(
        true,
      );
    }

    expect(
      KubernetesJobClient.isTlsChainError(new Error('connection refused')),
    ).toBe(false);
  });

  it('rejects an unset context instead of falling back to current-context', async () => {
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
    const { KubeConfig } = await import('@kubernetes/client-node');

    const kc = new KubeConfig();
    expect(() => KubernetesJobClient.selectContext(kc, undefined)).toThrow(
      /KUBERNETES_CONTEXT is required/,
    );
    expect(() => KubernetesJobClient.selectContext(kc, '  ')).toThrow(
      /KUBERNETES_CONTEXT is required/,
    );
  });

  it('rejects a context that is absent from kubeconfig', async () => {
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
    const { KubeConfig } = await import('@kubernetes/client-node');

    const kc = new KubeConfig();
    kc.loadFromOptions({
      clusters: [{ name: 'c', server: 'https://example.invalid' }],
      users: [{ name: 'u' }],
      contexts: [{ name: 'kind-taas-dev', cluster: 'c', user: 'u' }],
      currentContext: 'kind-taas-dev',
    });

    expect(() => KubernetesJobClient.selectContext(kc, 'k3d-workload')).toThrow(
      /was not found in kubeconfig/,
    );
    expect(() =>
      KubernetesJobClient.selectContext(kc, 'kind-taas-dev'),
    ).not.toThrow();
    expect(kc.getCurrentContext()).toBe('kind-taas-dev');
  });
});
