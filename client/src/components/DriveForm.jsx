import { Info } from 'lucide-react';
import { useState } from 'react';
import { BRANCHES } from '../lib/format.js';

// ---- conversions between API values and form strings ----
const str = (v) => (v === null || v === undefined ? '' : String(v));
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function draftToForm(d) {
  const c = d.criteria || {};
  return {
    company: str(d.company), role: str(d.role), location: str(d.location),
    ctcLpa: str(d.ctcLpa), ctcMaxLpa: str(d.ctcMaxLpa), stipendPerMonth: str(d.stipendPerMonth), bond: str(d.bond),
    deadline: toLocalInput(d.deadline), driveDate: toLocalInput(d.driveDate),
    minCgpa: str(c.minCgpa), cgpaScale: str(c.cgpaScale || 10), min10th: str(c.min10th), min12th: str(c.min12th),
    minDiploma: str(c.minDiploma), minGradPercent: str(c.minGradPercent),
    branches: c.branches || [], maxActiveBacklogs: str(c.maxActiveBacklogs),
    allowBacklogHistory: c.allowBacklogHistory === true ? 'yes' : c.allowBacklogHistory === false ? 'no' : '',
    graduationYears: (c.graduationYears || []).join(', '), maxGapYears: str(c.maxGapYears),
    skills: (d.skills || []).join(', '),
    rawText: d.rawText || '', evidence: d.evidence || {},
  };
}

export function formToPayload(f) {
  const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  return {
    company: f.company.trim(), role: f.role.trim() || null, location: f.location.trim() || null,
    ctcLpa: numOrNull(f.ctcLpa), ctcMaxLpa: numOrNull(f.ctcMaxLpa), stipendPerMonth: numOrNull(f.stipendPerMonth), bond: f.bond.trim() || null,
    deadline: fromLocalInput(f.deadline), driveDate: fromLocalInput(f.driveDate),
    criteria: {
      minCgpa: numOrNull(f.minCgpa), cgpaScale: f.minCgpa ? Number(f.cgpaScale) : null,
      min10th: numOrNull(f.min10th), min12th: numOrNull(f.min12th), minDiploma: numOrNull(f.minDiploma), minGradPercent: numOrNull(f.minGradPercent),
      branches: f.branches, maxActiveBacklogs: numOrNull(f.maxActiveBacklogs),
      allowBacklogHistory: f.allowBacklogHistory === 'yes' ? true : f.allowBacklogHistory === 'no' ? false : null,
      graduationYears: list(f.graduationYears).map(Number).filter((n) => Number.isInteger(n)),
      maxGapYears: numOrNull(f.maxGapYears),
    },
    skills: list(f.skills),
    rawText: f.rawText,
    evidence: f.evidence,
  };
}

// ---- small field components ----
function Evidence({ text }) {
  if (!text) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-slate-500" title="The line in the notice this value was read from">
      <Info className="mt-0.5 h-3 w-3 shrink-0" /> <span className="italic">“{text}”</span>
    </p>
  );
}

function Field({ label, children, evidence, hint, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <Evidence text={evidence} />
    </div>
  );
}

export default function DriveForm({ initial, onSubmit, submitLabel = 'Save drive', busy }) {
  const [f, setF] = useState(initial);
  const ev = f.evidence || {};
  const set = (key) => (e) => setF((x) => ({ ...x, [key]: e.target.value }));
  const num = (key, props = {}) => <input type="number" step="any" className="input" value={f[key]} onChange={set(key)} {...props} />;

  const toggleBranch = (code) =>
    setF((x) => {
      if (code === 'ALL') return { ...x, branches: x.branches.includes('ALL') ? [] : ['ALL'] };
      const without = x.branches.filter((b) => b !== 'ALL');
      return { ...x, branches: without.includes(code) ? without.filter((b) => b !== code) : [...without, code] };
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formToPayload(f));
      }}
      className="space-y-6"
    >
      <section className="card p-5">
        <h2 className="font-semibold">Company & role</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Company *" evidence={ev.company}><input className="input" value={f.company} onChange={set('company')} required /></Field>
          <Field label="Role" evidence={ev.role}><input className="input" value={f.role} onChange={set('role')} /></Field>
          <Field label="Location" evidence={ev.location}><input className="input" value={f.location} onChange={set('location')} /></Field>
          <Field label="Bond" evidence={ev.bond}><input className="input" value={f.bond} onChange={set('bond')} placeholder="e.g. 2 years / No bond" /></Field>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <Field label="CTC (LPA)">{num('ctcLpa', { min: 0 })}</Field>
            <Field label="CTC max (LPA)" hint="If a range">{num('ctcMaxLpa', { min: 0 })}</Field>
            <Field label="Stipend / month (₹)">{num('stipendPerMonth', { min: 0 })}</Field>
          </div>
          <Evidence text={ev.ctc} />
          <Field label="Registration deadline" evidence={ev.deadline} className="sm:col-start-1"><input type="datetime-local" className="input" value={f.deadline} onChange={set('deadline')} /></Field>
          <Field label="Drive / test date" evidence={ev.driveDate}><input type="datetime-local" className="input" value={f.driveDate} onChange={set('driveDate')} /></Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Eligibility criteria</h2>
        <p className="mt-1 text-sm text-slate-500">Leave a field empty if the notice doesn't mention it.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Minimum CGPA" evidence={ev.minCgpa}>
            <div className="flex gap-2">
              {num('minCgpa', { min: 0, max: 10 })}
              <select className="input w-24" value={f.cgpaScale} onChange={set('cgpaScale')} aria-label="CGPA scale">
                <option value="10">/ 10</option>
                <option value="4">/ 4</option>
              </select>
            </div>
          </Field>
          <Field label="Minimum 10th %" evidence={ev.min10th}>{num('min10th', { min: 0, max: 100 })}</Field>
          <Field label="Minimum 12th %" evidence={ev.min12th}>{num('min12th', { min: 0, max: 100 })}</Field>
          <Field label="Minimum Diploma %" evidence={ev.minDiploma} hint="For diploma (lateral entry) students">{num('minDiploma', { min: 0, max: 100 })}</Field>
          <Field label="Minimum graduation %" evidence={ev.minGradPercent}>{num('minGradPercent', { min: 0, max: 100 })}</Field>
          <Field label="Max active backlogs" evidence={ev.backlogs} hint="0 = no active backlogs">{num('maxActiveBacklogs', { min: 0 })}</Field>
          <Field label="Backlog history">
            <select className="input" value={f.allowBacklogHistory} onChange={set('allowBacklogHistory')}>
              <option value="">Not mentioned</option>
              <option value="yes">Cleared backlogs are OK</option>
              <option value="no">Never had a backlog</option>
            </select>
          </Field>
          <Field label="Batch (graduation year)" evidence={ev.graduationYears} hint="Comma-separated, e.g. 2026, 2027"><input className="input" value={f.graduationYears} onChange={set('graduationYears')} /></Field>
          <Field label="Max education gap (years)" evidence={ev.maxGapYears}>{num('maxGapYears', { min: 0 })}</Field>
        </div>

        <div className="mt-5">
          <span className="label">Eligible branches</span>
          <div className="flex flex-wrap gap-2">
            {['ALL', ...Object.keys(BRANCHES).filter((b) => b !== 'OTHER')].map((code) => {
              const on = f.branches.includes(code);
              return (
                <button
                  type="button"
                  key={code}
                  onClick={() => toggleBranch(code)}
                  aria-pressed={on}
                  title={BRANCHES[code] || 'Any branch'}
                  className={`chip px-3 py-1 ring-1 ${on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'}`}
                >
                  {code === 'ALL' ? 'All branches' : code}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">None selected = not mentioned in the notice.</p>
          <Evidence text={ev.branches} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Skills asked for</h2>
        <p className="mt-1 text-sm text-slate-500">Used to compute each student's match score. Comma-separated.</p>
        <textarea className="input mt-3" rows={2} value={f.skills} onChange={set('skills')} />
      </section>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
