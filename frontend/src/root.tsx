import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { RecoilRoot } from "recoil";
import { SWRConfig } from "swr";
import "./app.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
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
          </SWRConfig>
        </RecoilRoot>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
