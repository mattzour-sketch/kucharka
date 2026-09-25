import { describe, expect, it } from 'vitest';
import { parseRecipeText } from './parseRecipe';
import { IG_CINNAMON_ROLLS, IG_CZ_CHICKEN, IG_KINDER_BALLS, IG_YAKINIKU } from './igSamples';

function steps(instructions: string | null): string[] {
  return (instructions ?? '').split('\n').filter((line) => line.trim() !== '');
}

// UC031b: skutečné popisky, které dodal uživatel (igSamples.ts). Referenční výsledek parseru.
describe('parseRecipe – skutečné popisky z Instagramu', () => {
  it('skořicové rolky: makra pryč, sekce bez značek, odstavce postupu jako kroky', () => {
    const parsed = parseRecipeText(IG_CINNAMON_ROLLS);
    expect(parsed.name).toBe('');
    expect(parsed.ingredients).toEqual([
      '# Dough',
      '150g flour',
      '100g greek yogurt',
      '40g melted butter',
      '25g sweetener',
      '1tsp baking powder',
      'Pinch salt',
      '# Filling',
      '75g cream cheese',
      '20g brown sugar',
      '10g cinnamon',
      '45g casein vanilla protein powder',
    ]);
    const lines = steps(parsed.instructions);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe(
      'Combine the dough ingredients in a bowl and form into a dough ball, then let it rest for a few minutes. Heat up the oven to 180°C or 350°F.',
    );
    expect(lines[1]).toBe('Combine filling ingredients in a separate bowl.');
  });

  it('kinder kuličky: makra nejsou název, „Process" je postup, porce ze závorky', () => {
    const parsed = parseRecipeText(IG_KINDER_BALLS);
    expect(parsed.name).toBe('');
    expect(parsed.servings).toBe(6);
    expect(parsed.ingredients).toHaveLength(7);
    expect(parsed.ingredients[1]).toBe('100g of skyr yogurt');
    expect(steps(parsed.instructions)).toHaveLength(10);
    expect(parsed.instructions).toMatch(/^1\. Mix protein powder/);
  });

  it('kuře (česky): nadpisy sekcí bez dvojtečky, všech 5 sekcí v surovinách, bez názvu', () => {
    const parsed = parseRecipeText(IG_CZ_CHICKEN);
    expect(parsed.name).toBe('');
    expect(parsed.ingredients.filter((line) => line.startsWith('# '))).toEqual([
      '# Na kuře',
      '# Na těstíčko',
      '# Na omáčku',
      '# Na zahuštění omáčky',
      '# Na smažení',
    ]);
    expect(parsed.ingredients).toHaveLength(29);
    expect(parsed.ingredients[1]).toBe('2 kuřecí prsa');
    expect(parsed.ingredients).toContain('neutrální olej (rostlinný, avokadovy apod.)');
    expect(parsed.instructions).toBeNull();
  });

  it('yakiniku: „[Sauce]" je sekce, poznámka pod čarou a KEY POINTS pryč', () => {
    const parsed = parseRecipeText(IG_YAKINIKU);
    expect(parsed.name).toBe('YAKINIKU DON');
    expect(parsed.servings).toBe(2);
    expect(parsed.ingredients).toEqual([
      'Rice: 2 bowls (2 * 220g)',
      'Beef*: 250g',
      '# Sauce',
      'Ginger: 1 knob',
      'Garlic: clove',
      'Sesame oil: 1/2 tbsp',
      'Ground toasted sesame seeds: 1 tbsp',
      'White wine: 2 tbsp',
      'Sugar: 1 1/2 tbsp',
      'Soy sauce: 2 tbsp',
      '# For garnish',
      'Chives',
    ]);
    const lines = steps(parsed.instructions);
    expect(lines).toHaveLength(5);
    expect(parsed.instructions).not.toContain('KEY POINTS');
    expect(parsed.instructions).not.toContain('Swap 2 tbsp');
  });
});
