/* Shared smoke-test helpers: fake router, fake Supabase query builder, render wrapper. */
import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

/** Chainable, awaitable stand-in for a Supabase PostgREST query builder. */
export function queryResult<T>(data: T, error: unknown = null) {
  const res = { data, error };
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve(res).then(resolve);
        }
        return () => builder;
      },
    },
  );
  return builder as never;
}

export const navigateSpy = vi.fn();

/** Minimal @tanstack/react-router replacement so route modules render standalone. */
export function routerMock(params: Record<string, string> = {}) {
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
      useParams: () => params,
      useLoaderData: () => undefined,
    }),
    useNavigate: () => navigateSpy,
    useRouter: () => ({ invalidate: vi.fn() }),
    Link: ({ children, ...rest }: React.ComponentProps<"a">) => <a {...rest}>{children}</a>,
    Outlet: () => null,
    redirect: (opts: unknown) => opts,
  };
}

export function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
