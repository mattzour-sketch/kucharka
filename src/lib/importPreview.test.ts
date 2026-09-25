import { describe, expect, it } from 'vitest';
import {
  fallbackImportName,
  isPreviewEdited,
  previewFromParsed,
  previewSummary,
  rawImportName,
  type ImportPreview,
} from './importPreview';

describe('previewFromParsed', () => {
  it('převede výsledek parseru na textové hodnoty polí', () => {
    expect(
      previewFromParsed({
        name: 'Rolls',
        servings: 8,
        ingredients: ['90g flour', '# For the icing', '20g yogurt'],
        instructions: '1. Mix.\n2. Bake.',
        source: '@fitfoodie',
        prepMinutes: 35,
      }),
    ).toEqual({
      name: 'Rolls',
      servings: '8',
      prepMinutes: '35',
      source: '@fitfoodie',
      ingredients: '90g flour\n# For the icing\n20g yogurt',
      instructions: '1. Mix.\n2. Bake.',
    });
  });

  it('chybějící hodnoty = prázdná pole', () => {
    expect(previewFromParsed({ name: '', servings: null, ingredients: [], instructions: null })).toEqual({
      name: '',
      servings: '',
      prepMinutes: '',
      source: '',
      ingredients: '',
      instructions: '',
    });
  });
});

describe('isPreviewEdited', () => {
  const parsed: ImportPreview = {
    name: '',
    servings: '',
    prepMinutes: '',
    source: '',
    ingredients: 'flour',
    instructions: '1. Bake.',
  };

  it('hned po rozebrání neupraveno', () => {
    expect(isPreviewEdited({ ...parsed }, parsed)).toBe(false);
  });

  it.each(['name', 'servings', 'prepMinutes', 'source', 'ingredients', 'instructions'] as const)(
    'změna pole %s = upraveno',
    (field) => {
      expect(isPreviewEdited({ ...parsed, [field]: `${parsed[field]}x` }, parsed)).toBe(true);
    },
  );
});

describe('fallbackImportName', () => {
  it('„Recept od @autor", jinak „Vložený recept"', () => {
    expect(fallbackImportName('@x')).toBe('Recept od @x');
    expect(fallbackImportName('  @x ')).toBe('Recept od @x');
    expect(fallbackImportName('')).toBe('Vložený recept');
    expect(fallbackImportName('   ')).toBe('Vložený recept');
  });
});

describe('previewSummary', () => {
  // 13 řádků surovin = 12 surovin + 1 nadpis; nadpis surovinou není (UC023).
  it('IG ukázka: 13 řádků → „12 surovin (1 sekce) · 8 kroků"', () => {
    const ingredients = [...Array(7).fill('a'), '# For the icing', ...Array(5).fill('b')].join('\n');
    const instructions = Array.from({ length: 8 }, (_, i) => `${i + 1}. krok`).join('\n\n');
    expect(previewSummary(ingredients, instructions)).toBe('12 surovin (1 sekce) · 8 kroků');
  });

  it('český plurál', () => {
    expect(previewSummary('a', '1. x')).toBe('1 surovina · 1 krok');
    expect(previewSummary('a\nb\n# X\nc\n# Y', '1\n2\n3')).toBe('3 suroviny (2 sekce) · 3 kroky');
    expect(previewSummary('# A\n# B\n# C\n# D\n# E\na', '')).toBe('1 surovina (5 sekcí) · 0 kroků');
    expect(previewSummary('', '')).toBe('0 surovin · 0 kroků');
  });
});

describe('rawImportName', () => {
  it('první řádek s písmenem, oříznutý a zkrácený na 80 znaků', () => {
    expect(rawImportName('\n  \n  Bábovka od babičky  \n200 g mouky')).toBe('Bábovka od babičky');
    expect(rawImportName('.\n🔥🔥\nKuře na medu')).toBe('Kuře na medu');
    expect(rawImportName('x'.repeat(100))).toHaveLength(80);
  });

  it('bez písmen → „Vložený recept"', () => {
    expect(rawImportName('  \n123\n')).toBe('Vložený recept');
  });
});
