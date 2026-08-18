import {
  getTestRun,
  getTestRunReport,
} from '@/features/test-cases/api/test-runs';
import { RunReportContainer } from '@/features/test-cases/containers/run-report-container';
import { createServerPrivateHttpClient } from '@/lib/httpClient';
import { requireServerAuth } from '@/lib/server-auth';
import { useLoaderData } from 'react-router';

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { testCaseId: string; testRunId: string };
}) {
  await requireServerAuth(request);

  const client = createServerPrivateHttpClient(request);
  const [run, report] = await Promise.all([
    getTestRun(params.testRunId, client),
    getTestRunReport(params.testRunId, client),
  ]);

  return { testCaseId: params.testCaseId, run, report };
}

export default function RunReportRoute() {
  const { testCaseId, run, report } = useLoaderData<typeof loader>();

  return (
    <RunReportContainer
      testCaseId={testCaseId}
      initialRun={run}
      initialReport={report}
    />
  );
}
