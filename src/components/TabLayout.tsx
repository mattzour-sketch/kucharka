import { NavLink, Outlet } from 'react-router-dom';
import { useBackupReminder } from '../features/backup/useBackupReminder';
import Icon, { type IconName } from './ui/Icon';
import { cx } from './ui/cx';

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Recepty', icon: 'book' },
  { to: '/potraviny', label: 'Potraviny', icon: 'apple' },
  { to: '/vic', label: 'Víc', icon: 'menu' },
];

/** Cesty obrazovek se spodní lištou (lišta časovačů nad ní sedí výš). */
export const TAB_PATHS = tabs.map((tab) => tab.to);

/** Layout se spodní navigační lištou (SPEC 6.1). */
export default function TabLayout() {
  const backupDue = useBackupReminder().due;

  return (
    <div className="min-h-dvh pb-16">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                cx(
                  'group flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-1.5 text-[11px] font-semibold transition focus-visible:outline-none',
                  isActive
                    ? 'text-brand dark:text-brand-light'
                    : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Aktivní záložka = tónovaná pilulka pod ikonou; barva textu sama nestačí. */}
                  <span
                    className={cx(
                      'relative flex h-8 w-16 items-center justify-center rounded-full transition group-focus-visible:ring-2 group-focus-visible:ring-brand/50',
                      isActive && 'bg-brand/10 dark:bg-brand-bright/25',
                    )}
                  >
                    <Icon name={tab.icon} className="h-6 w-6" />
                    {tab.to === '/vic' && backupDue ? (
                      <span
                        className="absolute right-3.5 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-stone-950"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  {tab.label}
                  {tab.to === '/vic' && backupDue ? <span className="sr-only"> (záloha je stará)</span> : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
