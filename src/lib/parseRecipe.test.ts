import { describe, expect, it } from 'vitest';
import { buildRecipeText } from './shareText';
import { isBareUrl, parseRecipeText } from './parseRecipe';

describe('parseRecipe', () => {
  it('přečte formát, který appka sama vypisuje (round-trip se sdílením)', () => {
    const text = buildRecipeText({
      name: 'Rizoto',
      portions: 4,
      ingredients: ['400 g kuřecí prsa', '200 g rýže'],
      instructions: 'Orestovat.\nZalít vodou.',
    });
    expect(parseRecipeText(text)).toEqual({
      name: 'Rizoto',
      servings: 4,
      ingredients: ['400 g kuřecí prsa', '200 g rýže'],
      instructions: 'Orestovat.\nZalít vodou.',
    });
  });

  it('u přeškálovaného vezme cílový počet porcí, ne původní', () => {
    const text = 'Rizoto\nPorce: 6 (přepočteno z 4)\n\nSuroviny:\n- 600 g rýže';
    const parsed = parseRecipeText(text);
    expect(parsed.servings).toBe(6);
    expect(parsed.ingredients).toEqual(['600 g rýže']);
  });

  it('běžný text: prázdný řádek dělí suroviny od postupu', () => {
    const text = 'Bramborák\n4 brambory\n2 vejce\nhrst mouky\n\nNastrouhat, osmažit.';
    expect(parseRecipeText(text)).toEqual({
      name: 'Bramborák',
      servings: null,
      ingredients: ['4 brambory', '2 vejce', 'hrst mouky'],
      instructions: 'Nastrouhat, osmažit.',
    });
  });

  it('běžný text bez prázdného řádku: odrážky = suroviny, zbytek postup', () => {
    const text = 'Guláš\n- 500 g hovězího\n- 2 cibule\nOsmažit maso.\nPřidat cibuli.';
    expect(parseRecipeText(text)).toEqual({
      name: 'Guláš',
      servings: null,
      ingredients: ['500 g hovězího', '2 cibule'],
      instructions: 'Osmažit maso.\nPřidat cibuli.',
    });
  });
});

// UC031: referenční ukázka ze spec (kroky 3, 4, 6, 7 doplněné věrohodným textem).
const IG_SAMPLE = `Ingredients:

* 90g all-purpose flour
* 85g non-fat plain Greek yogurt
* 1 tsp baking powder
* Pinch of salt
* 4 tsp zero-calorie sugar-free brown sugar
* Cinnamon, to taste
* Pinch of salt

For the icing:

* 2 tbsp light cream cheese
* 20g non-fat plain Greek yogurt
* 30g powdered monk fruit sweetener
* 10ml almond milk
* 1 tsp pure vanilla extract

Instructions:

1. Add your flour, 85g Greek yogurt, baking powder, and a pinch of salt to a bowl. Mix together, then knead for about 5 minutes until a smooth dough forms.
2. In a separate bowl, mix your zero-calorie brown sugar with cinnamon and a small pinch of salt.
3. Roll the dough out into a rectangle on a floured surface.
4. Sprinkle the cinnamon sugar evenly over the dough, then roll it up tightly and cut into 6 rolls.
5. Bake at 375°F for 12–15 minutes, or until the tops are slightly browned.
6. While the rolls bake, whisk together all the icing ingredients until smooth.
7. Let the rolls cool for 2 minutes.
8. Spread or drizzle the icing over the top and enjoy.`;

const IG_INGREDIENTS = [
  '90g all-purpose flour',
  '85g non-fat plain Greek yogurt',
  '1 tsp baking powder',
  'Pinch of salt',
  '4 tsp zero-calorie sugar-free brown sugar',
  'Cinnamon, to taste',
  'Pinch of salt',
  '# For the icing',
  '2 tbsp light cream cheese',
  '20g non-fat plain Greek yogurt',
  '30g powdered monk fruit sweetener',
  '10ml almond milk',
  '1 tsp pure vanilla extract',
];

function steps(instructions: string | null): string[] {
  return (instructions ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

describe('parseRecipe – UC031 recept z Instagramu', () => {
  it('ukázka ze spec: 13 surovin se sekcí, 8 kroků, °C doplněné, bez názvu', () => {
    const parsed = parseRecipeText(IG_SAMPLE);
    expect(parsed.name).toBe('');
    expect(parsed.servings).toBeNull();
    expect(parsed.ingredients).toEqual(IG_INGREDIENTS);
    expect(parsed).not.toHaveProperty('source');
    expect(parsed).not.toHaveProperty('prepMinutes');

    const list = steps(parsed.instructions);
    expect(list).toHaveLength(8);
    expect(list[0]).toMatch(/^1\. Add your flour/);
    expect(list[7]).toBe('8. Spread or drizzle the icing over the top and enjoy.');
    expect(list[4]).toContain('375°F (190 °C) for 12–15 minutes');
    for (const step of list) {
      expect(step).not.toMatch(/Instructions|cream cheese/);
    }
  });

  it('ukázka s balastem: název z úvodní věty, autor, bez maker, výzev a hashtagů', () => {
    const text = [
      'The BEST protein cinnamon rolls 🔥 #protein',
      'Macros per roll: 150 kcal, 12P, 25C, 2F',
      '',
      IG_SAMPLE,
      '',
      'Follow @fitfoodie for more!',
      'Save this recipe 🔖',
      'Comment ROLLS for the full recipe',
      '.',
      '.',
      '#protein #healthyrecipes #fyp',
    ].join('\n');
    const parsed = parseRecipeText(text);
    expect(parsed.name).toBe('The BEST protein cinnamon rolls 🔥');
    expect(parsed.source).toBe('@fitfoodie');
    expect(parsed.ingredients).toEqual(IG_INGREDIENTS);
    const list = steps(parsed.instructions);
    expect(list).toHaveLength(8);
    expect(list[7]).toMatch(/^8\. Spread/);
  });

  it('značky v tučném Unicode písmu', () => {
    const parsed = parseRecipeText('𝗜𝗻𝗴𝗿𝗲𝗱𝗶𝗲𝗻𝘁𝘀\n• 2 eggs\n• 1 cup milk\n\n𝗜𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀\n1. Whisk.\n2. Fry.');
    expect(parsed.name).toBe('');
    expect(parsed.ingredients).toEqual(['2 eggs', '1 cup milk']);
    expect(parsed.instructions).toBe('1. Whisk.\n2. Fry.');
  });

  it('postup před surovinami: každá sekce sahá do další značky', () => {
    const parsed = parseRecipeText('Instructions:\n1. Mix\n\nIngredients:\n- 2 eggs');
    expect(parsed.ingredients).toEqual(['2 eggs']);
    expect(parsed.instructions).toBe('1. Mix');
  });

  it('značka i obsah na jednom řádku', () => {
    const parsed = parseRecipeText('Pancakes\nIngredients: 90g flour, 85g yogurt\n2 eggs\nMethod: Mix and fry.');
    expect(parsed.name).toBe('Pancakes');
    expect(parsed.ingredients).toEqual(['90g flour, 85g yogurt', '2 eggs']);
    expect(parsed.instructions).toBe('Mix and fry.');
  });

  it('značka se závorkou nese porce', () => {
    expect(parseRecipeText('Buchty\nSuroviny (na 4 porce):\n- mouka').servings).toBe(4);
    expect(parseRecipeText('Ingredients (makes 8):\n- flour').servings).toBe(8);
  });

  it.each([
    ['Serves 4–6', 4],
    ['Makes 8 rolls', 8],
    ['Yield: 8', 8],
    ['4 servings', 4],
    ['Pro 4 osoby', 4],
  ])('porce z řádku metadat „%s" a řádek se neobjeví v surovinách', (line, expected) => {
    const parsed = parseRecipeText(`Rolls\n${line}\nIngredients:\n- flour\nInstructions:\n1. Bake.`);
    expect(parsed.servings).toBe(expected);
    expect(parsed.ingredients).toEqual(['flour']);
    expect(parsed.instructions).toBe('1. Bake.');
  });

  it.each(['Divide into 8 portions.', 'Rozkrojte na 8 porcí.'])(
    'číslo porcí v kroku postupu se nebere: %s',
    (step) => {
      const parsed = parseRecipeText(`Koláč\nSuroviny:\n- mouka\nPostup:\nUpéct.\n${step}`);
      expect(parsed.servings).toBeNull();
      expect(parsed.instructions).toBe(`Upéct.\n${step}`);
    },
  );

  it('doba: Total time má přednost před Prep time; Cook time nikam', () => {
    const parsed = parseRecipeText(
      'Rolls\nPrep time: 10 minutes\nCook time: 25 min\nTotal time: 35 minutes\nIngredients:\n- flour',
    );
    expect(parsed.prepMinutes).toBe(35);
    expect(parsed.ingredients).toEqual(['flour']);
  });

  it.each([
    ['Prep time: 10 minutes', 10],
    ['Prep: 1 hr 15 mins', 75],
    ['Doba přípravy: 20 min', 20],
  ])('doba z „%s"', (line, expected) => {
    expect(parseRecipeText(`Rolls\n${line}\nIngredients:\n- flour`).prepMinutes).toBe(expected);
  });

  it('nečitelná doba: klíč chybí a řádek není surovina', () => {
    const parsed = parseRecipeText('Rolls\nIngredients:\n- flour\nPrep time: a few minutes\nCook time: 25 min');
    expect(parsed).not.toHaveProperty('prepMinutes');
    expect(parsed.ingredients).toEqual(['flour']);
  });

  it('sekce Notes se do náhledu nedostane, „Tip:" s obsahem v postupu zůstane', () => {
    const parsed = parseRecipeText(
      'Ingredients:\n- flour\nInstructions:\n1. Bake.\nTip: use parchment.\n2. Cool.\nNotes:\nKeeps 3 days.',
    );
    expect(parsed.instructions).toBe('1. Bake.\nTip: use parchment.\n2. Cool.');
  });

  it('round-trip se sekcí ze sdílení: žádné „# #"', () => {
    const text = buildRecipeText({
      name: 'Buchty',
      ingredients: ['# Na těsto', '200 g mouky', '# Na náplň', 'tvaroh'],
      instructions: 'Upéct.',
    });
    expect(parseRecipeText(text).ingredients).toEqual(['# Na těsto', '200 g mouky', '# Na náplň', 'tvaroh']);
  });

  it('podsekce jako první řádek surovin', () => {
    const parsed = parseRecipeText('Ingredients:\nFor the dough:\n- 90g flour\nFor the icing:\n- 20g yogurt');
    expect(parsed.ingredients).toEqual(['# For the dough', '90g flour', '# For the icing', '20g yogurt']);
  });

  it('podsekce jen v surovinách: v postupu zůstane řádkem', () => {
    const parsed = parseRecipeText('Ingredients:\n- flour\nInstructions:\n1. Bake.\nFor the icing:\n2. Whisk.');
    expect(parsed.instructions).toBe('1. Bake.\nFor the icing:\n2. Whisk.');
  });

  it('číslovaný seznam surovin: číslo seznamu se odřízne', () => {
    const parsed = parseRecipeText('Suroviny:\n1. 90 g mouky\n2. 2 vejce\nPostup:\n1. Smíchat.');
    expect(parsed.ingredients).toEqual(['90 g mouky', '2 vejce']);
    expect(parsed.instructions).toBe('1. Smíchat.');
  });

  it('bez značek: dnešní heuristika, jen bez hashtagového řádku', () => {
    const text = 'Guláš\n- 500 g hovězího\n- 2 cibule\nOsmažit maso.\nPřidat cibuli.\n#gulas #food';
    expect(parseRecipeText(text)).toEqual({
      name: 'Guláš',
      servings: null,
      ingredients: ['500 g hovězího', '2 cibule'],
      instructions: 'Osmažit maso.\nPřidat cibuli.',
    });
  });

  it('bez značek: °F se v postupu doplní i tady', () => {
    const parsed = parseRecipeText('Cookies\n- 1 cup flour\n\nBake at 350F for 10 mins.');
    expect(parsed.instructions).toBe('Bake at 350F (175 °C) for 10 mins.');
  });

  it('jen značka postupu a v úvodu jen název: suroviny prázdné', () => {
    const parsed = parseRecipeText('Palačinky\n\nPostup:\nUsmažit.');
    expect(parsed.name).toBe('Palačinky');
    expect(parsed.ingredients).toEqual([]);
    expect(parsed.instructions).toBe('Usmažit.');
  });

  it('jen značka postupu: suroviny z úvodu podle heuristiky (i s odrážkami bez prázdného řádku)', () => {
    const parsed = parseRecipeText('Guláš\n- maso\n- cibule\nPostup: osmahneme');
    expect(parsed.name).toBe('Guláš');
    expect(parsed.ingredients).toEqual(['maso', 'cibule']);
    expect(parsed.instructions).toBe('osmahneme');
  });

  it('jen značka postupu: celý úvod po názvu jsou suroviny, i přes prázdné řádky, s podsekcemi', () => {
    const parsed = parseRecipeText('Buchty\nTěsto:\n200 g mouky\n1 vejce\n\nNáplň:\n250 g tvarohu\n\nPostup:\nUpéct.');
    expect(parsed.name).toBe('Buchty');
    expect(parsed.ingredients).toEqual(['# Těsto', '200 g mouky', '1 vejce', '# Náplň', '250 g tvarohu']);
    expect(parsed.instructions).toBe('Upéct.');
  });

  it('jen značka postupu a úvod začíná podsekcí: název prázdný, podsekce v surovinách', () => {
    const parsed = parseRecipeText('Dough:\n* 90g flour\n\nIcing:\n* 2 tbsp cream cheese\n\nInstructions:\n1. Mix.');
    expect(parsed.name).toBe('');
    expect(parsed.ingredients).toEqual(['# Dough', '90g flour', '# Icing', '2 tbsp cream cheese']);
  });

  it('bez značek: „Poznámka:" a prázdný řádek – text poznámky za ním do postupu nespadne', () => {
    const parsed = parseRecipeText('Guláš\n- maso\n\nOsmahneme.\n\nPoznámka:\n\nNejlepší druhý den.');
    expect(parsed.instructions).toBe('Osmahneme.');
  });

  it('bez značek: poznámka uprostřed vyřízne jen svůj blok', () => {
    const parsed = parseRecipeText('Guláš\n- maso\n\nTip:\nLepší druhý den.\n\nOsmahneme.');
    expect(parsed.ingredients).toEqual(['maso']);
    expect(parsed.instructions).toBe('Osmahneme.');
  });

  it('se značkou surovin se úvod dál nebere jako suroviny (jen název)', () => {
    const parsed = parseRecipeText('Rolls 🔥\nSo easy and tasty!\n\nIngredients:\n- flour');
    expect(parsed.name).toBe('Rolls 🔥');
    expect(parsed.ingredients).toEqual(['flour']);
  });

  it('bez značek surovin/postupu: „Poznámka:" jen utne poznámku, zbytek jako dnes', () => {
    const parsed = parseRecipeText(
      'Guláš\n- 500 g masa\n- 2 cibule\n\nOsmahneme cibuli.\n\nPoznámka:\nNejlepší druhý den.',
    );
    expect(parsed.name).toBe('Guláš');
    expect(parsed.ingredients).toEqual(['500 g masa', '2 cibule']);
    expect(parsed.instructions).toBe('Osmahneme cibuli.');
  });

  it('řádek doby v sekci postupu zůstane krokem (doba se i tak přečte)', () => {
    const parsed = parseRecipeText('Ingredients:\n- flour\nInstructions:\n1. Mix.\nPrep time: 10 min\n2. Bake.');
    expect(parsed.instructions).toBe('1. Mix.\nPrep time: 10 min\n2. Bake.');
    expect(parsed.prepMinutes).toBe(10);
  });

  it('jen značka surovin: vše pod ní jsou suroviny, postup prázdný', () => {
    const parsed = parseRecipeText('Ingredients:\n- flour\n- milk');
    expect(parsed.ingredients).toEqual(['flour', 'milk']);
    expect(parsed.instructions).toBeNull();
  });
});

describe('isBareUrl', () => {
  it.each(['https://www.instagram.com/p/abc/', '  www.x.cz  ', 'https://www.instagram.com/reel/xyz/?igsh=abc\n'])(
    'ano: %j',
    (text) => {
      expect(isBareUrl(text)).toBe(true);
    },
  );

  it.each(['Recept z https://x.cz\n- mouka', 'Bramborák', '', '1.5 kg'])('ne: %j', (text) => {
    expect(isBareUrl(text)).toBe(false);
  });
});
