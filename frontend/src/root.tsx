import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Toaster } from '@/components/ui/sonner';
import { reportError, useTrackPageViews } from '@/lib/observability';
import { Provider } from 'jotai';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useEffect } from 'react';
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from 'react-router';
import { SWRConfig } from 'swr';
import './app.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body
        style={{ width: '100vw', height: '100vh', boxSizing: 'border-box' }}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Provider>
            <SWRConfig
              value={{
                revalidateOnFocus: true,
                shouldRetryOnError: false,
                fetcher: async (url: string) => {
                  const response = await fetch(url);
                  if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                  }
                  return response.json();
                },
              }}
            >
              {children}
              <Toaster />
            </SWRConfig>
          </Provider>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useTrackPageViews();
  return <Outlet />;
}

/**
 * React Router catches render and loader errors itself, so they never reach
 * Faro's global error handler. Report unexpected ones here; a thrown 4xx
 * response (such as a missing test case) is an expected outcome, not a bug.
 */
export function ErrorBoundary({ error }: { error: unknown }) {
  const isExpected = isRouteErrorResponse(error) && error.status < 500;

  useEffect(() => {
    if (!isExpected) reportError(error);
  }, [error, isExpected]);

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <Empty
        className="max-w-md"
        title={
          isRouteErrorResponse(error)
            ? `${error.status} ${error.statusText}`
            : 'Something went wrong'
        }
        description={
          isExpected
            ? 'This page is not available.'
            : 'An unexpected error occurred. Try again in a moment.'
        }
        action={
          <Button asChild variant="outline">
            <Link to="/test-cases">Back to test cases</Link>
          </Button>
        }
      />
    </main>
  );
}
