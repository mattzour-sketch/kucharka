import { describe, expect, it } from 'vitest';
import { buildRecipeText } from './shareText';

describe('shareText', () => {
  it('sestaví recept s porcemi, surovinami a postupem', () => {
    const text = buildRecipeText({
      name: 'Rizoto',
      portions: 4,
      ingredients: ['400 g kuřecí prsa', '200 g rýže'],
      instructions: 'Orestovat.\nZalít vodou.',
    });
    expect(text).toBe(
      ['Rizoto', 'Porce: 4', '', 'Suroviny:', '- 400 g kuřecí prsa', '- 200 g rýže', '', 'Postup:', 'Orestovat.\nZalít vodou.'].join('\n'),
    );
  });

  it('u přeškálovaného receptu uvede původní počet porcí', () => {
    const text = buildRecipeText({
      name: 'Rizoto',
      portions: 6,
      scaledFrom: 4,
      ingredients: ['600 g rýže'],
      instructions: null,
    });
    expect(text).toContain('Porce: 6 (přepočteno z 4)');
    expect(text).toContain('- 600 g rýže');
  });

  it('vynechá porce a postup, když nejsou', () => {
    const text = buildRecipeText({
      name: 'Bramborák',
      ingredients: ['brambory', 'vejce'],
      instructions: null,
    });
    expect(text).toBe(['Bramborák', '', 'Suroviny:', '- brambory', '- vejce'].join('\n'));
  });
});
