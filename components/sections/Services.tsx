import { MatterRow, RuledRow } from '@/components/pixel/RuledRow';
import { SectionHead } from '@/components/pixel/SectionHead';
import {
  SERVICES,
  SERVICES_AUTONOMY,
  SERVICES_HEADING,
  SERVICES_INTRO,
  SERVICES_PROOF,
} from '@/lib/services';

/** Door tags rotate the same way the work tags do. Three doors, three tones. */
function doorTone(i: number): 'cobalt' | 'amber' | 'red' {
  switch (i % 3) {
    case 0:
      return 'cobalt';
    case 1:
      return 'amber';
    default:
      return 'red';
  }
}


/**
 * Services — the commercial twin of Method, not a second description of it.
 *
 * Three doors into one system. Each door is a matter-row head (title at the
 * matter scale, door index as the mono tag) over its lede, with Entry / First
 * moves / You hold / Fit as ruled rows. The head is not a link, so services.css
 * turns off the matter row's hover indent and its closing rule.
 *
 * Copy is lib/services.ts verbatim. That file is also the llms-full.txt corpus,
 * so nothing here paraphrases it.
 */
export function Services() {
  return (
    <section
      className="px-section px-services"
      id="services"
      data-screen-label="05 Services"
      aria-labelledby="services-head"
    >
      <SectionHead heading={SERVICES_HEADING} label="Engagements" id="services-head" />
      <p className="px-split-intro">{SERVICES_INTRO}</p>

      {SERVICES.map((service, i) => (
        <article className="px-service" key={service.num}>
          <div className="px-service-num">{service.num}</div>
          <MatterRow title={service.title} tag={String(i + 1).padStart(2, '0')} tagTone={doorTone(i)} />
          <p className="px-service-lede">{service.lede}</p>
          {service.list.map((row, j) => (
            <RuledRow key={row.label} tag={row.label} last={j === service.list.length - 1}>
              {row.value}
            </RuledRow>
          ))}
        </article>
      ))}

      <article className="px-service px-service-shared">
        <MatterRow title={SERVICES_AUTONOMY.title} tag="Ctrl" tagTone="ink" />
        <p className="px-service-lede">{SERVICES_AUTONOMY.body}</p>
      </article>

      <p className="px-service-proof">
        {SERVICES_PROOF.lead} {SERVICES_PROOF.rest}{' '}
        <a href={SERVICES_PROOF.adrHref} rel="noopener noreferrer" target="_blank">
          ADRs
        </a>
        {', '}
        <a href={SERVICES_PROOF.changelogHref} rel="noopener noreferrer" target="_blank">
          changelog
        </a>
        {', '}
        <a href={SERVICES_PROOF.corpusHref}>/llms-full.txt</a>.
      </p>
    </section>
  );
}
