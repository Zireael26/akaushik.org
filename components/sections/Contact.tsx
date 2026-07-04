type ContactLink = {
  label: string;
  value: string;
  href: string;
  external?: boolean;
};

const CONTACT_LINKS: ReadonlyArray<ContactLink> = [
  {
    label: 'GitHub',
    value: '@Zireael26',
    href: 'https://github.com/Zireael26',
    external: true,
  },
  {
    label: 'LinkedIn',
    value: 'in/abhishek26k',
    href: 'https://www.linkedin.com/in/abhishek26k',
    external: true,
  },
  {
    label: 'X',
    value: '@abhi2601k',
    href: 'https://x.com/abhi2601k',
    external: true,
  },
  {
    label: 'Résumé',
    value: 'on request',
    href: 'mailto:hello@akaushik.org?subject=Resume%20request',
  },
];

export function Contact() {
  return (
    <section
      className="contact"
      id="contact"
      data-screen-label="08 Contact"
      data-companion-pose="contact"
      aria-label="08 Contact"
    >
      <div className="contact-inner">
        <span className="section-num">08</span>
        <h2 className="contact-title">Let&apos;s talk about your project.</h2>
        <p className="contact-lede">
          Email is best. Tell me what you&apos;re trying to do in plain language
          — the industry, who uses it, what&apos;s getting in the way. I read
          every one.
        </p>
        <div className="contact-cta">
          <a
            className="btn btn-primary btn-lg"
            href="mailto:hello@akaushik.org"
          >
            hello@akaushik.org
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </a>
          <a
            className="btn btn-ghost"
            href="mailto:hello@akaushik.org?subject=20-minute%20call"
          >
            Book a 20-minute call
          </a>
        </div>
        <dl className="contact-links">
          {CONTACT_LINKS.map((link) => (
            <div key={link.label}>
              <dt>{link.label}</dt>
              <dd>
                <a
                  href={link.href}
                  {...(link.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {link.value}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
