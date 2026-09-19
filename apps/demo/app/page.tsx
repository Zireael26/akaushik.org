import { Header } from '@/components/layout/Header';
import { Heatfield } from '@/components/pixel/Heatfield';
import { LoginForm } from '@/components/layout/LoginForm';
import { Chat } from '@/components/chat/Chat';
import { currentAccount, demoEnv } from '@/lib/session';
import { getSuggestions } from '@/lib/demo-config';

export const dynamic = 'force-dynamic';

const TITLE_FALLBACK = 'Private demo';

/**
 * Reads a public display binding. Worker vars/secrets arrive through the
 * Cloudflare context (local dev: miniflare via initOpenNextCloudflareForDev);
 * process.env covers `next dev` before the context is ready. Never used for
 * credential bindings — those stay server-side in the chat API route.
 */
function demoPublic(key: string, fallback = ''): string {
  try {
    const env = demoEnv() as Record<string, string | undefined>;
    const fromBinding = env[key];
    if (typeof fromBinding === 'string' && fromBinding.length > 0) return fromBinding;
  } catch {
    /* bindings unavailable — fall through to process.env */
  }
  const fromNode = process.env[key];
  return typeof fromNode === 'string' && fromNode.length > 0 ? fromNode : fallback;
}

/**
 * DEMO_SUGGESTIONS is an optional secret holding a JSON array of display
 * strings. Parsing lives in lib/demo-config.ts and runs here, server-side:
 * invalid JSON (or a non-array, or an array with nothing usable in it)
 * resolves to null and the chat simply renders no chips. Never throws.
 */
function readSuggestionsRaw(): string | undefined {
  try {
    const env = demoEnv() as Record<string, string | undefined>;
    if (typeof env.DEMO_SUGGESTIONS === 'string') return env.DEMO_SUGGESTIONS;
  } catch {
    /* bindings unavailable — fall through to process.env */
  }
  return process.env.DEMO_SUGGESTIONS;
}

export default async function DemoPage() {
  const account = await currentAccount();

  // Real session identity, not a cookie's presence: a forged cookie without a
  // matching session row falls through to the form.
  if (!account) {
    return (
      <div>
        <Header account={null} />

        <section className="px-hero-block">
          <div className="px-hero">
            {/* Deliberately generic: the entrance is public, and the branded
                title names the client, so it only appears after sign-in. */}
            <h1 className="px-hero-title">
              {TITLE_FALLBACK}
            </h1>

            <div className="px-hero-aside">
              <div className="px-hero-sub">
                A private demonstration. Sign in with the details you were sent.
              </div>

              <LoginForm />

              <div className="px-hero-note">
                <span className="px-hero-swatch" aria-hidden="true" />
                <p>Every answer cites the page it came from.</p>
              </div>
            </div>
          </div>

          <Heatfield />
        </section>
      </div>
    );
  }

  const title = demoPublic('DEMO_TITLE', TITLE_FALLBACK);
  const subtitle = demoPublic('DEMO_SUBTITLE', '');
  // Single parsing implementation (lib/demo-config.ts, 12-chip cap); null
  // means no chips, never a throw.
  const suggestions = getSuggestions({ DEMO_SUGGESTIONS: readSuggestionsRaw() });

  return (
    <div>
      <Header active="demo" account={{ name: account.name }} />
      <Chat title={title} subtitle={subtitle} suggestions={suggestions} />
    </div>
  );
}
