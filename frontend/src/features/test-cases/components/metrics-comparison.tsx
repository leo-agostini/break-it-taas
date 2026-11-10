import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { shortId } from '@/features/test-cases/lib/format';
import { describeLoadProfile } from '@/features/test-cases/lib/load-profile';
import type { TestCaseRunSummary } from '@/features/test-cases/types/test-run';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

interface ComparisonRow {
  id: string;
  name: string;
  /** The load the run executed with, so runs at different loads read apart. */
  load: string;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  // Absent rather than 0 when the run was not driven that way, so no bar shows.
  requestedRate?: number;
  achievedRps: number;
  requestedVus?: number;
  peakVus?: number;
  successRate: number;
  failureRate: number;
  totalRequests: number;
  droppedIterations: number;
}

function toRows(
  runs: TestCaseRunSummary[],
  selectedRunIds: string[],
): ComparisonRow[] {
  return runs
    .filter((run) => selectedRunIds.includes(run.id) && run.metrics)
    .map((run) => ({
      id: run.id,
      name: shortId(run.id),
      load: describeLoadProfile(run.loadProfile),
      medianMs: run.metrics?.medianMs ?? 0,
      p95Ms: run.metrics?.p95Ms ?? 0,
      p99Ms: run.metrics?.p99Ms ?? 0,
      requestedRate: run.metrics?.requestedRate,
      achievedRps: run.metrics?.achievedRps ?? 0,
      requestedVus: run.metrics?.requestedVus,
      peakVus: run.metrics?.peakVus,
      successRate: (run.metrics?.successRate ?? 0) * 100,
      failureRate: (run.metrics?.failureRate ?? 0) * 100,
      totalRequests: run.metrics?.totalRequests ?? 0,
      droppedIterations: run.metrics?.droppedIterations ?? 0,
    }))
    .reverse();
}

function formatAxisValue(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function ChartCard({
  title,
  description,
  config,
  rows,
  bars,
  unit,
  domain,
}: {
  title: string;
  description: string;
  config: ChartConfig;
  rows: ComparisonRow[];
  bars: Array<keyof ComparisonRow>;
  unit?: string;
  domain?: [number, number];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[240px] w-full">
          <BarChart data={rows} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="font-mono"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={44}
              domain={domain}
              tickFormatter={formatAxisValue}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label, payload) => {
                    const row = payload[0]?.payload as
                      | ComparisonRow
                      | undefined;
                    return (
                      <div>
                        <div className="font-mono">{String(label)}</div>
                        {row ? (
                          <div className="font-normal text-muted-foreground">
                            {row.load}
                          </div>
                        ) : null}
                      </div>
                    );
                  }}
                  formatter={(value, name) => (
                    <div className="flex w-full justify-between gap-3">
                      <span className="text-muted-foreground">
                        {config[String(name)]?.label ?? String(name)}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {typeof value === 'number'
                          ? value.toLocaleString()
                          : String(value)}
                        {unit ? ` ${unit}` : ''}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {bars.map((bar) => (
              <Bar
                key={String(bar)}
                dataKey={String(bar)}
                fill={`var(--color-${String(bar)})`}
                radius={4}
                maxBarSize={40}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const latencyConfig: ChartConfig = {
  medianMs: { label: 'Median', color: 'var(--chart-5)' },
  p95Ms: { label: 'p95', color: 'var(--chart-1)' },
  p99Ms: { label: 'p99', color: 'var(--chart-2)' },
};

const throughputConfig: ChartConfig = {
  requestedRate: { label: 'Requested', color: 'var(--chart-2)' },
  achievedRps: { label: 'Achieved', color: 'var(--chart-1)' },
};

const vusConfig: ChartConfig = {
  requestedVus: { label: 'Requested', color: 'var(--chart-2)' },
  peakVus: { label: 'Peak', color: 'var(--chart-1)' },
};

const outcomeConfig: ChartConfig = {
  successRate: { label: 'Success', color: 'var(--chart-3)' },
  failureRate: { label: 'Failure', color: 'var(--chart-4)' },
};

const volumeConfig: ChartConfig = {
  totalRequests: { label: 'Requests', color: 'var(--chart-1)' },
  droppedIterations: { label: 'Dropped', color: 'var(--chart-4)' },
};

export function MetricsComparison({
  runs,
  selectedRunIds,
}: {
  runs: TestCaseRunSummary[];
  selectedRunIds: string[];
}) {
  const rows = toRows(runs, selectedRunIds);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Select one or more completed runs above to compare their metrics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard
        title="Response time percentiles"
        description="Median, p95 and p99 latency per run."
        config={latencyConfig}
        rows={rows}
        bars={['medianMs', 'p95Ms', 'p99Ms']}
        unit="ms"
      />
      <ChartCard
        title="Throughput vs requested"
        description="For rate-driven runs, a gap means the generator could not keep up."
        config={throughputConfig}
        rows={rows}
        bars={['requestedRate', 'achievedRps']}
        unit="rps"
      />
      {rows.some((row) => row.peakVus !== undefined) ? (
        <ChartCard
          title="Virtual users"
          description="VUs a VU-driven run asked for against the largest pool k6 ran with."
          config={vusConfig}
          rows={rows}
          bars={['requestedVus', 'peakVus']}
        />
      ) : null}
      <ChartCard
        title="Success vs failure rate"
        description="Share of requests that passed or failed."
        config={outcomeConfig}
        rows={rows}
        bars={['successRate', 'failureRate']}
        unit="%"
        domain={[0, 100]}
      />
      <ChartCard
        title="Requests & dropped iterations"
        description="Total requests issued against iterations dropped."
        config={volumeConfig}
        rows={rows}
        bars={['totalRequests', 'droppedIterations']}
      />
    </div>
  );
}
