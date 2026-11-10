import { describe, expect, it } from 'vitest';
import { hasAmountColumn, splitLeadingAmount } from './amountSplit';

describe('splitLeadingAmount', () => {
  it('oddělí gramy od názvu', () => {
    expect(splitLeadingAmount('800 g hovězí kližky')).toEqual({ amount: '800 g', name: 'hovězí kližky' });
    expect(splitLeadingAmount('1,5 kg brambor')).toEqual({ amount: '1,5 kg', name: 'brambor' });
    expect(splitLeadingAmount('250 ml mléka')).toEqual({ amount: '250 ml', name: 'mléka' });
  });

  it('text množství nepřepisuje – bere ho tak, jak je napsaný', () => {
    expect(splitLeadingAmount('250g mouky')).toEqual({ amount: '250g', name: 'mouky' });
    expect(splitLeadingAmount('  30  g   sádla')).toEqual({ amount: '30  g', name: 'sádla' });
  });

  it('kusy a jiné míry nechá u názvu, do sloupce jde jen číslo', () => {
    expect(splitLeadingAmount('2 vejce')).toEqual({ amount: '2', name: 'vejce' });
    expect(splitLeadingAmount('4 stroužky česneku')).toEqual({ amount: '4', name: 'stroužky česneku' });
    expect(splitLeadingAmount('2 lžíce oleje')).toEqual({ amount: '2', name: 'lžíce oleje' });
    expect(splitLeadingAmount('3 ks rajčat')).toEqual({ amount: '3 ks', name: 'rajčat' });
  });

  it('„l" není litr, když jím začíná slovo', () => {
    expect(splitLeadingAmount('2 lžíce oleje')?.amount).toBe('2');
    expect(splitLeadingAmount('1 l mléka')).toEqual({ amount: '1 l', name: 'mléka' });
  });

  it('zvládne rozsah, zlomek a přibližné množství po přepočtu porcí', () => {
    expect(splitLeadingAmount('2–3 stroužky česneku')).toEqual({ amount: '2–3', name: 'stroužky česneku' });
    expect(splitLeadingAmount('1/2 citronu')).toEqual({ amount: '1/2', name: 'citronu' });
    expect(splitLeadingAmount('~1,5 vejce')).toEqual({ amount: '~1,5', name: 'vejce' });
  });

  it('bez čísla na začátku nedělí', () => {
    expect(splitLeadingAmount('sůl, pepř')).toBeNull();
    expect(splitLeadingAmount('špetka soli')).toBeNull();
    expect(splitLeadingAmount('Mouka hladká 500 g')).toBeNull();
    expect(splitLeadingAmount('')).toBeNull();
  });

  it('nedělí, když za číslem není název nebo jde o číslování', () => {
    expect(splitLeadingAmount('500 g')).toBeNull();
    expect(splitLeadingAmount('2')).toBeNull();
    expect(splitLeadingAmount('1. vejce')).toBeNull();
    expect(splitLeadingAmount('2x cibule')).toBeNull();
  });
});

describe('hasAmountColumn', () => {
  it('stačí jedna surovina s množstvím', () => {
    expect(hasAmountColumn(['sůl', '800 g brambor'])).toBe(true);
  });

  it('bez množství sloupec není', () => {
    expect(hasAmountColumn(['hrst mouky', 'sůl, pepř'])).toBe(false);
    expect(hasAmountColumn([])).toBe(false);
  });
});
