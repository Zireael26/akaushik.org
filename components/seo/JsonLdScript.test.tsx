import { describe, expect, it } from 'vitest';
import { JsonLdScript } from './JsonLdScript';

describe('JsonLdScript', () => {
  it('carries the supplied response nonce onto the inline JSON-LD element', () => {
    const element = JsonLdScript({
      id: 'ld-json-test',
      json: '{"ok":true}',
      nonce: 'nonce-123',
    });

    expect(element.props).toMatchObject({
      id: 'ld-json-test',
      nonce: 'nonce-123',
      type: 'application/ld+json',
      dangerouslySetInnerHTML: { __html: '{"ok":true}' },
    });
  });

  it('omits the nonce when none is supplied', () => {
    const element = JsonLdScript({ id: 'ld-json-test', json: '{}' });
    expect((element.props as { nonce?: string }).nonce).toBeUndefined();
  });
});
