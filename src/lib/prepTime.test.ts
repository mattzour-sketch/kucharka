import { describe, expect, it } from 'vitest';
import { formatPrepTime, isQuick } from './prepTime';

describe('formatPrepTime', () => {
  it('minuty pod hodinu', () => {
    expect(formatPrepTime(25)).toBe('25 min');
    expect(formatPrepTime(5)).toBe('5 min');
  });
  it('celé hodiny a hodiny+minuty', () => {
    expect(formatPrepTime(60)).toBe('1 h');
    expect(formatPrepTime(90)).toBe('1 h 30 min');
    expect(formatPrepTime(125)).toBe('2 h 5 min');
  });
  it('prázdné / nekladné → prázdný řetězec', () => {
    expect(formatPrepTime(null)).toBe('');
    expect(formatPrepTime(undefined)).toBe('');
    expect(formatPrepTime(0)).toBe('');
  });
});

describe('isQuick', () => {
  it('do 30 min včetně je rychlý', () => {
    expect(isQuick(30)).toBe(true);
    expect(isQuick(20)).toBe(true);
  });
  it('nad 30 min nebo bez doby není rychlý', () => {
    expect(isQuick(31)).toBe(false);
    expect(isQuick(null)).toBe(false);
    expect(isQuick(0)).toBe(false);
  });
});
