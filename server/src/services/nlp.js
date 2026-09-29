import { config } from '../config.js';
import { HttpError } from '../middleware/error.js';

/** Thin client for the Python NLP microservice. */
async function call(path, { json, file, timeoutMs = 30000 } = {}) {
  const init = { method: 'POST', signal: AbortSignal.timeout(timeoutMs) };
  if (file) {
    const form = new FormData();
    form.append('file', new Blob([file.buffer], { type: 'application/pdf' }), file.originalname || 'upload.pdf');
    init.body = form;
  } else {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(json ?? {});
  }

  let res;
  try {
    res = await fetch(`${config.nlpUrl}${path}`, init);
  } catch (err) {
    throw new HttpError(503, 'The NLP service is not reachable. Is it running on ' + config.nlpUrl + '?', { cause: err });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 4xx from the NLP service are user errors (bad PDF, empty notice) - pass them through
    throw new HttpError(res.status >= 500 ? 502 : res.status, body.error || 'NLP service error');
  }
  return body;
}

export const nlp = {
  parseResume: (file) => call('/resume/parse', { file }),
  parseNoticeText: (text) => call('/notice/parse', { json: { text } }),
  parseNoticeFile: (file) => call('/notice/parse', { file }),
  extractSkills: (text) => call('/skills/extract', { json: { text } }),
  matchBatch: (resumeText, resumeSkills, items) => call('/match/batch', { json: { resumeText, resumeSkills, items } }),
};
