import { readFile } from 'node:fs/promises';
import { ConfigurationError } from '@/domain/errors/custom-errors';
import { env } from '@/infra/config/env';
import { BatchV1Api, KubeConfig, type V1Job } from '@kubernetes/client-node';

export class KubernetesJobClient {
  private readonly batchApi: BatchV1Api;
  private readonly kubeConfig?: KubeConfig;
  private readonly server?: string;

  constructor(batchApi?: BatchV1Api) {
    if (batchApi) {
      this.batchApi = batchApi;
      return;
    }

    const kc = new KubeConfig();

    if (KubernetesJobClient.isInClusterEnvironment()) {
      kc.loadFromCluster();
    } else {
      kc.loadFromDefault();
      KubernetesJobClient.selectContext(kc, env.KUBERNETES_CONTEXT);
    }

    this.batchApi = kc.makeApiClient(BatchV1Api);
    this.kubeConfig = kc;
    const serviceHost = process.env.KUBERNETES_SERVICE_HOST;
    const servicePort = process.env.KUBERNETES_SERVICE_PORT;
    this.server =
      KubernetesJobClient.resolveInClusterServer(serviceHost, servicePort) ??
      kc.getCurrentCluster()?.server;
  }

  async createJob(namespace: string, job: V1Job): Promise<V1Job> {
    try {
      const response = await this.batchApi.createNamespacedJob({
        namespace,
        body: job,
      });
      return response;
    } catch (error) {
      if (!KubernetesJobClient.isTlsChainError(error) || !this.server) {
        throw error;
      }
      return this.createJobWithInClusterFetch(namespace, job);
    }
  }

  async getJob(namespace: string, name: string): Promise<V1Job> {
    try {
      const response = await this.batchApi.readNamespacedJob({
        namespace,
        name,
      });
      return response;
    } catch (error) {
      if (!KubernetesJobClient.isTlsChainError(error) || !this.server) {
        throw error;
      }
      return this.getJobWithInClusterFetch(namespace, name);
    }
  }

  private async createJobWithInClusterFetch(
    namespace: string,
    job: V1Job,
  ): Promise<V1Job> {
    const requestInit = await this.authenticatedRequestInit({
      method: 'POST',
      body: JSON.stringify(job),
    });
    const response = await fetch(
      `${this.server}/apis/batch/v1/namespaces/${namespace}/jobs`,
      requestInit,
    );

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `K8s API returned ${response.status}: ${body}`,
      ) as Error & { statusCode?: number };
      error.statusCode = response.status;
      throw error;
    }

    return (await response.json()) as V1Job;
  }

  private async getJobWithInClusterFetch(
    namespace: string,
    name: string,
  ): Promise<V1Job> {
    const requestInit = await this.authenticatedRequestInit({ method: 'GET' });
    const response = await fetch(
      `${this.server}/apis/batch/v1/namespaces/${namespace}/jobs/${name}`,
      requestInit,
    );

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `K8s API returned ${response.status}: ${body}`,
      ) as Error & { statusCode?: number };
      error.statusCode = response.status;
      throw error;
    }

    return (await response.json()) as V1Job;
  }

  private async authenticatedRequestInit(
    init: RequestInit,
  ): Promise<RequestInit> {
    const fetchOptions = this.kubeConfig
      ? await this.kubeConfig.applyToFetchOptions({})
      : {};
    const headers = KubernetesJobClient.toFetchHeaders(fetchOptions.headers);
    headers.set('Content-Type', 'application/json');
    const { agent: _agent, ...portableFetchOptions } = fetchOptions;

    return {
      ...portableFetchOptions,
      ...init,
      headers,
      tls: await this.resolveBunTlsOptions(),
    } as RequestInit;
  }

  private async resolveBunTlsOptions(): Promise<{
    ca?: string;
    cert?: string;
    key?: string;
    rejectUnauthorized?: boolean;
  }> {
    const cluster = this.kubeConfig?.getCurrentCluster();
    const user = this.kubeConfig?.getCurrentUser();

    return {
      ca: await KubernetesJobClient.readPem(cluster?.caFile, cluster?.caData),
      cert: await KubernetesJobClient.readPem(user?.certFile, user?.certData),
      key: await KubernetesJobClient.readPem(user?.keyFile, user?.keyData),
      rejectUnauthorized: cluster?.skipTLSVerify ? false : undefined,
    };
  }

  /**
   * Selects the kubeconfig context to dispatch Jobs to.
   *
   * Throws when the context is unset or absent from kubeconfig. Both used to
   * be silent no-ops, which left the client pointed at kubectl's ambient
   * current-context — so a stale or unrelated current-context meant runner
   * Jobs landed in the wrong cluster with no signal at all.
   */
  static selectContext(kc: KubeConfig, context: string | undefined): void {
    if (!context?.trim()) {
      throw new ConfigurationError(
        'KUBERNETES_CONTEXT is required when running outside the cluster. ' +
          'Set it explicitly (local default: kind-taas-dev) — the ambient ' +
          'kubectl current-context is not used as a fallback.',
      );
    }

    const available = kc.getContexts().map((c) => c.name);
    if (!available.includes(context)) {
      throw new ConfigurationError(
        `KUBERNETES_CONTEXT "${context}" was not found in kubeconfig. ` +
          `Available contexts: ${available.join(', ') || '(none)'}.`,
      );
    }

    kc.setCurrentContext(context);
  }

  static isAlreadyExists(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number' &&
      (error as { statusCode: number }).statusCode === 409
    );
  }

  /**
   * Recognises "the API server's certificate chain is not trusted".
   *
   * The kubeconfig CA reaches the request only through the fetch fallback, so
   * every wording of that rejection has to be matched here. Bun says "unable to
   * verify the first certificate" where Node says "self signed certificate in
   * certificate chain"; matching only the latter left kind dispatch failing
   * with the fallback never engaged.
   */
  static isTlsChainError(error: unknown): boolean {
    const signatures = [
      'self signed certificate',
      'self-signed certificate',
      'unable to verify the first certificate',
      'unable to get local issuer certificate',
      'depth_zero_self_signed_cert',
      'unable_to_verify_leaf_signature',
    ];

    return KubernetesJobClient.errorMessages(error).some((message) => {
      const normalized = message.toLowerCase();
      return signatures.some((signature) => normalized.includes(signature));
    });
  }

  static isValidInClusterServiceEndpoint(
    serviceHost: string | undefined,
    servicePort: string | undefined,
  ): boolean {
    return (
      KubernetesJobClient.isUsableEnvValue(serviceHost) &&
      KubernetesJobClient.isUsableEnvValue(servicePort) &&
      Number.isInteger(Number(servicePort)) &&
      Number(servicePort) > 0
    );
  }

  static resolveInClusterServer(
    serviceHost: string | undefined,
    servicePort: string | undefined,
  ): string | undefined {
    return KubernetesJobClient.isValidInClusterServiceEndpoint(
      serviceHost,
      servicePort,
    )
      ? `https://${serviceHost}:${servicePort}`
      : undefined;
  }

  private static isInClusterEnvironment(): boolean {
    return KubernetesJobClient.isValidInClusterServiceEndpoint(
      process.env.KUBERNETES_SERVICE_HOST,
      process.env.KUBERNETES_SERVICE_PORT,
    );
  }

  private static isUsableEnvValue(value: string | undefined): value is string {
    if (!value) {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return Boolean(normalized && !['undefined', 'null'].includes(normalized));
  }

  private static errorMessages(error: unknown): string[] {
    if (error instanceof Error) {
      const cause =
        'cause' in error ? (error as Error & { cause?: unknown }).cause : null;
      return [
        error.message,
        error.stack ?? '',
        ...KubernetesJobClient.errorMessages(cause),
      ].filter(Boolean);
    }

    if (typeof error === 'object' && error !== null) {
      const values = Object.values(error as Record<string, unknown>);
      return values.flatMap((value) =>
        KubernetesJobClient.errorMessages(value),
      );
    }

    return [String(error)];
  }

  private static async readPem(
    file: string | undefined,
    data: string | undefined,
  ): Promise<string | undefined> {
    if (data) {
      return Buffer.from(data, 'base64').toString('utf8');
    }

    if (file) {
      return readFile(file, 'utf8');
    }

    return undefined;
  }

  private static toFetchHeaders(headersInit: unknown): Headers {
    const headers = new Headers();
    if (!headersInit) {
      return headers;
    }

    if (
      typeof headersInit === 'object' &&
      'forEach' in headersInit &&
      typeof headersInit.forEach === 'function'
    ) {
      headersInit.forEach((value: string, key: string) => {
        headers.set(key, value);
      });
      return headers;
    }

    for (const [key, value] of Object.entries(
      headersInit as Record<string, string | string[]>,
    )) {
      if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(key, item);
        }
        continue;
      }
      headers.set(key, value);
    }

    return headers;
  }
}
