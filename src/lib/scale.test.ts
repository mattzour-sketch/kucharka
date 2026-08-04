import { describe, expect, it } from 'vitest';
import { parseLeadingQuantity, scaleQuantityText } from './scale';

describe('scale', () => {
  it('parseLeadingQuantity vytáhne číslo a zbytek', () => {
    expect(parseLeadingQuantity('200 g rýže')).toEqual({ amount: 200, rest: 'g rýže' });
    expect(parseLeadingQuantity('4 vejce')).toEqual({ amount: 4, rest: 'vejce' });
    expect(parseLeadingQuantity('200g rýže')).toEqual({ amount: 200, rest: 'g rýže' });
  });

  it('parseLeadingQuantity zvládne čárku i zlomek', () => {
    expect(parseLeadingQuantity('1,5 hrnku mouky')).toEqual({ amount: 1.5, rest: 'hrnku mouky' });
    expect(parseLeadingQuantity('1/2 lžíce soli')).toEqual({ amount: 0.5, rest: 'lžíce soli' });
  });

  it('parseLeadingQuantity vrátí null, když řádek nezačíná číslem', () => {
    expect(parseLeadingQuantity('hrst mouky')).toBeNull();
    expect(parseLeadingQuantity('sůl podle chuti')).toBeNull();
  });

  it('scaleQuantityText vynásobí množství', () => {
    expect(scaleQuantityText('200 g rýže', 0.5)).toBe('100 g rýže');
    expect(scaleQuantityText('4 vejce', 1.5)).toBe('6 vejce');
    expect(scaleQuantityText('1/2 lžíce', 3)).toBe('1,5 lžíce');
  });

  it('scaleQuantityText nechá beze změny text bez čísla i faktor 1', () => {
    expect(scaleQuantityText('hrst mouky', 2)).toBe('hrst mouky');
    expect(scaleQuantityText('1/2 lžíce', 1)).toBe('1/2 lžíce');
  });
});
