import { describe, expect, it } from 'vitest';
import { getReadingTime } from './reading-time';

describe('getReadingTime', () => {
  it('returns the format "N min read"', () => {
    expect(getReadingTime('hello world')).toMatch(/^\d+ min read$/);
  });

  it('rounds 200 words to 1 minute', () => {
    const text = 'word '.repeat(200);
    expect(getReadingTime(text)).toBe('1 min read');
  });

  it('rounds 400 words to 2 minutes', () => {
    const text = 'word '.repeat(400);
    expect(getReadingTime(text)).toBe('2 min read');
  });

  it('never returns less than 1 minute', () => {
    expect(getReadingTime('')).toBe('1 min read');
    expect(getReadingTime('one two three')).toBe('1 min read');
  });

  it('strips fenced code blocks from the count', () => {
    const code = '```\n' + ('x '.repeat(1000)) + '\n```';
    const prose = 'word '.repeat(50);
    expect(getReadingTime(code + ' ' + prose)).toBe('1 min read');
  });

  it('strips inline code spans from the count', () => {
    const inline = '`' + ('x '.repeat(500)) + '`';
    const prose = 'word '.repeat(50);
    expect(getReadingTime(inline + ' ' + prose)).toBe('1 min read');
  });

  it('strips HTML tags', () => {
    const html = '<aside>' + ('x '.repeat(50)) + '</aside>';
    const result = getReadingTime(html + ' ' + 'word '.repeat(200));
    // 50 + 200 words = 1.25 → rounds to 1
    expect(result).toBe('1 min read');
  });

  it('strips markdown special characters', () => {
    const text = '# Heading\n\n**bold** *italic* > quote - bullet ' + 'word '.repeat(200);
    expect(getReadingTime(text)).toBe('1 min read');
  });

  it('counts an intra-word hyphenated compound as one word', () => {
    const text = 'word '.repeat(297) + 'state-of-the-art';
    expect(getReadingTime(text)).toBe('1 min read');
  });

  it('preserves prose containing a bare less-than comparison', () => {
    const text = 'word '.repeat(293) + 'if a < b then c > d end';
    expect(getReadingTime(text)).toBe('2 min read');
  });

  it('handles multi-paragraph text', () => {
    const text = 'word '.repeat(150) + '\n\n' + 'word '.repeat(150);
    expect(getReadingTime(text)).toBe('2 min read');
  });

  it('handles content with mixed code + prose realistically', () => {
    const realistic =
      'This is a paragraph about agents. ' +
      '```ts\nfunction foo() { return 42; }\n```\n' +
      'Another paragraph follows the code block. ' +
      'word '.repeat(390);
    expect(getReadingTime(realistic)).toBe('2 min read');
  });
});
