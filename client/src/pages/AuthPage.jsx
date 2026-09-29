import { CalendarClock, ListChecks, Target } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout.jsx';
import { ErrorBox } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const features = [
  { icon: ListChecks, title: 'Eligibility in one glance', text: 'Paste a drive notice - CGPA, 10th/12th, branch and backlog rules are read automatically and checked against your profile.' },
  { icon: Target, title: 'Resume fit per drive', text: 'See which drives your resume matches best, and which skills each one asks for that you have not shown.' },
  { icon: CalendarClock, title: 'Never miss a deadline', text: 'All drives your batch adds, in one place, sorted by deadline.' },
];

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-900 p-12 text-brand-50 lg:flex">
        <div className="[&_span]:text-white">
          <Logo />
        </div>
        <div>
          <h2 className="text-3xl leading-tight font-semibold text-white">Placement season, organised.</h2>
          <div className="mt-8 space-y-6">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-200" />
                <div>
                  <div className="font-medium text-white">{title}</div>
                  <p className="mt-1 text-sm text-brand-100/80">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-brand-100/60">Built for campus placements in India.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isLogin ? 'Log in to see your drives and eligibility.' : 'Takes 30 seconds. Then add your profile and resume.'}
            </p>
          </div>
          <ErrorBox message={error} />
          {!isLogin && (
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={form.password} onChange={set('password')} required minLength={isLogin ? 1 : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} />
            {!isLogin && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
          </button>
          <p className="text-center text-sm text-slate-500">
            {isLogin ? "Don't have an account? " : 'Already registered? '}
            <Link className="font-medium text-brand-700 hover:underline" to={isLogin ? '/register' : '/login'}>
              {isLogin ? 'Sign up' : 'Log in'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
