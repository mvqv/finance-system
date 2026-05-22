// Minimal Deno type stubs for LSP compatibility in Supabase Edge Functions.
// The actual runtime is Deno — these declarations silence editor errors only.

declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const env: {
    get(key: string): string | undefined;
  };
}
