import { requireServerAuth } from '@/lib/server-auth';

export async function loader({ request }: { request: Request }) {
  await requireServerAuth(request);
  return null;
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center justify-center p-8">
      <section className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          You are logged in
        </h1>
        <p className="mt-2 text-muted-foreground">
          Feature-based login is available at <code>/login</code>.
        </p>
      </section>
    </main>
  );
}
