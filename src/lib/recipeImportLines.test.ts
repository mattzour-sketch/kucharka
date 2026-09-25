import { describe, expect, it } from 'vitest';
import {
  extractAuthorHandle,
  isHashtagLine,
  isMetaLine,
  isPromoLine,
  matchSectionMarker,
  normalizeMarkerText,
  parseServingsLine,
  parseTimeLine,
  stripLeadingBullet,
  stripListNumbers,
  toSubsectionHeading,
} from './recipeImportLines';

describe('normalizeMarkerText', () => {
  it('tučné Unicode písmo, diakritika, emoji a apostrof', () => {
    expect(normalizeMarkerText('𝗜𝗻𝗴𝗿𝗲𝗱𝗶𝗲𝗻𝘁𝘀:')).toBe('ingredients:');
    expect(normalizeMarkerText('𝘐𝘯𝘴𝘵𝘳𝘶𝘤𝘵𝘪𝘰𝘯𝘴')).toBe('instructions');
    expect(normalizeMarkerText('  🥣 Příprava 👇 ')).toBe('priprava');
    expect(normalizeMarkerText('You’ll need')).toBe("you'll need");
  });
});

describe('matchSectionMarker', () => {
  it.each([
    'Ingredients',
    'INGREDIENTS:',
    'Ingredient:',
    '🥣 Ingredients:',
    'Ingredients 👇',
    '* Ingredients:',
    '**Ingredients**',
    'Ingredient list',
    'What you need:',
    'What you’ll need:',
    'You’ll need',
    'Suroviny',
    'Ingredience:',
    'Potřebujeme:',
    'Budete potřebovat',
    '𝗜𝗻𝗴𝗿𝗲𝗱𝗶𝗲𝗻𝘁𝘀',
  ])('suroviny: %s', (line) => {
    expect(matchSectionMarker(line)).toMatchObject({ section: 'ingredients', inline: '' });
  });

  it.each([
    'Instructions',
    'Instructions:',
    'Directions:',
    '👩‍🍳 Method',
    'Steps',
    'How to make',
    'How to make it:',
    'Preparation',
    'Postup',
    'Příprava:',
    'Instrukce',
    'Návod',
    'Jak na to:',
    '𝗜𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀:',
  ])('postup: %s', (line) => {
    expect(matchSectionMarker(line)).toMatchObject({ section: 'instructions', inline: '' });
  });

  it.each(['Notes:', 'Tips', 'Poznámky:', 'Equipment:', 'Nutrition info:'])('ostatní: %s', (line) => {
    expect(matchSectionMarker(line)).toMatchObject({ section: 'other', inline: '' });
  });

  it.each([
    'Mix the ingredients well.',
    'Ingredients for the sauce:',
    'Tip: use parchment paper',
    'Notes: can be frozen',
    'Postupně přilévat mléko.',
    '',
  ])('není značka: %s', (line) => {
    expect(matchSectionMarker(line)).toBeNull();
  });

  it('značka s obsahem na stejném řádku (obsah v původním znění)', () => {
    expect(matchSectionMarker('Ingredients: 90g flour, 85g yogurt')).toEqual({
      section: 'ingredients',
      inline: '90g flour, 85g yogurt',
    });
    expect(matchSectionMarker('Method: Mix everything.')).toEqual({
      section: 'instructions',
      inline: 'Mix everything.',
    });
  });

  it('doplněk v závorce nese počet porcí', () => {
    expect(matchSectionMarker('Ingredients (makes 8):')).toEqual({
      section: 'ingredients',
      inline: '',
      servings: 8,
    });
    expect(matchSectionMarker('Suroviny (na 4 porce):')).toEqual({
      section: 'ingredients',
      inline: '',
      servings: 4,
    });
    expect(matchSectionMarker('Ingredients (US):')).toEqual({ section: 'ingredients', inline: '' });
  });

  it('číslo v závorce bez slova porcí porce nenese', () => {
    expect(matchSectionMarker('Suroviny (na formu 24 cm):')).toEqual({ section: 'ingredients', inline: '' });
    expect(matchSectionMarker('Ingredients (for a 9x13 pan):')).toEqual({ section: 'ingredients', inline: '' });
    expect(matchSectionMarker('Suroviny (pro 4 osoby):')).toMatchObject({ servings: 4 });
    expect(matchSectionMarker('Ingredients (serves 6):')).toMatchObject({ servings: 6 });
  });
});

describe('isHashtagLine', () => {
  it.each(['#vegan #protein', '#fyp', '  #healthyrecipes  #cinnamonrolls #výživa '])('ano: %s', (line) => {
    expect(isHashtagLine(line)).toBe(true);
  });

  it.each(['# Na těsto', 'Enjoy! #yum', '#', '200 g mouky'])('ne: %s', (line) => {
    expect(isHashtagLine(line)).toBe(false);
  });
});

describe('isPromoLine', () => {
  it.each([
    'Follow @fitfoodie for more!',
    'Follow for more easy recipes',
    'Save this recipe for later 🔖',
    'Save this!',
    '📌 Save this post',
    'Comment ROLLS for the full recipe',
    'Comment “recipe” and I’ll send it to you',
    'Full recipe: link in bio',
    'Link in bio',
    '@fitfoodie',
    'Recipe by @chef.anna',
    'Tag a friend who needs this',
    'Share this with someone',
  ])('ano: %s', (line) => {
    expect(isPromoLine(line)).toBe(true);
  });

  it.each([
    '3. Save the rest of the icing for later.',
    'Save 2 tbsp for garnish',
    'Save the rest for later',
    '1 scoop @myprotein whey',
    'Step 4: Follow the same steps with the icing.',
    '1️⃣ Save this dough overnight.',
    'Mix the ingredients well.',
  ])('ne: %s', (line) => {
    expect(isPromoLine(line)).toBe(false);
  });
});

describe('extractAuthorHandle', () => {
  it('jen z výzvy / creditu', () => {
    expect(extractAuthorHandle('Follow @fitfoodie for more!')).toBe('@fitfoodie');
    expect(extractAuthorHandle('Recipe by @chef.anna.')).toBe('@chef.anna');
    expect(extractAuthorHandle('@fit_food')).toBe('@fit_food');
    expect(extractAuthorHandle('1 scoop @myprotein whey')).toBeUndefined();
    expect(extractAuthorHandle('Save this recipe')).toBeUndefined();
  });
});

describe('parseServingsLine', () => {
  it.each([
    ['Serves 4', 4],
    ['Servings: 4', 4],
    ['Serves 4–6', 4],
    ['Makes 8', 8],
    ['Makes 8 rolls', 8],
    ['Yield: 8', 8],
    ['4 servings', 4],
    ['Porce: 4', 4],
    ['Porce: 6 (přepočteno z 4)', 6],
    ['Pro 4 osoby', 4],
    ['Na 4 porce', 4],
    ['🍽 Serves: 2', 2],
  ])('%s → %i', (line, expected) => {
    expect(parseServingsLine(line)).toBe(expected);
  });

  it.each([
    'Divide into 8 portions',
    'Rozkrojte na 8 porcí a podávejte teplé s kopečkem zakysané smetany.',
    '4. Makes 8 rolls',
    'Makes the dough softer',
    '8 rolls',
  ])('není řádek porcí: %s', (line) => {
    expect(parseServingsLine(line)).toBeUndefined();
  });
});

describe('parseTimeLine', () => {
  it.each([
    ['Prep time: 10 minutes', [{ kind: 'prep', minutes: 10 }]],
    ['Prep: 1 hr 15 mins', [{ kind: 'prep', minutes: 75 }]],
    ['Doba přípravy: 20 min', [{ kind: 'prep', minutes: 20 }]],
    ['Příprava: 20 min', [{ kind: 'prep', minutes: 20 }]],
    ['Cook time: 25 min', [{ kind: 'cook', minutes: 25 }]],
    ['Total time: 35 minutes', [{ kind: 'total', minutes: 35 }]],
    ['Prep time: a few minutes', [{ kind: 'prep', minutes: null }]],
    [
      '⏱ Prep: 10 min | Cook: 25 min | Total: 35 min',
      [
        { kind: 'prep', minutes: 10 },
        { kind: 'cook', minutes: 25 },
        { kind: 'total', minutes: 35 },
      ],
    ],
  ])('%s', (line, expected) => {
    expect(parseTimeLine(line)).toEqual(expected);
  });

  it('rozsah a „cca" před délkou pořád čistý údaj doby', () => {
    expect(parseTimeLine('Prep: 10–15 min')).toEqual([{ kind: 'prep', minutes: 15 }]);
    expect(parseTimeLine('Doba přípravy: cca 20 min')).toEqual([{ kind: 'prep', minutes: 20 }]);
  });

  it.each([
    'Příprava:',
    'Preparation',
    'Preparation: Mix 5 minutes then bake',
    'Bake 20 min',
    'Doba pečení cca 40 minut, dokud nezezlátne.',
    'Příprava: 15 min pečeme na 180 °C',
    'Doba pečení: podle trouby, dokud nezezlátne',
  ])(
    'není řádek doby: %s',
    (line) => {
      expect(parseTimeLine(line)).toBeNull();
    },
  );
});

describe('isMetaLine', () => {
  it.each([
    'Macros per roll: 150 kcal, 12P, 25C, 2F',
    'Nutrition (per serving): 320 kcal',
    'Calories: 150',
    '150 kcal | 12g protein | 25g carbs | 2g fat',
    'Protein: 12g',
    'Makra na porci: 300 kcal',
  ])('ano: %s', (line) => {
    expect(isMetaLine(line)).toBe(true);
  });

  it.each([
    '90g all-purpose flour',
    '1 scoop protein powder',
    'Mix the protein powder with milk.',
    'Protein powder: 30g',
    'Sugar: 2 tbsp',
    '3. Bake for 150 minutes',
    '- Protein 30 g',
    '- 30g vanilla protein powder (110 cal)',
    '- 100 g low-fat tvaroh (80 kcal)',
    '200 g low-fat yogurt, 12 g protein',
  ])(
    'ne: %s',
    (line) => {
      expect(isMetaLine(line)).toBe(false);
    },
  );
});

describe('stripLeadingBullet', () => {
  it.each([
    ['* 90g flour', '90g flour'],
    ['- 2 vejce', '2 vejce'],
    ['• sůl', 'sůl'],
    ['· pepř', 'pepř'],
    ['— cukr', 'cukr'],
    ['▪️ 1 tsp salt', '1 tsp salt'],
    ['✅ 2 eggs', '2 eggs'],
    ['🔸 1 cup milk', '1 cup milk'],
    ['▢ 200 g sugar', '200 g sugar'],
    ['☐ 1 onion', '1 onion'],
    ['  -   2 cibule  ', '2 cibule'],
    ['- # Na těsto', '# Na těsto'],
  ])('%s → %s', (input, expected) => {
    expect(stripLeadingBullet(input)).toBe(expected);
  });

  it('„.5 cup" si tečku nechá (jinak by bylo 10× víc)', () => {
    expect(stripLeadingBullet('.5 cup milk')).toBe('.5 cup milk');
    expect(stripLeadingBullet('- .5 cup milk')).toBe('.5 cup milk');
    expect(stripLeadingBullet('- ,5 l mléka')).toBe(',5 l mléka');
  });

  it.each(['# Na těsto', '~200 g mouky', '(optional) salt', '½ cup milk', '1️⃣ Mix', '50 g butter 🧈', '„domácí" vajíčka'])(
    'beze změny: %s',
    (input) => {
      expect(stripLeadingBullet(input)).toBe(input);
    },
  );
});

describe('stripListNumbers', () => {
  it('odřízne číslování seznamu 1, 2, 3…', () => {
    expect(stripListNumbers(['1. 90 g mouky', '2. 2 vejce', '3) špetka soli'])).toEqual([
      '90 g mouky',
      '2 vejce',
      'špetka soli',
    ]);
  });

  it('číslování smí po nadpisu sekce začít znovu', () => {
    expect(stripListNumbers(['1. 90 g mouky', '2. 2 vejce', '# Na polevu', '1. 30 g cukru'])).toEqual([
      '90 g mouky',
      '2 vejce',
      '# Na polevu',
      '30 g cukru',
    ]);
  });

  it.each([[['1.5 kg brambor']], [['3. vejce', '7. mouka']], [['1. 90 g mouky', 'sůl']]])(
    'beze změny: %j',
    (lines) => {
      expect(stripListNumbers(lines)).toEqual(lines);
    },
  );
});

describe('toSubsectionHeading', () => {
  it.each([
    ['For the icing:', '# For the icing'],
    ['Na polevu:', '# Na polevu'],
    ['Dough:', '# Dough'],
    ['Ingredients for the sauce:', '# Ingredients for the sauce'],
  ])('%s → %s', (input, expected) => {
    expect(toSubsectionHeading(input)).toBe(expected);
  });

  it.each(['2 eggs:', 'FOR THE ICING', '# Na těsto', '# Na těsto:', '½ cup:', '90g flour', ':'])(
    'beze změny: %s',
    (input) => {
      expect(toSubsectionHeading(input)).toBe(input);
    },
  );

  it('příliš dlouhý řádek s dvojtečkou nadpisem není', () => {
    const long = `${'Mix together flour and yogurt and the rest of the stuff '.repeat(2)}:`;
    expect(toSubsectionHeading(long)).toBe(long);
  });
});
