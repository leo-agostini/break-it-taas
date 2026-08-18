import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RunStatusBadge } from '@/features/test-cases/components/status-badges';
import {
  formatDateTime,
  formatDuration,
  formatMs,
  formatPercent,
  formatRps,
  shortId,
} from '@/features/test-cases/lib/format';
import type { TestCaseRunSummary } from '@/features/test-cases/types/test-run';
import { Activity } from 'lucide-react';
import { Link } from 'react-router';

function WarningChips({ run }: { run: TestCaseRunSummary }) {
  if (!run.metrics) return null;

  const chips: Array<{ label: string; tooltip: string }> = [];
  if (run.metrics.generatorLimited) {
    chips.push({
      label: 'gen',
      tooltip: 'The load generator could not reach the requested rate.',
    });
  }
  if (run.metrics.timeoutsDetected) {
    chips.push({
      label: 't/o',
      tooltip: 'Timeouts were detected during this run.',
    });
  }

  if (chips.length === 0) return null;

  return (
    <TooltipProvider>
      <span className="ml-2 inline-flex gap-1">
        {chips.map((chip) => (
          <Tooltip key={chip.label}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-300"
              >
                {chip.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{chip.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </span>
    </TooltipProvider>
  );
}

export function RunTable({
  testCaseId,
  runs,
  selectedRunIds,
  onToggleRun,
}: {
  testCaseId: string;
  runs: TestCaseRunSummary[];
  selectedRunIds: string[];
  onToggleRun: (runId: string) => void;
}) {
  if (runs.length === 0) {
    return (
      <Empty
        icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        title="No runs yet"
        description="Start a run to collect performance metrics."
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Started</TableHead>
            <TableHead className="hidden lg:table-cell">Duration</TableHead>
            <TableHead className="text-right">p95</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Success
            </TableHead>
            <TableHead className="hidden text-right lg:table-cell">
              Achieved
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow
              key={run.id}
              data-state={
                selectedRunIds.includes(run.id) ? 'selected' : undefined
              }
            >
              <TableCell>
                <Checkbox
                  checked={selectedRunIds.includes(run.id)}
                  onCheckedChange={() => onToggleRun(run.id)}
                  disabled={!run.metrics}
                  aria-label={`Compare run ${shortId(run.id)}`}
                />
              </TableCell>
              <TableCell>
                <Link
                  to={`/test-cases/${testCaseId}/runs/${run.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {shortId(run.id)}
                </Link>
                <WarningChips run={run} />
              </TableCell>
              <TableCell>
                <RunStatusBadge status={run.status} />
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {formatDateTime(run.startedAt)}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {formatDuration(run.startedAt, run.completedAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMs(run.metrics?.p95Ms)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {formatPercent(run.metrics?.successRate)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums lg:table-cell">
                {formatRps(run.metrics?.achievedRps)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
