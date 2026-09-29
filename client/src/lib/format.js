export const BRANCHES = {
  CSE: 'Computer Science / Computer Engg.',
  IT: 'Information Technology',
  ECE: 'Electronics & Telecom (EXTC / ECE)',
  EEE: 'Electrical',
  ECS: 'Electronics & Computer Science',
  MECH: 'Mechanical',
  CIVIL: 'Civil',
  CHEM: 'Chemical',
  'AI-ML': 'AI & ML / AI & DS',
  'DATA-SCIENCE': 'Data Science',
  CSBS: 'CS & Business Systems',
  'MBA-TECH': 'MBA Tech',
  OTHER: 'Other',
};

export const APPLICATION_STATUSES = {
  interested: 'Interested',
  applied: 'Applied',
  test: 'Test / OA',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  not_interested: 'Not interested',
};

export const ELIGIBILITY = {
  eligible: { label: 'Eligible', className: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' },
  not_eligible: { label: 'Not eligible', className: 'bg-red-50 text-red-800 ring-1 ring-red-200' },
  incomplete: { label: 'Check profile', className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' },
};

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime && { hour: 'numeric', minute: '2-digit' }),
  });
}

/** "in 3 days", "today", "closed" */
export function relativeDeadline(value) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (ms < 0) return { text: 'Closed', urgent: false, closed: true };
  const hours = ms / 3600000;
  if (hours < 24) return { text: `${Math.max(1, Math.round(hours))}h left`, urgent: true };
  const days = Math.round(hours / 24);
  return { text: `${days} day${days === 1 ? '' : 's'} left`, urgent: days <= 2 };
}

export function formatCtc(drive) {
  if (drive.ctcLpa == null) return drive.stipendPerMonth ? `₹${drive.stipendPerMonth.toLocaleString('en-IN')}/mo stipend` : '—';
  return drive.ctcMaxLpa ? `${drive.ctcLpa}–${drive.ctcMaxLpa} LPA` : `${drive.ctcLpa} LPA`;
}

export function scoreColor(score) {
  if (score == null) return 'text-slate-400';
  if (score >= 75) return 'text-emerald-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-red-700';
}
