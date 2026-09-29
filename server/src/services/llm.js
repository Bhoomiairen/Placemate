import { config } from '../config.js';
import { HttpError } from '../middleware/error.js';

/**
 * Client for a local Ollama server (https://ollama.com). Everything runs on the
 * student's own machine: no API key, no cost, and no student data leaves the laptop.
 *
 *   embed(texts)   -> number[][]   (nomic-embed-text by default)
 *   chat(messages) -> string       (llama3.2:3b by default)
 */

async function call(path, body, timeoutMs) {
  let res;
  try {
    res = await fetch(`${config.ollamaUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'took too long to answer' : `isn't reachable at ${config.ollamaUrl}`;
    throw new HttpError(503, `The local AI model ${reason}. Is Ollama running? (ollama serve)`, { cause: err });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `Ollama error ${res.status}`;
    const hint = /not found/i.test(msg) ? ` Run: ollama pull ${body?.model}` : '';
    throw new HttpError(503, `${msg}.${hint}`);
  }
  return data;
}

// nomic-embed-text is trained with task prefixes; using them measurably improves retrieval.
const DOC_PREFIX = 'search_document: ';
const QUERY_PREFIX = 'search_query: ';

export const llm = {
  async status() {
    const data = await call('/api/tags', null, 5000);
    const installed = (data.models || []).map((m) => m.name);
    const has = (model) => installed.some((n) => n === model || n === `${model}:latest` || n.split(':')[0] === model);
    const missing = [config.chatModel, config.embedModel].filter((m) => !has(m));
    return { installed, missing, chatModel: config.chatModel, embedModel: config.embedModel };
  },

  async embedDocuments(texts) {
    if (!texts.length) return [];
    const data = await call('/api/embed', { model: config.embedModel, input: texts.map((t) => DOC_PREFIX + t) }, 120000);
    return data.embeddings;
  },

  async embedQuery(text) {
    const data = await call('/api/embed', { model: config.embedModel, input: [QUERY_PREFIX + text] }, 60000);
    return data.embeddings[0];
  },

  async chat(messages) {
    const data = await call('/api/chat', {
      model: config.chatModel,
      messages,
      stream: false,
      // low temperature: we want faithful answers from the notices, not creativity
      options: { temperature: 0.1, num_ctx: 8192 },
    }, 180000); // the first call loads the model into memory, which can take a while
    return data.message?.content?.trim() || '';
  },
};
