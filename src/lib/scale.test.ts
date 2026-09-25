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

  it('parseLeadingQuantity: smíšené číslo, unicode zlomek a rozsah', () => {
    expect(parseLeadingQuantity('1 1/2 cups flour')).toEqual({ amount: 1.5, rest: 'cups flour' });
    expect(parseLeadingQuantity('½ cibule')).toEqual({ amount: 0.5, rest: 'cibule' });
    expect(parseLeadingQuantity('1½ hrnku')).toEqual({ amount: 1.5, rest: 'hrnku' });
    expect(parseLeadingQuantity('2–3 lžíce oleje')).toEqual({ amount: 2, high: 3, rest: 'lžíce oleje' });
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

  it('gramy a mililitry na celé číslo, pod 10 na desetiny', () => {
    expect(scaleQuantityText('250 g mouky', 1 / 3)).toBe('83 g mouky');
    expect(scaleQuantityText('100g of skyr yogurt', 1.5)).toBe('150 g of skyr yogurt');
    expect(scaleQuantityText('350 ml vody', 1 / 3)).toBe('117 ml vody');
    expect(scaleQuantityText('15 g droždí', 0.5)).toBe('7,5 g droždí');
    expect(scaleQuantityText('5 g soli', 1 / 3)).toBe('1,7 g soli');
  });

  it('kg a litry na setiny', () => {
    expect(scaleQuantityText('1,5 kg brambor', 1 / 3)).toBe('0,5 kg brambor');
    expect(scaleQuantityText('1 l mléka', 1 / 3)).toBe('0,33 l mléka');
  });

  it('kusy a lžíce na půlky, zaokrouhlené s „~"', () => {
    expect(scaleQuantityText('4 vejce', 1 / 3)).toBe('~1,5 vejce');
    expect(scaleQuantityText('3 vejce', 0.5)).toBe('1,5 vejce');
    // „lžíce" není litr (l + písmeno)
    expect(scaleQuantityText('10 lžic cukru', 1 / 3)).toBe('~3,5 lžic cukru');
    // pod 1 zůstávají setiny (čtvrt lžičky se na půlku nezaokrouhlí)
    expect(scaleQuantityText('1/2 lžičky soli', 0.5)).toBe('0,25 lžičky soli');
  });

  it('rozsah vynásobí obě meze, smíšené číslo a unicode zlomek jako celek', () => {
    expect(scaleQuantityText('1–2 lžíce', 2)).toBe('2–4 lžíce');
    expect(scaleQuantityText('2-3 stroužky česneku', 2)).toBe('4-6 stroužky česneku');
    expect(scaleQuantityText('1 1/2 cups flour', 2)).toBe('3 cups flour');
    expect(scaleQuantityText('½ cibule', 2)).toBe('1 cibule');
    expect(scaleQuantityText('3–4 stroužky', 0.5)).toBe('1,5–2 stroužky');
  });
});
