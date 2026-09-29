import { AlertCircle, Check, CircleHelp, Loader2, X } from 'lucide-react';
import { ELIGIBILITY, relativeDeadline, scoreColor } from '../lib/format.js';

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{message}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EligibilityBadge({ status }) {
  const e = ELIGIBILITY[status] || ELIGIBILITY.incomplete;
  return <span className={`chip ${e.className}`}>{e.label}</span>;
}

export function PassIcon({ pass }) {
  if (pass === true) return <Check className="h-4 w-4 text-emerald-600" aria-label="Pass" />;
  if (pass === false) return <X className="h-4 w-4 text-red-600" aria-label="Fail" />;
  return <CircleHelp className="h-4 w-4 text-amber-600" aria-label="Unknown" />;
}

export function DeadlineTag({ deadline }) {
  const r = relativeDeadline(deadline);
  if (!r) return <span className="text-slate-400">No deadline</span>;
  return (
    <span className={r.closed ? 'text-slate-400' : r.urgent ? 'font-medium text-red-700' : 'text-slate-600'}>{r.text}</span>
  );
}

/** Match score as a number with a thin bar - the number is the label, the bar is the visual. */
export function MatchScore({ match, compact = false }) {
  if (!match) return <span className="text-xs text-slate-400">Upload resume</span>;
  if (match.score == null) return <span className="text-xs text-slate-400" title="The notice lists no technical skills to compare">No skills listed</span>;
  return (
    <div className={compact ? 'w-24' : 'w-32'} title={`${match.matchedSkills.length} of ${match.jdSkillCount} skills in your resume`}>
      <div className={`text-sm font-semibold ${scoreColor(match.score)}`}>{match.score}% match</div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${match.score}%` }} />
      </div>
    </div>
  );
}

export function SkillChips({ skills, tone = 'neutral', empty = 'None' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    good: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    bad: 'bg-red-50 text-red-800 ring-1 ring-red-200',
  };
  if (!skills?.length) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((s) => (
        <span key={s} className={`chip ${tones[tone]}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-sm text-slate-500">
        {label}
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && <Icon className="h-10 w-10 text-slate-300" />}
      <h3 className="mt-3 font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
