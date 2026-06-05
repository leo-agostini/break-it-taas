import { readFile } from 'node:fs/promises';
import { BatchV1Api, KubeConfig, type V1Job } from '@kubernetes/client-node';

export class KubernetesJobClient {
  private readonly batchApi: BatchV1Api;
  private readonly server?: string;

  constructor(batchApi?: BatchV1Api) {
    if (batchApi) {
      this.batchApi = batchApi;
      return;
    }

    const kc = new KubeConfig();

    try {
      kc.loadFromCluster();
    } catch {
      kc.loadFromDefault();
    }

    this.batchApi = kc.makeApiClient(BatchV1Api);
    this.server =
      process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT
        ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
        : undefined;
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
    const { token, ca } = await this.readInClusterCredentials();
    const response = await fetch(
      `${this.server}/apis/batch/v1/namespaces/${namespace}/jobs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(job),
        tls: { ca },
      } as RequestInit,
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
    const { token, ca } = await this.readInClusterCredentials();
    const response = await fetch(
      `${this.server}/apis/batch/v1/namespaces/${namespace}/jobs/${name}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        tls: { ca },
      } as RequestInit,
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

  private async readInClusterCredentials(): Promise<{
    token: string;
    ca: string;
  }> {
    const [token, ca] = await Promise.all([
      readFile('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8'),
      readFile('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt', 'utf8'),
    ]);
    return { token: token.trim(), ca };
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

  static isTlsChainError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('self signed certificate');
  }
}
