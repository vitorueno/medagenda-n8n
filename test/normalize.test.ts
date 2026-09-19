import { describe, expect, it } from 'vitest';
import { normalizeName, normalizeText } from '../src/shared/normalize';

describe('normalizeText', () => {
  it('lowercases, trims, strips accents and collapses whitespace', () => {
    expect(normalizeText('  Dermatológia  ')).toBe('dermatologia');
    expect(normalizeText('CARDIOLOGIA')).toBe('cardiologia');
    expect(normalizeText('clinica   geral')).toBe('clinica geral');
  });

  it('keeps a "Dr."/"Dra." prefix, unlike normalizeName', () => {
    expect(normalizeText('Dr. Diego Alves')).toBe('dr. diego alves');
  });
});

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Carla Mendes  ')).toBe('carla mendes');
  });

  it('strips accents', () => {
    expect(normalizeName('José André')).toBe('jose andre');
  });

  it('strips "Dr."/"Dra." prefixes regardless of case or punctuation', () => {
    expect(normalizeName('Dr. Diego Alves')).toBe('diego alves');
    expect(normalizeName('dra carla mendes')).toBe('carla mendes');
    expect(normalizeName('DOUTORA Carla Mendes')).toBe('carla mendes');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeName('Carla   Mendes')).toBe('carla mendes');
  });

  it('treats equivalent names as equal after normalization', () => {
    expect(normalizeName('Dra. Carla Mendes')).toBe(normalizeName('carla mendes'));
  });
});
