import { splitLeadingAmount } from '../../lib/amountSplit';

/**
 * Řádek suroviny jako v navažovacím seznamu: množství tučně ve vlastním sloupci zarovnané
 * pod sebou, název vedle. Jen zobrazení – text suroviny se nemění (pravidlo 2); řádek bez
 * čísla na začátku se ukáže celý ve sloupci názvu. Sdílí ho detail receptu i vaření.
 */
export default function IngredientLine({ text, column }: { text: string; column: boolean }) {
  if (!column) return <span>{text}</span>;
  const split = splitLeadingAmount(text);
  return (
    <span className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3">
      {split ? (
        <>
          <span className="text-right font-bold tabular-nums">{split.amount}</span>
          <span>{split.name}</span>
        </>
      ) : (
        <span className="col-start-2">{text}</span>
      )}
    </span>
  );
}
