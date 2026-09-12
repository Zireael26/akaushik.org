import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Heatfield } from '@/components/pixel/Heatfield';
import { LoginForm } from '@/components/layout/LoginForm';
import { currentReader } from '@/lib/session';
import { course } from '@/lib/course';

export const dynamic = 'force-dynamic';

export default async function EntrancePage() {
  // Real session identity, not a cookie's presence: a forged cookie without a
  // matching session row falls through to the form.
  if (await currentReader()) redirect('/contents');

  const { counts } = course;

  return (
    <div>
      <Header reader={null} />

      <section className="px-hero-block">
        <div className="px-hero">
          <h1 className="px-hero-title">
            Harness
            <br />
            Engineering.
          </h1>

          <div className="px-hero-aside">
            <div className="px-hero-sub">
              A course on building agent systems that can be measured
            </div>

            <LoginForm />

            <div className="px-hero-note">
              <span className="px-hero-swatch" aria-hidden="true" />
              <p>
                {counts.lessons} lessons, {counts.module_labs} runnable labs, and{' '}
                {counts.interactive_models} interactive models. Still being revised, which is
                why it is behind a password rather than out in the open.
              </p>
            </div>
          </div>
        </div>

        <Heatfield />
      </section>
    </div>
  );
}
