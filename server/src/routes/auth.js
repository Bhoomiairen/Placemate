import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { HttpError } from '../middleware/error.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = Router();

// Slow down password guessing: 20 attempts per 15 minutes per IP.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } });

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists.');
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email });
  // Same message for "no such user" and "wrong password" so emails can't be probed.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Incorrect email or password.');
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
