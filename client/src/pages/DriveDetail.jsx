import { ArrowLeft, Calendar, ChevronDown, IndianRupee, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DriveForm, { draftToForm } from '../components/DriveForm.jsx';
import { DeadlineTag, EligibilityBadge, ErrorBox, MatchScore, PassIcon, SkillChips, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { BRANCHES, formatCtc, formatDate } from '../lib/format.js';
import { StatusSelect } from './Drives.jsx';

function Fact({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <Icon className="h-4 w-4 text-slate-400" /> {children}
    </div>
  );
}

export default function DriveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/drives/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  async function save(payload) {
    setBusy(true);
    setError('');
    try {
      const { drive } = await api(`/drives/${id}`, { method: 'PUT', body: payload });
      setData((d) => ({ ...d, drive }));
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this drive for everyone?')) return;
    try {
      await api(`/drives/${id}`, { method: 'DELETE' });
      navigate('/drives');
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  const d = data.drive;
  const e = d.eligibility;

  if (editing) {
    return (
      <>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Edit {d.company}</h1>
          <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
        </div>
        <div className="mb-4"><ErrorBox message={error} /></div>
        <DriveForm initial={draftToForm(d)} onSubmit={save} busy={busy} submitLabel="Save changes" />
      </>
    );
  }

  return (
    <>
      <Link to="/drives" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All drives
      </Link>
      <div className="mb-4"><ErrorBox message={error} /></div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{d.company}</h1>
              <EligibilityBadge status={e.status} />
              {d.isClosed && <span className="chip bg-slate-100 text-slate-600">Closed</span>}
            </div>
            {d.role && <p className="mt-1 text-slate-600">{d.role}</p>}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <Fact icon={IndianRupee}>{formatCtc(d)}{d.bond ? ` · Bond: ${d.bond}` : ''}</Fact>
              {d.location && <Fact icon={MapPin}>{d.location}</Fact>}
              <Fact icon={Calendar}>
                Apply by {formatDate(d.deadline, true)} · <DeadlineTag deadline={d.deadline} />
              </Fact>
              {d.driveDate && <Fact icon={Calendar}>Drive on {formatDate(d.driveDate, true)}</Fact>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <StatusSelect driveId={d.id} value={d.application?.status} onChange={(s) => setData((x) => ({ ...x, drive: { ...x.drive, application: s ? { status: s } : null } }))} />
            {d.canEdit && (
              <div className="flex gap-2">
                <button className="btn-secondary px-3" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</button>
                <button className="btn-danger px-3" onClick={remove} aria-label="Delete drive"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">Eligibility check</h2>
          {e.rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">This notice doesn't state any eligibility criteria.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th className="py-2 pr-3 font-medium">Criterion</th>
                    <th className="py-2 pr-3 font-medium">Required</th>
                    <th className="py-2 pr-3 font-medium">Yours</th>
                    <th className="py-2 font-medium"><span className="sr-only">Result</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {e.rows.map((r) => (
                    <tr key={r.key} className="align-top">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{r.label}</td>
                      <td className="py-2.5 pr-3 text-slate-600" title={r.key === 'branch' ? r.required.split(', ').map((b) => BRANCHES[b] || b).join(', ') : undefined}>
                        {r.required}
                      </td>
                      <td className="py-2.5 pr-3">
                        {r.yours ?? <Link to="/profile" className="text-amber-700 hover:underline">Add to profile</Link>}
                        {r.note && <p className="mt-1 max-w-xs text-xs text-slate-500">{r.note}</p>}
                      </td>
                      <td className="py-2.5"><PassIcon pass={r.pass} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {e.status === 'eligible' && e.rows.length > 0 && <p className="mt-4 text-sm font-medium text-emerald-700">You meet every stated criterion.</p>}
          {d.criteria?.branches?.includes('ALL') && <p className="mt-2 text-xs text-slate-500">Open to all branches.</p>}
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Resume match</h2>
          {!data.hasResume ? (
            <p className="mt-3 text-sm text-slate-500"><Link to="/resume" className="font-medium text-brand-700 hover:underline">Upload your resume</Link> to see how well you match.</p>
          ) : (
            <div className="mt-3 space-y-4">
              <MatchScore match={d.match} />
              {d.match && (
                <>
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-slate-500 uppercase">In your resume</div>
                    <SkillChips skills={d.match.matchedSkills} tone="good" />
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-slate-500 uppercase">Missing from your resume</div>
                    <SkillChips skills={d.match.missingSkills} tone="bad" empty="Nothing missing" />
                    {d.match.missingSkills.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500">If you know these, add them to your skills or project bullets before applying.</p>
                    )}
                  </div>
                  {d.match.softSkillsMentioned?.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-slate-500 uppercase">Soft skills mentioned</div>
                      <SkillChips skills={d.match.softSkillsMentioned} />
                    </div>
                  )}
                  <p className="text-xs text-slate-400">Overall text overlap with your resume: {d.match.textScore}%</p>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      <details className="card mt-6 p-5 [&_svg]:open:rotate-180">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
          Original notice <ChevronDown className="h-4 w-4 text-slate-400 transition" />
        </summary>
        <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-600">{d.rawText}</pre>
      </details>
    </>
  );
}
