import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { RecoilRoot } from 'recoil';
import { SWRConfig } from 'swr';
import { Toaster } from '@/components/ui/sonner';
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
          <RecoilRoot>
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
          </RecoilRoot>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
