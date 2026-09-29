import { ArrowUp, Bot, Loader2, RefreshCw, Sparkles, TerminalSquare } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EligibilityBadge, ErrorBox, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const SUGGESTIONS = [
  'Which drives am I eligible for, and which close first?',
  'Which drives need Java or Spring Boot?',
  'Which company pays the highest CTC that I can apply to?',
  'What skills should I learn for the drives I can apply to?',
  'Is there any drive with no bond?',
];

// Turn "[D2]" citations into links to the drive, and render "- " lines as a list and **bold**.
function RichText({ text, tags }) {
  const inline = (line, key) =>
    line.split(/(\[D\d+\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      const cite = part.match(/^\[(D\d+)\]$/);
      if (cite && tags[cite[1]]) {
        const t = tags[cite[1]];
        return (
          <Link key={`${key}-${i}`} to={`/drives/${t.id}`} title={t.company}
            className="mx-0.5 rounded bg-brand-50 px-1.5 py-0.5 align-baseline text-xs font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100">
            {cite[1]}
          </Link>
        );
      }
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>;
      return <Fragment key={`${key}-${i}`}>{part}</Fragment>;
    });

  const blocks = [];
  let list = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      list = list || [];
      list.push(<li key={i}>{inline(item[1], i)}</li>);
      return;
    }
    if (list) {
      blocks.push(<ul key={`ul-${i}`} className="my-2 list-disc space-y-1 pl-5">{list}</ul>);
      list = null;
    }
    if (line) blocks.push(<p key={i} className="my-1.5">{inline(line, i)}</p>);
  });
  if (list) blocks.push(<ul key="ul-end" className="my-2 list-disc space-y-1 pl-5">{list}</ul>);
  return <div className="text-sm leading-relaxed text-slate-800">{blocks}</div>;
}

function SetupHelp({ status, onRetry }) {
  const missing = status?.missing || [];
  return (
    <div className="card mb-6 border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-start gap-3">
        <TerminalSquare className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1 text-sm text-amber-950">
          <p className="font-semibold">The AI model isn't running yet</p>
          <p className="mt-1 text-amber-900">{status?.error || `Missing model${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`}</p>
          <p className="mt-3">Ask PlaceMate runs on your own laptop with Ollama (free, nothing is sent to the internet). One-time setup in a terminal:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{`brew install ollama
brew services start ollama
ollama pull ${status?.chatModel || 'llama3.2:3b'}
ollama pull ${status?.embedModel || 'nomic-embed-text'}
cd server && npm run reindex`}</pre>
          <button className="btn-secondary mt-3" onClick={onRetry}><RefreshCw className="h-4 w-4" /> Check again</button>
        </div>
      </div>
    </div>
  );
}

export default function Ask() {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const checkStatus = () => api('/assistant/status').then(setStatus).catch((e) => setStatus({ ready: false, error: e.message }));
  useEffect(() => { checkStatus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  async function send(question) {
    const q = question.trim();
    if (!q || busy) return;
    setError('');
    setInput('');
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const r = await api('/assistant/ask', { method: 'POST', body: { question: q, history } });
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources, tags: r.tags, ms: r.ms, retrieved: r.retrieved.length }]);
    } catch (e) {
      setError(e.message);
      setMessages((m) => m.slice(0, -1));
      setInput(q);
      if (/Ollama|model/i.test(e.message)) checkStatus();
    } finally {
      setBusy(false);
    }
  }

  const notReady = status && !status.ready;

  return (
    <>
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Sparkles className="h-6 w-6 text-brand-600" /> Ask PlaceMate</span>}
        subtitle="Ask anything about the drives. Answers come only from the notices your batch added and your own profile."
      />
      {notReady && <SetupHelp status={status} onRetry={checkStatus} />}

      <div className="card flex min-h-[28rem] flex-col">
        <div className="flex-1 space-y-5 p-5">
          {messages.length === 0 && (
            <div className="py-6 text-center">
              <Bot className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Try one of these:</p>
              <div className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={busy || notReady}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-700 px-4 py-2.5 text-sm text-white">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-200">
                  <Bot className="h-4 w-4 text-brand-700" />
                </div>
                <div className="min-w-0 max-w-[85%]">
                  <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <RichText text={m.content} tags={m.tags || {}} />
                  </div>
                  {m.sources?.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">Sources:</span>
                      {m.sources.map((s) => (
                        <Link key={s.tag} to={`/drives/${s.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-brand-300">
                          <span className="font-semibold text-brand-800">{s.tag}</span> {s.company}
                          <EligibilityBadge status={s.eligibility} />
                        </Link>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {m.sources?.length ? '' : 'No drive cited. '}Answered in {(m.ms / 1000).toFixed(1)}s from {m.retrieved} notice passages.
                  </p>
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the notices… (the first answer can take up to 30 seconds while the model loads)
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-200 p-3">
          {error && <div className="mb-2"><ErrorBox message={error} /></div>}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              maxLength={500}
              placeholder={notReady ? 'Set up the AI model first (see above)' : 'e.g. Which drives close this week that I can apply to?'}
              disabled={notReady}
              className="input max-h-40 min-h-[42px] resize-y"
            />
            <button className="btn-primary h-[42px] w-[42px] shrink-0 px-0" disabled={busy || notReady || input.trim().length < 3} aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 text-[11px] text-slate-400">
            Eligibility and match scores are calculated by PlaceMate, not the AI. The AI can still make mistakes, so confirm details in the official notice.
          </p>
        </div>
      </div>
    </>
  );
}
