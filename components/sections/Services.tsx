import { MatterRow, RuledRow } from '@/components/pixel/RuledRow';
import { SectionHead } from '@/components/pixel/SectionHead';
import { SERVICES } from '@/lib/services';

/** Duration tags rotate the same way the work tags do. Three services, three tones. */
function durationTone(i: number): 'cobalt' | 'amber' | 'red' {
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
 * Services — the ruled-row grammar applied to the three engagement shapes.
 *
 * gaurijha.com has no services section, so this one is designed rather than
 * ported. It stays inside the existing vocabulary: each service is a matter-row
 * head (title at the matter scale, duration as the mono tag) over its lede, with
 * the In/Out/Fit lines as ruled rows whose label is the tag. The head is not a
 * link, so services.css turns off the matter row's hover indent and its closing
 * rule — the ruled rows underneath supply their own border.
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
      <SectionHead heading="Three engagement shapes." label="Engagements" id="services-head" />
      <p className="px-split-intro">
        If something sounds close but not quite,{' '}
        <a href="#contact">tell me what you&rsquo;re actually trying to do</a>.
      </p>

      {SERVICES.map((service, i) => (
        <article className="px-service" key={service.num}>
          <div className="px-service-num">{service.num}</div>
          <MatterRow title={service.title} tag={service.duration} tagTone={durationTone(i)} />
          <p className="px-service-lede">{service.lede}</p>
          {service.list.map((row, j) => (
            <RuledRow key={row.label} tag={row.label} last={j === service.list.length - 1}>
              {row.value}
            </RuledRow>
          ))}
        </article>
      ))}
    </section>
  );
}
