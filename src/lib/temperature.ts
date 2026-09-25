/**
 * Teplota v textu postupu (UC031, Rozhodnutí 3). Údaj ve °F se v textu NEPŘEPISUJE,
 * jen se za něj doplní přepočet „ (190 °C)" — viditelně a upravitelně v náhledu.
 * Zaokrouhlení na 5 °C je vědomé rozhodnutí uživatele (text, ne hodnota datové vrstvy).
 * Čistá logika.
 */

/** (F − 32) × 5/9, zaokrouhleno na 5 °C: 375 → 190, 350 → 175, 400 → 205. */
export function fahrenheitToCelsius5(fahrenheit: number): number {
  const celsius = ((fahrenheit - 32) * 5) / 9;
  return Math.round(celsius / 5) * 5;
}

// Číslo (2–3 cifry, volitelně rozsah „350–375") + jednotka °F v běžných zápisech.
// Pořadí alternací: delší tvary dřív; holé „F" jen jako poslední možnost.
const FAHRENHEIT_RE =
  /(?<![\d.,])(\d{2,3})(?:\s*[–-]\s*(\d{2,3}))?(?:\s*[°º˚]\s*F(?:ahrenheit)?|\s*[Dd]egrees?\s+F(?:ahrenheit)?|\s*Fahrenheit|\s?F)(?![A-Za-z])/g;

// Hned za °F už je údaj v °C („375°F (190°C)", „375°F / 190°C", „375°F – 190°C") → nic nedoplňovat.
const CELSIUS_FOLLOWS_RE =
  /^\s*[(/,–-]?\s*(?:or\s+)?\d{2,3}(?:\s*[–-]\s*\d{2,3})?\s*(?:[°º˚]\s*)?C(?![A-Za-z])/;
// Hned před °F je údaj v °C („180°C (350°F)", „180 °C / 350 °F", „180C/350F") → nic nedoplňovat.
const CELSIUS_PRECEDES_RE = /\d{2,3}\s*(?:[°º˚]\s*)?C\s*[(/,–-]?\s*(?:or\s+)?$/;

const BARE_MIN = 100;
const BARE_MAX = 600;

/**
 * Za každý údaj ve °F doplní „ (NNN °C)". Chytá „375°F", „375 °F", „375ºF", „350F",
 * „350 degrees F", „… Fahrenheit" i rozsah „350–375°F" → „ (175–190 °C)". Holé „350F"
 * bez stupně jen v rozsahu 100–600 (ne „Step 2F"). °C se nemění. Idempotentní.
 */
export function addCelsiusToFahrenheit(text: string): string {
  return text.replace(
    FAHRENHEIT_RE,
    (whole: string, low: string, high: string | undefined, offset: number, full: string) => {
      const rest = full.slice(offset + whole.length);
      const before = full.slice(Math.max(0, offset - 20), offset);
      if (CELSIUS_FOLLOWS_RE.test(rest) || CELSIUS_PRECEDES_RE.test(before)) return whole;

      const lowF = Number(low);
      const highF = high !== undefined ? Number(high) : null;
      const bare = !/[°º˚]|egree|ahrenheit/.test(whole);
      if (bare && (lowF < BARE_MIN || lowF > BARE_MAX)) return whole;

      const celsius =
        highF !== null
          ? `${fahrenheitToCelsius5(lowF)}–${fahrenheitToCelsius5(highF)}`
          : `${fahrenheitToCelsius5(lowF)}`;
      return `${whole} (${celsius} °C)`;
    },
  );
}
