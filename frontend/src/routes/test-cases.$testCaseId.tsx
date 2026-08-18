import { getTestCase } from '@/features/test-cases/api/test-cases';
import { listTestCaseRuns } from '@/features/test-cases/api/test-runs';
import { TestCaseDetailContainer } from '@/features/test-cases/containers/test-case-detail-container';
import { createServerPrivateHttpClient } from '@/lib/httpClient';
import { requireServerAuth } from '@/lib/server-auth';
import { useLoaderData } from 'react-router';

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { testCaseId: string };
}) {
  await requireServerAuth(request);

  const client = createServerPrivateHttpClient(request);
  const [testCase, runs] = await Promise.all([
    getTestCase(params.testCaseId, client),
    listTestCaseRuns(params.testCaseId, client),
  ]);

  return { testCase, runs };
}

export default function TestCaseDetailRoute() {
  const { testCase, runs } = useLoaderData<typeof loader>();

  return (
    <TestCaseDetailContainer
      testCaseId={testCase.id}
      initialTestCase={testCase}
      initialRuns={runs}
    />
  );
}
