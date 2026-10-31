import { extractPpe, gs1CheckDigit, isValidPpe, normalizePpe } from './gs1';

describe('gs1', () => {
  it('validates the check digit of a PPE number', () => {
    expect(isValidPpe('590322428100789765')).toBe(true);
    expect(isValidPpe('590322428100789766')).toBe(false); // wrong check digit
    expect(isValidPpe('590322428100789756')).toBe(false); // swapped digits
    expect(isValidPpe('59032242810078976')).toBe(false); // 17 digits
    expect(isValidPpe('59032242810078976A')).toBe(false);
  });

  it('computes GS1 check digits', () => {
    expect(gs1CheckDigit('629104150021')).toBe(3); // GS1 example (GTIN-13)
    expect(gs1CheckDigit('59032242810078976')).toBe(5);
  });

  it('removes grouping separators', () => {
    expect(normalizePpe(' 5903 2242-8100 789765 ')).toBe('590322428100789765');
  });

  it.each([
    ['plain digits', '590322428100789765'],
    ['GS1 element string with AI 8018', '8018590322428100789765'],
    ['human-readable GS1 text', '(8018)590322428100789765'],
    ['symbology prefix and separator', ']C1\u001d8018590322428100789765\u001d'],
    ['number among other text', 'PPE: 5903 2242 8100 789765; licznik 26931897'],
  ])('extracts the PPE number from %s', (_, data) => {
    expect(extractPpe(data)).toBe('590322428100789765');
  });

  it('returns null when the code contains no valid PPE number', () => {
    expect(extractPpe('26931897')).toBeNull();
    expect(extractPpe('590322428100789766')).toBeNull();
    expect(extractPpe('https://example.com')).toBeNull();
  });
});
