import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/features/test-cases/components/metric-card';
import { MetricsComparison } from '@/features/test-cases/components/metrics-comparison';
import { NewTestRunDialog } from '@/features/test-cases/components/new-test-run-dialog';
import { RunTable } from '@/features/test-cases/components/run-table';
import { TestTypeBadge } from '@/features/test-cases/components/status-badges';
import { formatMs, formatPercent } from '@/features/test-cases/lib/format';
import {
  describeExecutionPolicy,
  describeLoadProfile,
  loadModeLabels,
} from '@/features/test-cases/lib/load-profile';
import type { RunConfigurationFormValues } from '@/features/test-cases/schemas/run-configuration-schema';
import type { TestCase } from '@/features/test-cases/types/test-case';
import type { TestCaseRunSummary } from '@/features/test-cases/types/test-run';
import { ArrowLeft, Play, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router';

export function TestCaseDetail({
  testCase,
  runs,
  selectedRunIds,
  onToggleRun,
  onStartRun,
  isStartingRun,
  runConfig,
}: {
  testCase: TestCase;
  runs: TestCaseRunSummary[];
  selectedRunIds: string[];
  onToggleRun: (runId: string) => void;
  /** Reruns the test case at its default configuration. */
  onStartRun: () => void;
  isStartingRun: boolean;
  runConfig: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    submitError: string | null;
    onSubmit: (values: RunConfigurationFormValues) => Promise<void>;
  };
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/test-cases">
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Back
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {testCase.name}
            </h1>
            <TestTypeBadge type={testCase.testType} />
          </div>
          {testCase.description ? (
            <p className="text-sm text-muted-foreground">
              {testCase.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{testCase.targetSystem.baseUrl}</span>
            <Badge variant="secondary">
              {testCase.targetSystem.environment}
            </Badge>
            <Badge variant="outline">{testCase.authStrategy.kind}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onStartRun}
            disabled={isStartingRun}
          >
            <Play className="mr-2 h-4 w-4" aria-hidden="true" />
            {isStartingRun ? 'Queuing…' : 'Run with default'}
          </Button>
          <Button
            onClick={() => runConfig.onOpenChange(true)}
            disabled={isStartingRun}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
            Configure run
          </Button>
        </div>
      </header>

      <NewTestRunDialog
        testCase={testCase}
        open={runConfig.open}
        onOpenChange={runConfig.onOpenChange}
        isSubmitting={isStartingRun}
        submitError={runConfig.submitError}
        onSubmit={runConfig.onSubmit}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Default load"
          value={loadModeLabels[testCase.loadProfile.mode]}
          hint={describeLoadProfile(testCase.loadProfile)}
        />
        <MetricCard
          label="Max p95"
          value={formatMs(testCase.thresholdPolicy.maxP95ResponseTimeMs)}
          hint="Threshold"
        />
        <MetricCard
          label="Max error rate"
          value={formatPercent(testCase.thresholdPolicy.maxErrorRate)}
          hint={
            testCase.thresholdPolicy.abortOnFail
              ? 'Aborts on failure'
              : 'Continues on failure'
          }
        />
        <MetricCard
          label="Default runner"
          value={testCase.executionPolicy.resourceProfile}
          hint={describeExecutionPolicy(testCase.executionPolicy)}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Test runs</h2>
        <RunTable
          testCaseId={testCase.id}
          runs={runs}
          selectedRunIds={selectedRunIds}
          onToggleRun={onToggleRun}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Metrics comparison</h2>
        <MetricsComparison runs={runs} selectedRunIds={selectedRunIds} />
      </section>
    </div>
  );
}
