/**
 * Sekce surovin (UC023): řádek surovin začínající `# ` je nadpis skupiny
 * („# Na těsto", „# Na náplň"). Konvence je opt-in a aditivní — `raw_text` zůstává
 * zdroj pravdy (pravidlo 1, 2), nadpis je doslova to, co uživatel napsal. Nadpisy se
 * jen jinak vykreslí a vynechají z kalorií i nákupu; do modelu nic nepřibývá.
 */
const HEADING_RE = /^#\s+(.+)$/;

/** Je řádek nadpisem sekce? (`# ` + neprázdný text) */
export function isIngredientHeading(rawText: string): boolean {
  return HEADING_RE.test(rawText.trim());
}

/** Text nadpisu bez značky `# ` (pro zobrazení). U nenadpisu vrátí původní text. */
export function ingredientHeadingLabel(rawText: string): string {
  const match = rawText.trim().match(HEADING_RE);
  return match ? match[1].trim() : rawText.trim();
}
