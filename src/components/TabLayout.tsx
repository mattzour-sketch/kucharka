import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Recepty', icon: '🍲' },
  { to: '/hledat', label: 'Hledat', icon: '🔍' },
  { to: '/potraviny', label: 'Potraviny', icon: '🥕' },
  { to: '/vic', label: 'Víc', icon: '☰' },
];

/** Layout se spodní navigační lištou (SPEC 6.1). */
export default function TabLayout() {
  return (
    <div className="min-h-dvh pb-16">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                  isActive ? 'text-brand' : 'text-stone-500'
                }`
              }
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
