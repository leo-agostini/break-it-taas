import { RunReport } from '@/features/test-cases/components/run-report';
import { useTestRun } from '@/features/test-cases/hooks/use-test-run';
import { useTestRunReport } from '@/features/test-cases/hooks/use-test-run-report';
import type {
  TestRun,
  TestRunReport,
} from '@/features/test-cases/types/test-run';

export function RunReportContainer({
  testCaseId,
  initialRun,
  initialReport,
}: {
  testCaseId: string;
  initialRun: TestRun;
  initialReport: TestRunReport | null;
}) {
  const { testRun } = useTestRun(initialRun.id, initialRun);
  const run = testRun ?? initialRun;

  const { report } = useTestRunReport(run.id, {
    runStatus: run.status,
    initialData: initialReport,
  });

  return (
    <RunReport testCaseId={testCaseId} run={run} report={report ?? null} />
  );
}
