import { AlertTriangle, Check, FileUp, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AtsHistoryChart } from '../components/Charts.jsx';
import { ErrorBox, PageHeader, SkillChips } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatDate, scoreColor } from '../lib/format.js';

const SEVERITY = {
  high: { label: 'Fix first', className: 'bg-red-50 text-red-800 ring-1 ring-red-200', icon: AlertTriangle },
  medium: { label: 'Important', className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200', icon: AlertTriangle },
  low: { label: 'Nice to fix', className: 'bg-slate-100 text-slate-700', icon: Info },
};

const CATEGORY_LABELS = {
  language: 'Languages', frontend: 'Frontend', backend: 'Backend', database: 'Databases', cloud: 'Cloud', devops: 'DevOps',
  'ai-ml': 'AI / ML', data: 'Data', mobile: 'Mobile', 'cs-fundamentals': 'CS fundamentals', tools: 'Tools', security: 'Security', soft: 'Soft skills', other: 'Other',
};

function Check2({ ok, label }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <Check className="h-4 w-4 text-emerald-600" aria-label="Found" /> : <X className="h-4 w-4 text-red-600" aria-label="Missing" />}
      <span className={ok ? 'text-slate-700' : 'text-slate-900 font-medium'}>{label}</span>
    </li>
  );
}

export default function Resume() {
  const { user, setUser } = useAuth();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [inputKey, setInputKey] = useState(0); // resets the file input so the same file can be chosen again
  const resume = user.resume;
  const ats = resume?.ats;

  useEffect(() => {
    api('/resume/history').then((d) => setHistory(d.history)).catch(() => {});
  }, [resume?.uploadedAt]);

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const d = await api('/resume', { method: 'POST', formData: fd });
      setUser(d.user);
      setFile(null);
      setInputKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Resume" subtitle="Your resume is checked like an ATS would, and compared with every drive's skill list." />

      <form onSubmit={upload} className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600 hover:border-brand-500">
          <FileUp className="h-5 w-5 text-slate-400" />
          {file ? <span className="font-medium text-slate-900">{file.name}</span> : resume ? <span>Upload a new version (PDF)</span> : <span>Choose your resume PDF</span>}
          <input key={inputKey} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        <button className="btn-primary" disabled={!file || busy}>{busy ? 'Analysing…' : 'Upload & analyse'}</button>
        {error && <div className="w-full"><ErrorBox message={error} /></div>}
        {resume && <p className="w-full text-xs text-slate-500">Current: {resume.fileName} · uploaded {formatDate(resume.uploadedAt, true)}</p>}
      </form>

      {!ats ? (
        <p className="text-sm text-slate-500">No resume yet. Upload a text-based PDF (exported from Word, Google Docs, Overleaf) - scanned images can't be read by ATS software either.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-5">
            <h2 className="font-semibold">ATS health score</h2>
            <div className={`mt-2 text-5xl font-semibold tracking-tight ${scoreColor(ats.score)}`}>{ats.score}<span className="text-xl text-slate-400">/100</span></div>
            <p className="mt-1 text-xs text-slate-500">Rule-based: each issue below lowers the score (high −12, medium −6, low −3).</p>
            <h3 className="mt-5 text-sm font-semibold">Contact details</h3>
            <ul className="mt-2 space-y-1.5">
              <Check2 ok={ats.contact.email} label="Email" />
              <Check2 ok={ats.contact.phone} label="Phone number" />
              <Check2 ok={ats.contact.linkedin} label="LinkedIn" />
              <Check2 ok={ats.contact.github} label="GitHub" />
            </ul>
            <h3 className="mt-5 text-sm font-semibold">Bullet points</h3>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">Found</dt><dd>{ats.bullets.total}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">With a number / metric</dt><dd>{ats.bullets.withNumbers}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Start with an action verb</dt><dd>{ats.bullets.startWithActionVerb}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Pages / words</dt><dd>{ats.pages} / {ats.wordCount}</dd></div>
            </dl>
          </section>

          <section className="card p-5 lg:col-span-2">
            <h2 className="font-semibold">What to fix</h2>
            {ats.issues.length === 0 ? (
              <p className="mt-3 text-sm text-emerald-700">No issues found. Nice work.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ats.issues.map((i) => {
                  const s = SEVERITY[i.severity];
                  return (
                    <li key={i.message} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start gap-2">
                        <span className={`chip shrink-0 ${s.className}`}>{s.label}</span>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{i.message}</div>
                          <div className="mt-0.5 text-sm text-slate-600">{i.fix}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {ats.bullets.examplesWithoutNumbers?.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Bullets that could use a number</h3>
                <ul className="mt-2 space-y-2">
                  {ats.bullets.examplesWithoutNumbers.map((b) => (
                    <li key={b} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 italic">“{b}…”</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card p-5 lg:col-span-3">
            <h2 className="font-semibold">Skills detected</h2>
            <p className="mt-1 text-sm text-slate-500">
              What drives are matched against. Includes implied skills (e.g. Spring Boot → Java). If something you know is missing here, it's missing from your resume.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(resume.skillsByCategory || {}).map(([cat, skills]) => (
                <div key={cat}>
                  <div className="mb-1.5 text-xs font-medium text-slate-500 uppercase">{CATEGORY_LABELS[cat] || cat}</div>
                  <SkillChips skills={skills} />
                </div>
              ))}
            </div>
          </section>

          {history.length >= 2 && (
            <section className="card p-5 lg:col-span-3">
              <h2 className="font-semibold">Score across versions</h2>
              <div className="mt-4"><AtsHistoryChart history={history} /></div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
