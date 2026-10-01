import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from '../../utils/translations';

/**
 * The Web Scraper's "nothing to extract" prompt asks the user to act, so it is
 * translated (like `smartLookup.selectColumnsFirst`); its status logs are not.
 */
describe('scraper.needFields', () => {
  it('keeps the English wording exactly', () => {
    expect(TRANSLATIONS.en.scraper.needFields).toBe('Please describe what data to extract or select fields.');
  });

  it('has its own Arabic text', () => {
    expect(TRANSLATIONS.ar.scraper.needFields).toMatch(/[\u0600-\u06FF]/);
    expect(TRANSLATIONS.ar.scraper.needFields).not.toBe(TRANSLATIONS.en.scraper.needFields);
  });
});
