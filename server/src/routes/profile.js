import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { BRANCHES } from '../models/User.js';

const router = Router();
router.use(requireAuth);

const percent = z.number().min(0).max(100).nullable().optional();

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    branch: z.enum(BRANCHES).nullable().optional(),
    cgpa: z.number().min(0).max(10).nullable().optional(),
    cgpaScale: z.union([z.literal(4), z.literal(10)]).optional(),
    tenthPercent: percent,
    twelfthPercent: percent,
    diplomaPercent: percent,
    gradPercentage: percent,
    activeBacklogs: z.number().int().min(0).max(50).optional(),
    backlogHistory: z.boolean().optional(),
    graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
    gapYears: z.number().int().min(0).max(20).optional(),
  })
  .refine((p) => !(p.cgpaScale === 4 && p.cgpa > 4), { message: 'CGPA cannot be above 4 on a 4-point scale', path: ['cgpa'] });

router.get('/', (req, res) => {
  res.json({ profile: req.user.profile });
});

router.put('/', async (req, res) => {
  const { name, ...fields } = profileSchema.parse(req.body);
  if (name) req.user.name = name;
  for (const [key, value] of Object.entries(fields)) {
    req.user.profile[key] = value === null ? undefined : value;
  }
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

export default router;
