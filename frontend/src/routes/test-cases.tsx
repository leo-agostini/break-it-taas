import { listTestCases } from '@/features/test-cases/api/test-cases';
import { TestCasesListContainer } from '@/features/test-cases/containers/test-cases-list-container';
import { createServerPrivateHttpClient } from '@/lib/httpClient';
import { requireServerAuth } from '@/lib/server-auth';
import { useLoaderData } from 'react-router';

export async function loader({ request }: { request: Request }) {
  await requireServerAuth(request);
  const testCases = await listTestCases(createServerPrivateHttpClient(request));
  return { testCases };
}

export default function TestCasesRoute() {
  const { testCases } = useLoaderData<typeof loader>();

  return <TestCasesListContainer initialData={testCases} />;
}
