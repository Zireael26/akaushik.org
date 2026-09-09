import { Header } from '@/components/layout/Header';
import { Heatfield } from '@/components/pixel/Heatfield';
import { LoginForm } from '@/components/layout/LoginForm';
import { getCurrentPrincipal } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EntrancePage() {
  // Validate real session identity via auth adapter.
  // Forged cookies without a valid session record will not redirect.
  const principal = await getCurrentPrincipal();
  if (principal) {
    redirect('/overview');
  }

  return (
    <div>
      <Header user={null} />

      <section className="px-hero-block" data-screen-label="01 Entrance">
        <div className="px-hero">
          <h1 className="px-hero-title">
            Friends,
            <br />
            of AK.
          </h1>

          <div className="px-hero-aside">
            <div className="px-hero-sub">
              A shared space for ongoing work, records, and conversations
            </div>

            <LoginForm />

            <div className="px-hero-note">
              <span className="px-hero-swatch" aria-hidden="true" />
              <p>
                A place for our work together. Meetings, notes, and questions, kept in one place.
              </p>
            </div>
          </div>
        </div>

        <Heatfield />
      </section>
    </div>
  );
}
