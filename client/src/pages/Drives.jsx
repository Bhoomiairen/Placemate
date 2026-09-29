import { Briefcase, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DeadlineTag, EligibilityBadge, EmptyState, ErrorBox, MatchScore, PageHeader, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { APPLICATION_STATUSES, formatCtc, formatDate } from '../lib/format.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'eligible', label: 'Eligible' },
  { key: 'incomplete', label: 'Check profile' },
  { key: 'not_eligible', label: 'Not eligible' },
];

export function StatusSelect({ driveId, value, onChange }) {
  const [busy, setBusy] = useState(false);
  async function change(e) {
    const status = e.target.value;
    setBusy(true);
    try {
      if (status) await api(`/drives/${driveId}/application`, { method: 'PUT', body: { status } });
      else await api(`/drives/${driveId}/application`, { method: 'DELETE' });
      onChange?.(status || null);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <select className="input w-auto py-1.5 text-xs" value={value || ''} onChange={change} disabled={busy} aria-label="Application status" onClick={(e) => e.stopPropagation()}>
      <option value="">Not tracked</option>
      {Object.entries(APPLICATION_STATUSES).map(([k, label]) => (
        <option key={k} value={k}>{label}</option>
      ))}
    </select>
  );
}

export default function Drives() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const sort = params.get('sort') || 'deadline';
  const includeClosed = params.get('closed') === '1';
  const [q, setQ] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => update('q', q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    setError('');
    const query = new URLSearchParams({ status, sort, includeClosed: String(includeClosed), q: params.get('q') || '' });
    api(`/drives?${query}`).then(setData).catch((e) => setError(e.message));
  }, [status, sort, includeClosed, params]);

  const setApplication = (id, s) =>
    setData((d) => ({ ...d, drives: d.drives.map((x) => (x.id === id ? { ...x, application: s ? { status: s } : null } : x)) }));

  return (
    <>
      <PageHeader
        title="Drives"
        subtitle="Every drive your batch has added, checked against your profile and resume."
        action={<Link to="/drives/new" className="btn-primary">Add a drive</Link>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={status === t.key}
              onClick={() => update('status', t.key === 'all' ? '' : t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${status === t.key ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search company or role" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={sort} onChange={(e) => update('sort', e.target.value === 'deadline' ? '' : e.target.value)} aria-label="Sort by">
          <option value="deadline">Deadline (soonest)</option>
          <option value="match">Best match</option>
          <option value="ctc">Highest CTC</option>
          <option value="recent">Recently added</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeClosed} onChange={(e) => update('closed', e.target.checked ? '1' : '')} className="accent-brand-700" />
          Show closed
        </label>
      </div>

      {error && <ErrorBox message={error} />}
      {data?.matchError && <div className="mb-4"><ErrorBox message={`Match scores unavailable: ${data.matchError}`} /></div>}
      {!data && !error && <Spinner />}
      {data && data.drives.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No drives here"
          text={status === 'all' ? 'Add the first drive notice from your placement cell - your whole batch will see it.' : 'Try another filter.'}
          action={status === 'all' && <Link to="/drives/new" className="btn-primary">Add a drive</Link>}
        />
      )}

      {data && data.drives.length > 0 && (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.drives.map((d) => (
              <li key={d.id} className="grid grid-cols-2 items-start gap-3 p-4 hover:bg-slate-50 md:grid-cols-12 md:items-center">
                <Link to={`/drives/${d.id}`} className="col-span-2 md:col-span-3">
                  <div className="font-medium text-slate-900 hover:text-brand-800">{d.company}</div>
                  <div className="text-sm text-slate-500">{[d.role, formatCtc(d), d.location].filter(Boolean).join(' · ')}</div>
                </Link>
                <div className="col-span-2 md:col-span-3">
                  <EligibilityBadge status={d.eligibility.status} />
                  {d.eligibility.reasons[0] && <p className="mt-1 text-xs text-red-700">{d.eligibility.reasons[0]}</p>}
                  {d.eligibility.status === 'incomplete' && <p className="mt-1 text-xs text-amber-700">Missing in profile: {d.eligibility.missing.join(', ')}</p>}
                </div>
                <div className="md:col-span-2"><MatchScore match={d.match} compact /></div>
                <div className="text-sm whitespace-nowrap md:col-span-2">
                  <DeadlineTag deadline={d.deadline} />
                  <div className="text-xs text-slate-400">{d.deadline ? formatDate(d.deadline) : ''}</div>
                </div>
                <div className="col-span-2 md:col-span-2 md:text-right">
                  <StatusSelect driveId={d.id} value={d.application?.status} onChange={(s) => setApplication(d.id, s)} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
