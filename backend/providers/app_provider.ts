import type { ApplicationService } from '@adonisjs/core/types';
import { TestRunQueue } from '#modules/runner/test_run_queue';

/**
 * Binds the ports modules depend on to their implementations. Bindings are
 * lazy: the Kubernetes client (which reads kubeconfig) is only built when
 * something actually dispatches a run, i.e. in the outbox worker.
 */
export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(TestRunQueue, async () => {
      const { KubernetesTestRunQueue } = await import(
        '#modules/runner/kubernetes_test_run_queue'
      );
      return new KubernetesTestRunQueue();
    });
  }
}
