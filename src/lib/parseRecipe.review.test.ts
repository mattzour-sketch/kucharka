import { describe, expect, it } from 'vitest';
import { isBareUrl, parseRecipeText } from './parseRecipe';
import { addCelsiusToFahrenheit } from './temperature';

/**
 * Review UC031 – hrany parseru. Druhý blok = chyby nalezené v review (kolo 1), po opravě
 * běží jako běžné testy správného chování.
 */

describe('UC031 review – hrany, které fungují', () => {
  it('Windows \\r\\n: sekce, podsekce i °C jako s \\n', () => {
    const parsed = parseRecipeText(
      'Ingredients:\r\n* 1 egg\r\n\r\nFor the icing:\r\n* 2 tbsp cheese\r\n\r\nInstructions:\r\n1. Bake at 350°F.\r\n',
    );
    expect(parsed.ingredients).toEqual(['1 egg', '# For the icing', '2 tbsp cheese']);
    expect(parsed.instructions).toBe('1. Bake at 350°F (175 °C).');
  });

  it('suroviny začínající číslem: množství se neodřízne jako číslo seznamu', () => {
    expect(parseRecipeText('Ingredients:\n1 egg\n2 cups flour\n3 tbsp sugar').ingredients).toEqual([
      '1 egg',
      '2 cups flour',
      '3 tbsp sugar',
    ]);
    expect(parseRecipeText('Suroviny:\n1.5 kg brambor\n2 vejce').ingredients).toEqual(['1.5 kg brambor', '2 vejce']);
    // Číslo seznamu + množství: odřízne se jen číslo seznamu.
    expect(parseRecipeText('Ingredients:\n1. 2 eggs\n2. 3 tbsp sugar').ingredients).toEqual([
      '2 eggs',
      '3 tbsp sugar',
    ]);
  });

  it('„#" v textu suroviny není hashtagový řádek ani nadpis', () => {
    expect(parseRecipeText('Ingredients:\n#10 can tomatoes\n- salt #optional').ingredients).toEqual([
      '#10 can tomatoes',
      'salt #optional',
    ]);
  });

  it('„Prep:" bez délky není značka postupu, „Příprava:" ano', () => {
    const en = parseRecipeText('Ingredients:\n- flour\nPrep:\n- onions\nInstructions:\n1. Mix.');
    expect(en.instructions).toBe('1. Mix.');
    expect(en.ingredients).toContain('onions');
    const cz = parseRecipeText('Buchty\nSuroviny:\n- mouka\nPříprava:\nSmíchat.');
    expect(cz.ingredients).toEqual(['mouka']);
    expect(cz.instructions).toBe('Smíchat.');
  });

  it('prázdný vstup a jen mezery', () => {
    for (const text of ['', '   \n\t\n']) {
      expect(parseRecipeText(text)).toEqual({ name: '', servings: null, ingredients: [], instructions: null });
    }
  });

  it('jen URL pozná UI (isBareUrl); s textem kolem to URL není', () => {
    expect(isBareUrl('https://www.instagram.com/p/abc/\r\n')).toBe(true);
    expect(isBareUrl('instagram.com/p/abc')).toBe(true);
    expect(isBareUrl('Palačinky https://x.cz')).toBe(false);
  });

  it('velmi dlouhý text (10 000 řádků) se rozebere rychle a nic neztratí', () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `* ${i + 1} g flour ${'x'.repeat(50)}`);
    const steps = Array.from({ length: 5000 }, (_, i) => `${i + 1}. Step ${'y'.repeat(50)}`);
    const start = performance.now();
    const parsed = parseRecipeText(`Ingredients:\n${lines.join('\n')}\nInstructions:\n${steps.join('\n')}`);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(parsed.ingredients).toHaveLength(5000);
    expect(parsed.instructions?.split('\n')).toHaveLength(5000);
  });

  it.each(['Bake 12 minutes.', 'Add 350 g flour.', 'Cut into 100 pieces.', 'Step 2F', 'Set to 250 Fan', 'Pečeme na 180 °C.'])(
    '°F: bez stupňů Fahrenheita se nic nedoplní – %s',
    (text) => {
      expect(addCelsiusToFahrenheit(text)).toBe(text);
    },
  );
});

describe('UC031 review – nalezené chyby (opravené)', () => {
  // 🔴 Suroviny před samotnou značkou postupu zmizí z náhledu (starý parser je bral).
  it('suroviny bez značky + „Postup:" → suroviny zůstanou', () => {
    const parsed = parseRecipeText('Bábovka\n200 g mouky\n3 vejce\n\nPostup:\nVše smícháme a pečeme.');
    expect(parsed.ingredients).toEqual(['200 g mouky', '3 vejce']);
  });

  it('IG bez „Ingredients:" jen s „Instructions:" → suroviny zůstanou', () => {
    const parsed = parseRecipeText('Protein rolls\n\n* 90g flour\n* 1 tsp salt\n\nInstructions:\n1. Mix.\n2. Bake.');
    expect(parsed.ingredients).toEqual(['90g flour', '1 tsp salt']);
  });

  // 🔴 Jediná značka „Poznámka:" na konci českého receptu bez značek smaže suroviny i postup.
  it('recept bez značek s „Poznámka:" na konci → suroviny i postup zůstanou', () => {
    const parsed = parseRecipeText(
      'Guláš\n- 500 g masa\n- 2 cibule\n\nOsmahneme cibuli, přidáme maso.\n\nPoznámka:\nNejlepší druhý den.',
    );
    expect(parsed.ingredients).toEqual(['500 g masa', '2 cibule']);
    expect(parsed.instructions).toContain('Osmahneme cibuli');
  });

  // 🟡 Suroviny s proteinem / kaloriemi se berou jako makra autora a zmizí.
  it('„Protein 30 g" a suroviny s „(110 cal)" zůstanou surovinami', () => {
    const parsed = parseRecipeText(
      'Suroviny:\n- Protein 30 g\n- 30g vanilla protein powder (110 cal)\n- 100 g low-fat tvaroh (80 kcal)\nPostup:\nSmíchat.',
    );
    expect(parsed.ingredients).toHaveLength(3);
  });

  // 🟡 Věta postupu začínající „Doba pečení" / „Příprava: 15 min …" zmizí (cook time se nikam neukládá).
  it('krok „Doba pečení cca 40 minut, dokud nezezlátne." zůstane v postupu', () => {
    const parsed = parseRecipeText('Bábovka\nSuroviny:\n- mouka\nPostup:\nSmíchat.\nDoba pečení cca 40 minut, dokud nezezlátne.');
    expect(parsed.instructions).toContain('dokud nezezlátne');
  });

  it('krok „Příprava: 15 min pečeme na 180 °C" zůstane v postupu', () => {
    const parsed = parseRecipeText('Bábovka\nSuroviny:\n- mouka\nPostup:\nPříprava: 15 min pečeme na 180 °C\nVychladit.');
    expect(parsed.instructions).toContain('pečeme na 180 °C');
  });

  // 🟡 Spec (okrajové případy): teplota už v obou jednotkách → nic se nedoplňuje. °C první nefunguje.
  it('„180°C (350°F)" se nezmění', () => {
    expect(addCelsiusToFahrenheit('Preheat oven to 180°C (350°F).')).toBe('Preheat oven to 180°C (350°F).');
  });
});

/**
 * Review kolo 2 – regrese po opravě (odchylka a): text za prázdným řádkem v úvodu bez značky
 * surovin z náhledu mizel. Po opravě běží jako běžné testy správného chování.
 */
describe('UC031 review kolo 2 – úvod bez značky surovin (opravené)', () => {
  // 🔴 Český recept se sekcemi surovin bez „Suroviny:" – náplň zmizí (HEAD ji aspoň nechal v postupu).
  it('„Těsto: … / Náplň: …" + „Postup:" → náplň zůstane v surovinách', () => {
    const parsed = parseRecipeText('Buchty\nTěsto:\n200 g mouky\n1 vejce\n\nNáplň:\n250 g tvarohu\n\nPostup:\nUpéct.');
    expect(parsed.ingredients).toContain('250 g tvarohu');
  });

  // 🔴 IG: marketingová věta + prázdný řádek + odrážky + „Instructions:" → suroviny zmizí,
  //    surovinou se stane marketing.
  it('IG úvod s marketingem: suroviny s odrážkami zůstanou', () => {
    const parsed = parseRecipeText(
      'The BEST rolls 🔥\nOnly 150 kcal each!\n\n* 90g flour\n* 1 tsp salt\n\nInstructions:\n1. Mix.',
    );
    expect(parsed.ingredients).toEqual(expect.arrayContaining(['90g flour', '1 tsp salt']));
  });

  it('IG „Dough:/Icing:" bez „Ingredients:" → poleva zůstane', () => {
    const parsed = parseRecipeText(
      'Cinnamon rolls\n\nDough:\n* 90g flour\n\nIcing:\n* 2 tbsp cream cheese\n\nInstructions:\n1. Mix.',
    );
    expect(parsed.ingredients).toContain('2 tbsp cream cheese');
  });

  it('suroviny oddělené prázdnými řádky → žádná nezmizí', () => {
    expect(parseRecipeText('Buchty\n\n200 g mouky\n\n1 vejce\n\nPostup:\nUpéct.').ingredients).toEqual([
      '200 g mouky',
      '1 vejce',
    ]);
  });

  // 🟡 „Poznámka:" na začátku textu bez značek utne celý recept.
  it('„Poznámka:" jako první řádek nesmaže celý recept', () => {
    const parsed = parseRecipeText('Poznámka:\nod babičky\nBábovka\n- mouka\n\nUpéct.');
    expect(parsed.ingredients).toContain('mouka');
    expect(parsed.instructions).toBe('Upéct.');
  });
});

/**
 * Review kolo 3 – zbývající výhrada: blok „ostatní" (Poznámka/Tip/Notes/Equipment/Nutrition)
 * PŘED surovinami bez značky surovin je spolkne. `it.fails` = správné chování, dnes padá.
 */
describe('UC031 review kolo 3 – „ostatní" blok před surovinami (it.fails)', () => {
  it.fails('se značkou postupu: „Equipment:" před odrážkami surovin je nespolkne', () => {
    const parsed = parseRecipeText('Protein rolls\nEquipment:\n- muffin tin\n\n* 90g flour\n\nMethod:\n1. Mix.');
    expect(parsed.ingredients).toContain('90g flour');
  });

  it.fails('se značkou postupu: „Nutrition (per roll):" před odrážkami surovin je nespolkne', () => {
    const parsed = parseRecipeText(
      'Protein rolls\nNutrition (per roll):\n150 kcal | 12g protein\n\n* 90g flour\n\nInstructions:\n1. Mix.',
    );
    expect(parsed.ingredients).toContain('90g flour');
  });

  it.fails('bez značek: „Poznámka:" hned pod názvem nespolkne suroviny', () => {
    const parsed = parseRecipeText('Guláš\nPoznámka:\nbabiččin recept\n- maso\n- cibule\n\nOsmahneme.');
    expect(parsed.ingredients).toEqual(expect.arrayContaining(['maso', 'cibule']));
  });
});
