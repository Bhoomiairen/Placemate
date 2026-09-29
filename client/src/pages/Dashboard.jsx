import { ArrowRight, Briefcase, CheckCircle2, Circle, FileText, Gauge, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtsHistoryChart, SkillGapChart } from '../components/Charts.jsx';
import { DeadlineTag, EligibilityBadge, ErrorBox, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatCtc, scoreColor } from '../lib/format.js';

function Onboarding({ data }) {
  const steps = [
    { done: data.profileComplete, label: 'Fill in your academic profile', text: 'CGPA, 10th/12th marks, branch and batch - used for eligibility checks.', to: '/profile' },
    { done: data.hasResume, label: 'Upload your resume', text: 'Get an ATS health check and a match score for every drive.', to: '/resume' },
    { done: data.totals.openDrives > 0, label: 'Add your first drive notice', text: 'Paste the email or upload the PDF from the placement cell.', to: '/drives/new' },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <div className="card mb-6 p-5">
      <h2 className="font-semibold">Get set up</h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {steps.map((s) => (
          <li key={s.label}>
            <Link to={s.to} className="flex items-center gap-3 py-3 hover:text-brand-800">
              {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" />}
              <div className="flex-1">
                <div className={`text-sm font-medium ${s.done ? 'text-slate-400 line-through' : ''}`}>{s.label}</div>
                {!s.done && <div className="text-xs text-slate-500">{s.text}</div>}
              </div>
              {!s.done && <ArrowRight className="h-4 w-4 text-slate-400" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DriveRow({ d, right }) {
  return (
    <li>
      <Link to={`/drives/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-800">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{d.company}</div>
          <div className="truncate text-xs text-slate-500">{[d.role, formatCtc(d)].filter(Boolean).join(' · ')}</div>
        </div>
        {right}
      </Link>
    </li>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/insights').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;

  const { totals } = data;
  return (
    <>
      <PageHeader title={`Hi, ${user.name.split(' ')[0]}`} subtitle="Your placement season at a glance." action={<Link to="/drives/new" className="btn-primary">Add a drive</Link>} />
      <Onboarding data={data} />
      {data.matchError && <div className="mb-6"><ErrorBox message={`Match scores unavailable: ${data.matchError}`} /></div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open drives" value={totals.openDrives} icon={Briefcase} hint="Deadline not passed" />
        <StatCard label="You're eligible for" value={totals.eligible} icon={CheckCircle2} hint={totals.incomplete ? `+${totals.incomplete} need profile details` : `${totals.not_eligible} not eligible`} />
        <StatCard label="Applied" value={totals.applied} icon={Send} hint="Applied, test, interview or offer" />
        <StatCard label="Resume ATS score" value={data.atsScore ?? '—'} icon={Gauge} hint={data.atsScore == null ? 'Upload your resume' : 'Out of 100'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">Skills to add next</h2>
          <p className="mt-1 text-sm text-slate-500">
            Skills asked for by drives you can apply to, that your resume doesn't show yet.
          </p>
          <div className="mt-4">
            {!data.hasResume ? (
              <p className="py-8 text-center text-sm text-slate-500">
                <Link to="/resume" className="font-medium text-brand-700 hover:underline">Upload your resume</Link> to see your skill gaps.
              </p>
            ) : data.skillGaps.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {data.targetDriveCount ? 'Your resume covers every skill these drives ask for. 🎉' : 'Add drives you are eligible for to see skill gaps.'}
              </p>
            ) : (
              <>
                <SkillGapChart gaps={data.skillGaps} total={data.targetDriveCount} />
                <p className="mt-3 text-xs text-slate-500">
                  Top gap: <strong className="text-slate-700">{data.skillGaps[0].skill}</strong> — asked by {data.skillGaps[0].count} of {data.targetDriveCount} drives you can apply to.
                  If you know it, add it to your resume; if not, it's the best thing to learn next.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Deadlines this week</h2>
          <p className="mt-1 text-sm text-slate-500">Drives you can apply to and haven't yet.</p>
          {data.upcomingDeadlines.length ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {data.upcomingDeadlines.map((d) => (
                <DriveRow key={d.id} d={d} right={<span className="shrink-0 text-xs"><DeadlineTag deadline={d.deadline} /></span>} />
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Nothing due in the next 7 days.</p>
          )}
        </section>

        <section className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Best matches for your resume</h2>
            <Link to="/drives?sort=match" className="text-sm font-medium text-brand-700 hover:underline">All drives</Link>
          </div>
          {data.bestMatches.length ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {data.bestMatches.map((d) => (
                <DriveRow
                  key={d.id}
                  d={d}
                  right={
                    <div className="flex shrink-0 items-center gap-3">
                      {d.eligibility !== 'eligible' && <EligibilityBadge status={d.eligibility} />}
                      <span className={`text-sm font-semibold ${scoreColor(d.score)}`}>{d.score}%</span>
                    </div>
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">{data.hasResume ? 'No scored drives yet.' : 'Upload your resume to get match scores.'}</p>
          )}
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Why you're filtered out</h2>
          <p className="mt-1 text-sm text-slate-500">Criteria you miss, counted across open drives.</p>
          {data.notEligibleReasons.length ? (
            <ul className="mt-3 space-y-2">
              {data.notEligibleReasons.map((r) => (
                <li key={r.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span>{r.label}</span>
                  <span className="text-slate-500">{r.count} drive{r.count === 1 ? '' : 's'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">You meet the criteria of every open drive.</p>
          )}
        </section>

        {data.resumeHistory.length >= 2 && (
          <section className="card p-5 lg:col-span-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <h2 className="font-semibold">ATS score over resume versions</h2>
            </div>
            <div className="mt-4">
              <AtsHistoryChart history={data.resumeHistory} />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
