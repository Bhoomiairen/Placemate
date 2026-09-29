import { AlertTriangle, FileUp, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DriveForm, { draftToForm } from '../components/DriveForm.jsx';
import { ErrorBox, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const EXAMPLE = `Campus Recruitment Drive - Nimbus Technologies

Role: Software Development Engineer
CTC: 8.5 LPA
Location: Bengaluru

Eligibility:
- Branches: Computer Engineering, IT, EXTC
- CGPA >= 7.0, 10th & 12th >= 60%
- No active backlogs, 2027 batch

Skills: Java, Spring Boot, SQL, DSA
Last date to register: 5th October 2026, 11:59 PM`;

export default function AddDrive() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function extract(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let result;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        result = await api('/drives/parse', { method: 'POST', formData: fd });
      } else {
        result = await api('/drives/parse', { method: 'POST', body: { text } });
      }
      setDraft(result.draft);
      setDuplicates(result.possibleDuplicates);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(payload) {
    setError('');
    setBusy(true);
    try {
      const { drive } = await api('/drives', { method: 'POST', body: payload });
      navigate(`/drives/${drive.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (draft) {
    return (
      <>
        <PageHeader
          title="Check the extracted details"
          subtitle={`Found ${draft.criteriaFound} eligibility criteria. Grey quotes show which line each value came from - fix anything that's wrong, then save.`}
          action={<button className="btn-secondary" onClick={() => setDraft(null)}>Start over</button>}
        />
        {duplicates.length > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              This company was already added recently:{' '}
              {duplicates.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ', '}
                  <Link className="font-medium underline" to={`/drives/${d.id}`}>{d.company}{d.role ? ` – ${d.role}` : ''}</Link>
                </span>
              ))}
              . Save only if this is a different drive.
            </div>
          </div>
        )}
        <div className="mb-4"><ErrorBox message={error} /></div>
        <DriveForm initial={draftToForm(draft)} onSubmit={save} busy={busy} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Add a drive" subtitle="Paste the notice from the placement cell (email, WhatsApp, portal) or upload the PDF. Everyone in your batch will see it." />
      <form onSubmit={extract} className="card space-y-5 p-5">
        <ErrorBox message={error} />
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="notice">Notice text</label>
            <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => { setText(EXAMPLE); setFile(null); }}>
              Use an example
            </button>
          </div>
          <textarea
            id="notice"
            className="input font-mono text-xs leading-relaxed"
            rows={14}
            placeholder="Paste the full drive notice here…"
            value={text}
            onChange={(e) => { setText(e.target.value); setFile(null); }}
            disabled={Boolean(file)}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /> OR <div className="h-px flex-1 bg-slate-200" />
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:border-brand-500 hover:bg-brand-50/40">
          <FileUp className="h-6 w-6 text-slate-400" />
          {file ? <span className="font-medium text-slate-900">{file.name}</span> : <span>Upload the notice PDF</span>}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { setFile(e.target.files[0] || null); if (e.target.files[0]) setText(''); }} />
        </label>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy || (!file && text.trim().length < 20)}>
            <Sparkles className="h-4 w-4" /> {busy ? 'Reading notice…' : 'Extract details'}
          </button>
        </div>
      </form>
    </>
  );
}
