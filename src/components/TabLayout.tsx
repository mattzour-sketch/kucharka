import { NavLink, Outlet } from 'react-router-dom';
import { useBackupReminder } from '../features/backup/useBackupReminder';

const tabs = [
  { to: '/', label: 'Recepty', icon: '🍲' },
  { to: '/potraviny', label: 'Potraviny', icon: '🥕' },
  { to: '/vic', label: 'Víc', icon: '☰' },
];

/** Layout se spodní navigační lištou (SPEC 6.1). */
export default function TabLayout() {
  const backupDue = useBackupReminder().due;

  return (
    <div className="min-h-dvh pb-16">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 dark:border-stone-700 bg-white/95 dark:bg-stone-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                  isActive ? 'text-brand dark:text-amber-400' : 'text-stone-500'
                }`
              }
            >
              <span className="relative text-lg leading-none">
                {tab.icon}
                {tab.to === '/vic' && backupDue ? (
                  <span className="absolute -right-1.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                ) : null}
              </span>
              {tab.label}
              {tab.to === '/vic' && backupDue ? <span className="sr-only"> (záloha je stará)</span> : null}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
