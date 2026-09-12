/**
 * Stand-in types for OpenNext-generated worker.
 */
declare module '*/worker.js' {
  const handler: {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  };
  export default handler;
}
