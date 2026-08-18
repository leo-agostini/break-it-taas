import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/features/test-cases/components/metric-card';
import { MetricsComparison } from '@/features/test-cases/components/metrics-comparison';
import { RunTable } from '@/features/test-cases/components/run-table';
import { TestTypeBadge } from '@/features/test-cases/components/status-badges';
import { formatMs, formatPercent } from '@/features/test-cases/lib/format';
import type { TestCase } from '@/features/test-cases/types/test-case';
import type { TestCaseRunSummary } from '@/features/test-cases/types/test-run';
import { ArrowLeft, Play } from 'lucide-react';
import { Link } from 'react-router';

function describeLoadProfile(testCase: TestCase): string {
  const { loadProfile } = testCase;

  if (loadProfile.mode === 'CONSTANT') {
    const { targetRate, duration, timeUnit } = loadProfile.config;
    return `${targetRate}/s for ${duration} ${timeUnit.toLowerCase()}`;
  }

  return `${loadProfile.config.stages.length} stage(s) from ${loadProfile.config.initialRate}/s`;
}

export function TestCaseDetail({
  testCase,
  runs,
  selectedRunIds,
  onToggleRun,
  onStartRun,
  isStartingRun,
}: {
  testCase: TestCase;
  runs: TestCaseRunSummary[];
  selectedRunIds: string[];
  onToggleRun: (runId: string) => void;
  onStartRun: () => void;
  isStartingRun: boolean;
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

        <Button onClick={onStartRun} disabled={isStartingRun}>
          <Play className="mr-2 h-4 w-4" aria-hidden="true" />
          {isStartingRun ? 'Queuing…' : 'New test run'}
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Load profile"
          value={testCase.loadProfile.mode}
          hint={describeLoadProfile(testCase)}
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
          label="Execution"
          value={testCase.executionPolicy.resourceProfile}
          hint={`Timeout ${testCase.executionPolicy.timeoutSeconds}s`}
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
