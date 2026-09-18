/**
 * Test-only module resolution.
 *
 * The demo route tree imports three things plain node cannot resolve:
 *   - `@/*` path aliases (a tsconfig/next construct) → map to the package root.
 *   - `server-only` (not installed; a build-time marker) → empty stub.
 *   - `next/headers`, `next/navigation` (need the Next runtime) → stubs that
 *     throw if actually called. The unauthenticated chat tests never reach
 *     them: currentAccount() returns null before touching headers().
 *
 *   - extensionless relative imports (`./demo-config`) → the `.ts` file.
 *
 * Everything else falls through to default resolution.
 */
const STUBS = {
  "server-only": "export default {};",
  "next/headers":
    "export async function headers() { throw new Error('no Next runtime under node --test'); }",
  "next/navigation":
    "export function redirect() { throw new Error('no Next runtime under node --test'); }",
};

/** @type {import('node:module').ResolveHook} */
export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(STUBS, specifier)) {
    return {
      url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    return {
      url: new URL(`../../${specifier.slice(2)}`, import.meta.url).href,
      shortCircuit: true,
    };
  }
  // Extensionless relative imports between lib/ modules (bundler style):
  // probe the `.ts` file plain node will not guess.
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?(\?|$)/.test(specifier)) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}
