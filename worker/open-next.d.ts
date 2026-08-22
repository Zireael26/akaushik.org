/**
 * Stand-in types for the OpenNext-generated worker.
 *
 * `.open-next/worker.js` does not exist until `pnpm cf:build` has run, and a
 * fresh clone has to typecheck before that. When the real file is present
 * TypeScript resolves it and this declaration is simply not consulted.
 */
declare module '*/worker.js' {
  const handler: {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  };
  export default handler;
}
