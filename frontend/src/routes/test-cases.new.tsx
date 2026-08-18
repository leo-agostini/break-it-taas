import { TestCaseFormContainer } from '@/features/test-cases/containers/test-case-form-container';
import { requireServerAuth } from '@/lib/server-auth';

export async function loader({ request }: { request: Request }) {
  await requireServerAuth(request);
  return null;
}

export default function NewTestCaseRoute() {
  return <TestCaseFormContainer />;
}
