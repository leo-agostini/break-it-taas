import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { MetricCard } from '@/features/test-cases/components/metric-card';
import { RunStatusBadge } from '@/features/test-cases/components/status-badges';
import {
  formatDateTime,
  formatDuration,
  formatMs,
  formatNumber,
  formatPercent,
  formatRps,
  shortId,
} from '@/features/test-cases/lib/format';
import type {
  TestRun,
  TestRunReport,
} from '@/features/test-cases/types/test-run';
import { ArrowLeft, FileText, Hourglass } from 'lucide-react';
import { Link } from 'react-router';

export function RunReport({
  testCaseId,
  run,
  report,
}: {
  testCaseId: string;
  run: TestRun;
  report: TestRunReport | null;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={`/test-cases/${testCaseId}`}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Back
        </Link>
      </Button>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold tracking-tight">
            {shortId(run.id)}
          </h1>
          <RunStatusBadge status={run.status} />
          {report?.flags.generatorLimited ? (
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              Generator limited
            </Badge>
          ) : null}
          {report?.flags.timeoutsDetected ? (
            <Badge
              variant="outline"
              className="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300"
            >
              Timeouts detected
            </Badge>
          ) : null}
          {report?.flags.aborted ? (
            <Badge
              variant="outline"
              className="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
            >
              {report.achieved.breakingPointRate
                ? `Broke at ~${Math.round(report.achieved.breakingPointRate)}/s`
                : 'Aborted on threshold'}
            </Badge>
          ) : null}
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>Created</dt>
            <dd className="text-foreground">{formatDateTime(run.createdAt)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Started</dt>
            <dd className="text-foreground">{formatDateTime(run.startedAt)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Completed</dt>
            <dd className="text-foreground">
              {formatDateTime(run.completedAt)}
            </dd>
          </div>
          {run.runtimeRef ? (
            <div className="flex gap-1.5">
              <dt>Runtime</dt>
              <dd className="font-mono text-foreground">{run.runtimeRef}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {!report ? (
        <Empty
          icon={<Hourglass className="h-5 w-5" aria-hidden="true" />}
          title="No metrics yet"
          description="Metrics appear once the runner finishes and reports its results."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Achieved RPS"
              value={formatRps(report.achieved.rps)}
            />
            <MetricCard
              label="Requested rate"
              value={formatNumber(report.requested.rate)}
              hint={report.requested.timeUnit}
            />
            <MetricCard
              label="Total requests"
              value={formatNumber(report.achieved.totalRequests)}
            />
            <MetricCard
              label="Dropped iterations"
              value={formatNumber(report.achieved.droppedIterations)}
            />
            <MetricCard
              label="Median latency"
              value={formatMs(report.achieved.medianMs)}
            />
            <MetricCard label="p95" value={formatMs(report.achieved.p95Ms)} />
            <MetricCard label="p99" value={formatMs(report.achieved.p99Ms)} />
            <MetricCard
              label="Success rate"
              value={formatPercent(report.achieved.successRate)}
            />
            <MetricCard
              label="Failure rate"
              value={formatPercent(report.achieved.failureRate)}
            />
            <MetricCard
              label="Duration"
              value={formatDuration(run.startedAt, run.completedAt)}
              hint={
                report.requested.durationSeconds
                  ? `Requested ${report.requested.durationSeconds}s`
                  : undefined
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Artifacts</CardTitle>
            </CardHeader>
            <CardContent>
              {report.artifacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This run produced no artifacts.
                </p>
              ) : (
                <ul className="space-y-2">
                  {report.artifacts.map((artifact) => (
                    <li
                      key={artifact}
                      className="flex items-center gap-2 font-mono text-sm"
                    >
                      <FileText
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {artifact}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
