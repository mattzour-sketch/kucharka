import { describe, expect, it } from 'vitest';
import { fieldValue, normalizedPrepText, parsePrepInput, parseServingsInput } from './fieldInput';

describe('parsePrepInput', () => {
  it('minuty i hodiny se přepočítají na minuty', () => {
    expect(parsePrepInput('45')).toBe(45);
    expect(parsePrepInput('45 min')).toBe(45);
    expect(parsePrepInput('1 h')).toBe(60);
    expect(parsePrepInput('1,5 h')).toBe(90);
    expect(parsePrepInput('1 h 30 min')).toBe(90);
    expect(parsePrepInput('1h30')).toBe(90);
    expect(parsePrepInput('2 hodiny')).toBe(120);
    expect(parsePrepInput('1 hod. 15 min.')).toBe(75);
    expect(parsePrepInput('1:30')).toBe(90);
  });

  it('prázdné je null, nečitelné „invalid"', () => {
    expect(parsePrepInput('  ')).toBeNull();
    expect(parsePrepInput('chvilka')).toBe('invalid');
    expect(parsePrepInput('30–40')).toBe('invalid');
    expect(parsePrepInput('0')).toBe('invalid');
  });
});

describe('parseServingsInput', () => {
  it('jedno kladné číslo, i s česky psaným slovem za ním', () => {
    expect(parseServingsInput('4')).toBe(4);
    expect(parseServingsInput('2,5')).toBe(2.5);
    expect(parseServingsInput('4 porce')).toBe(4);
    expect(parseServingsInput('')).toBeNull();
  });

  it('rozsah, nula a text jsou „invalid"', () => {
    expect(parseServingsInput('4–6')).toBe('invalid');
    expect(parseServingsInput('4-6')).toBe('invalid');
    expect(parseServingsInput('0')).toBe('invalid');
    expect(parseServingsInput('pro čtyři')).toBe('invalid');
  });
});

describe('fieldValue a normalizedPrepText', () => {
  it('nečitelné se uloží prázdné, přečtená doba se přepíše na minuty', () => {
    expect(fieldValue('invalid')).toBeNull();
    expect(fieldValue(90)).toBe(90);
    expect(normalizedPrepText('1 h 30 min')).toBe('90');
    expect(normalizedPrepText('chvilka')).toBe('chvilka');
    expect(normalizedPrepText('')).toBe('');
  });
});
