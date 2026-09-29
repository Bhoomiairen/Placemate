import { Router } from 'express';
import { HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { pdfUpload } from '../middleware/upload.js';
import { ResumeVersion } from '../models/ResumeVersion.js';
import { nlp } from '../services/nlp.js';

const router = Router();
router.use(requireAuth);

// Upload (or replace) the resume: the NLP service extracts text, skills and runs the ATS check.
router.post('/', pdfUpload, async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a PDF file to upload.');
  const parsed = await nlp.parseResume(req.file);

  req.user.resume = {
    fileName: req.file.originalname,
    text: parsed.text,
    skills: parsed.skills,
    skillsStated: parsed.skillsStated,
    skillsByCategory: parsed.skillsByCategory,
    links: parsed.links,
    ats: parsed.ats,
    uploadedAt: new Date(),
  };
  await req.user.save();
  await ResumeVersion.create({
    user: req.user._id,
    fileName: req.file.originalname,
    atsScore: parsed.ats.score,
    skillCount: parsed.skills.length,
    issueCount: parsed.ats.issues.length,
  });
  res.status(201).json({ user: req.user.toPublic() });
});

router.get('/', (req, res) => {
  res.json({ resume: req.user.toPublic().resume });
});

router.get('/history', async (req, res) => {
  const history = await ResumeVersion.find({ user: req.user._id }).sort({ createdAt: 1 }).limit(50).lean();
  res.json({ history: history.map((h) => ({ fileName: h.fileName, atsScore: h.atsScore, skillCount: h.skillCount, issueCount: h.issueCount, uploadedAt: h.createdAt })) });
});

router.delete('/', async (req, res) => {
  req.user.resume = null;
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

export default router;
