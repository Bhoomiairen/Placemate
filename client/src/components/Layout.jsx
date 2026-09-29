import { Briefcase, FileText, LayoutDashboard, LogOut, PlusCircle, Sparkles, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/drives', label: 'Drives', icon: Briefcase, end: true },
  { to: '/drives/new', label: 'Add drive', icon: PlusCircle },
  { to: '/ask', label: 'Ask', icon: Sparkles },
  { to: '/resume', label: 'Resume', icon: FileText },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      <span className="text-lg font-semibold tracking-tight text-slate-900">PlaceMate</span>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1" aria-label="Main">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 md:inline">{user?.name}</span>
            <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Log out" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
