import { SignupPage } from '@/features/signup/components/signup-page';
import { redirectIfAuthenticated } from '@/lib/server-auth';

export async function loader({ request }: { request: Request }) {
  await redirectIfAuthenticated(request);
  return null;
}

export default function SignupRoute() {
  return <SignupPage />;
}
