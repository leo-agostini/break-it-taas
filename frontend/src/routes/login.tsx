import { LoginPage } from '@/features/login/components/login-page';
import { redirectIfAuthenticated } from '@/lib/server-auth';

export async function loader({ request }: { request: Request }) {
  await redirectIfAuthenticated(request);
  return null;
}

export default function LoginRoute() {
  return <LoginPage />;
}
