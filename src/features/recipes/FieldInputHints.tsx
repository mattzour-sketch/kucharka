import { parsePrepInput, parseServingsInput } from '../../lib/fieldInput';

/** „Nerozumím" pod poli Doba a Porcí – hned, ne až po uložení prázdné hodnoty. */
export default function FieldInputHints({ prep, servings }: { prep: string; servings: string }) {
  const lines: string[] = [];
  if (parsePrepInput(prep) === 'invalid') lines.push(`Doba: nerozumím „${prep.trim()}", napiš minuty (např. 90).`);
  if (parseServingsInput(servings) === 'invalid') {
    lines.push(`Porce: nerozumím „${servings.trim()}", napiš jedno číslo.`);
  }
  if (lines.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5 text-sm text-amber-700 dark:text-amber-300">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
