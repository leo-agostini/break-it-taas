import { AppShell } from '@/components/layout/app-shell';
import { requireServerAuth } from '@/lib/server-auth';
import { Outlet, useLoaderData } from 'react-router';

export async function loader({ request }: { request: Request }) {
  const user = await requireServerAuth(request);
  return { user };
}

export default function AppLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}
