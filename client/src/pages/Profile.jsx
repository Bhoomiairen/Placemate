import { useState } from 'react';
import { ErrorBox, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { BRANCHES } from '../lib/format.js';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const numOrNull = (v) => (v === '' ? null : Number(v));

export default function Profile() {
  const { user, setUser } = useAuth();
  const p = user.profile || {};
  const [f, setF] = useState({
    name: user.name,
    branch: p.branch || '',
    cgpa: str(p.cgpa),
    cgpaScale: str(p.cgpaScale || 10),
    tenthPercent: str(p.tenthPercent),
    twelfthPercent: str(p.twelfthPercent),
    diplomaPercent: str(p.diplomaPercent),
    gradPercentage: str(p.gradPercentage),
    activeBacklogs: str(p.activeBacklogs ?? 0),
    backlogHistory: Boolean(p.backlogHistory),
    graduationYear: str(p.graduationYear),
    gapYears: str(p.gapYears ?? 0),
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => {
    setSaved(false);
    setF((x) => ({ ...x, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api('/profile', {
        method: 'PUT',
        body: {
          name: f.name,
          branch: f.branch || null,
          cgpa: numOrNull(f.cgpa),
          cgpaScale: Number(f.cgpaScale),
          tenthPercent: numOrNull(f.tenthPercent),
          twelfthPercent: numOrNull(f.twelfthPercent),
          diplomaPercent: numOrNull(f.diplomaPercent),
          gradPercentage: numOrNull(f.gradPercentage),
          activeBacklogs: Number(f.activeBacklogs || 0),
          backlogHistory: f.backlogHistory,
          graduationYear: numOrNull(f.graduationYear),
          gapYears: Number(f.gapYears || 0),
        },
      });
      setUser(d.user);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const num = (key, props) => <input id={key} type="number" step="any" className="input" value={f[key]} onChange={set(key)} {...props} />;

  return (
    <>
      <PageHeader title="Academic profile" subtitle="Used only to check drive eligibility. Enter marks exactly as on your marksheets." />
      <form onSubmit={submit} className="card max-w-3xl space-y-6 p-6">
        <ErrorBox message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" value={f.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="label" htmlFor="branch">Branch</label>
            <select id="branch" className="input" value={f.branch} onChange={set('branch')}>
              <option value="">Select your branch</option>
              {Object.entries(BRANCHES).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cgpa">Current CGPA</label>
            <div className="flex gap-2">
              {num('cgpa', { min: 0, max: f.cgpaScale === '4' ? 4 : 10 })}
              <select className="input w-24" value={f.cgpaScale} onChange={set('cgpaScale')} aria-label="CGPA scale">
                <option value="10">/ 10</option>
                <option value="4">/ 4</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500">NMIMS and some universities use a 4-point scale - pick it so comparisons are correct.</p>
          </div>
          <div>
            <label className="label" htmlFor="graduationYear">Graduation year (batch)</label>
            {num('graduationYear', { min: 2000, max: 2100, step: 1, placeholder: '2027' })}
          </div>
          <div>
            <label className="label" htmlFor="tenthPercent">10th %</label>
            {num('tenthPercent', { min: 0, max: 100 })}
          </div>
          <div>
            <label className="label" htmlFor="twelfthPercent">12th %</label>
            {num('twelfthPercent', { min: 0, max: 100 })}
            <p className="mt-1 text-xs text-slate-500">Leave empty if you did a diploma instead.</p>
          </div>
          <div>
            <label className="label" htmlFor="diplomaPercent">Diploma % (if any)</label>
            {num('diplomaPercent', { min: 0, max: 100 })}
          </div>
          <div>
            <label className="label" htmlFor="gradPercentage">Graduation % (optional)</label>
            {num('gradPercentage', { min: 0, max: 100 })}
            <p className="mt-1 text-xs text-slate-500">If empty, it's estimated from your CGPA.</p>
          </div>
          <div>
            <label className="label" htmlFor="activeBacklogs">Active backlogs / KTs</label>
            {num('activeBacklogs', { min: 0, step: 1 })}
          </div>
          <div>
            <label className="label" htmlFor="gapYears">Gap years in education</label>
            {num('gapYears', { min: 0, step: 1 })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.backlogHistory} onChange={set('backlogHistory')} className="accent-brand-700" />
          I have had a backlog in the past (even if cleared)
        </label>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-700">Saved. Eligibility updated on all drives.</span>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </form>
    </>
  );
}
