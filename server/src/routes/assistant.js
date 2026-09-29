import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { ask, status } from '../services/rag.js';

const router = Router();
router.use(requireAuth);

// A local model is slow-ish; stop one user from queueing dozens of questions.
const askLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: 'Too many questions in a minute. Give it a moment.' },
});

const askSchema = z.object({
  question: z.string().trim().min(3, 'Ask a question').max(500, 'Keep the question under 500 characters'),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(12).optional(),
});

router.get('/status', async (req, res) => {
  res.json(await status());
});

router.post('/ask', askLimiter, async (req, res) => {
  const { question, history } = askSchema.parse(req.body);
  res.json(await ask(req.user, question, history || []));
});

export default router;
