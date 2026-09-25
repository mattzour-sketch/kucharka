import { describe, expect, it } from 'vitest';
import { addCelsiusToFahrenheit, fahrenheitToCelsius5 } from './temperature';

describe('fahrenheitToCelsius5', () => {
  it('zaokrouhlí na 5 °C', () => {
    expect(fahrenheitToCelsius5(375)).toBe(190);
    expect(fahrenheitToCelsius5(350)).toBe(175);
    expect(fahrenheitToCelsius5(400)).toBe(205);
    expect(fahrenheitToCelsius5(425)).toBe(220);
  });
});

describe('addCelsiusToFahrenheit', () => {
  it('doplní °C za °F a originál nechá', () => {
    expect(addCelsiusToFahrenheit('Bake at 375°F for 12–15 minutes.')).toBe(
      'Bake at 375°F (190 °C) for 12–15 minutes.',
    );
  });

  it.each([
    ['Preheat to 350F.', 'Preheat to 350F (175 °C).'],
    ['Preheat to 350 °F.', 'Preheat to 350 °F (175 °C).'],
    ['Preheat to 350 degrees F.', 'Preheat to 350 degrees F (175 °C).'],
    ['Preheat to 350ºF.', 'Preheat to 350ºF (175 °C).'],
    ['Oven at 350 degrees Fahrenheit', 'Oven at 350 degrees Fahrenheit (175 °C)'],
    ['Bake at 400°F', 'Bake at 400°F (205 °C)'],
    ['Bake at 350–375°F', 'Bake at 350–375°F (175–190 °C)'],
  ])('%s', (input, expected) => {
    expect(addCelsiusToFahrenheit(input)).toBe(expected);
  });

  it('víc údajů v jednom textu', () => {
    expect(addCelsiusToFahrenheit('Start at 425°F, then lower to 350°F.')).toBe(
      'Start at 425°F (220 °C), then lower to 350°F (175 °C).',
    );
  });

  it.each([
    '375°F (190°C)',
    '375°F / 190°C',
    '375°F (190 °C)',
    '375°F – 190°C',
    '375°F - 190 °C',
    'Preheat oven to 180°C (350°F).',
    'Preheat oven to 180 °C / 350 °F.',
    '180C/350F',
    'Péct na 200 °C',
    '180C fan',
    'Step 2F',
    'Use 2 Flour tortillas',
    '12 F',
  ])('beze změny: %s', (input) => {
    expect(addCelsiusToFahrenheit(input)).toBe(input);
  });

  it('je idempotentní (druhé rozebrání nic nezdvojí)', () => {
    const once = addCelsiusToFahrenheit('Bake at 375°F.');
    expect(addCelsiusToFahrenheit(once)).toBe(once);
  });
});
