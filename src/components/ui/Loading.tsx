import { cx } from './cx';

/** Neutrální placeholder během načítání. `motion-reduce` utlumí puls. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-md bg-stone-200/70 motion-reduce:animate-none', className)}
      aria-hidden
    />
  );
}

/** Mřížka karet (Recepty, Hledat). */
export function RecipeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Svislý seznam řádků (Nákup, Potraviny, Koš, FoodPicker). */
export function RowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="rounded-2xl border border-stone-200 bg-white p-3">
          <Skeleton className="h-4 w-1/2" />
        </li>
      ))}
    </ul>
  );
}

/** Čtení/formulář (Detail, Vařit, Kalorie, Statistiky). */
export function ReadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
