import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { pdfUpload } from '../middleware/upload.js';
import { Application, APPLICATION_STATUSES } from '../models/Application.js';
import { Drive } from '../models/Drive.js';
import { BRANCHES } from '../models/User.js';
import { buildDriveViews } from '../services/driveView.js';
import { nlp } from '../services/nlp.js';
import { indexDriveInBackground, removeDrive } from '../services/rag.js';

const router = Router();
router.use(requireAuth);

const num = z.number().finite().nullable().optional();
const dateString = z
  .string()
  .nullable()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date');

const driveSchema = z.object({
  company: z.string().trim().min(1, 'Company name is required').max(120),
  role: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  ctcLpa: num,
  ctcMaxLpa: num,
  stipendPerMonth: num,
  bond: z.string().trim().max(60).nullable().optional(),
  deadline: dateString,
  driveDate: dateString,
  criteria: z
    .object({
      minCgpa: z.number().min(0).max(10).nullable().optional(),
      cgpaScale: z.union([z.literal(4), z.literal(10)]).nullable().optional(),
      min10th: z.number().min(0).max(100).nullable().optional(),
      min12th: z.number().min(0).max(100).nullable().optional(),
      minDiploma: z.number().min(0).max(100).nullable().optional(),
      minGradPercent: z.number().min(0).max(100).nullable().optional(),
      branches: z.array(z.enum([...BRANCHES, 'ALL'])).optional(),
      maxActiveBacklogs: z.number().int().min(0).max(20).nullable().optional(),
      allowBacklogHistory: z.boolean().nullable().optional(),
      graduationYears: z.array(z.number().int().min(2000).max(2100)).optional(),
      maxGapYears: z.number().int().min(0).max(20).nullable().optional(),
    })
    .default({}),
  skills: z.array(z.string().trim().min(1).max(60)).max(60).optional(),
  rawText: z.string().trim().min(20, 'Paste the full notice text').max(50000),
  evidence: z.record(z.string(), z.string()).optional(),
});

function toDoc(data) {
  return {
    ...data,
    deadline: data.deadline ? new Date(data.deadline) : null,
    driveDate: data.driveDate ? new Date(data.driveDate) : null,
  };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Step 1 of adding a drive: extract fields from pasted text or an uploaded PDF.
 * Nothing is saved - the student reviews/edits the fields, then POSTs /api/drives.
 */
router.post('/parse', pdfUpload, async (req, res) => {
  let parsed;
  if (req.file) {
    parsed = await nlp.parseNoticeFile(req.file);
  } else {
    const text = String(req.body?.text || '');
    if (text.trim().length < 20) throw new HttpError(400, 'Paste the full drive notice text, or upload the PDF.');
    parsed = await nlp.parseNoticeText(text);
  }
  // Classmates share one board, so warn if this company was already added recently.
  let possibleDuplicates = [];
  if (parsed.company) {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const core = parsed.company.replace(/\b(?:pvt|private|ltd|limited|inc|llp|corp|co)\b\.?/gi, '').replace(/[\s.,]+$/, '').trim();
    possibleDuplicates = await Drive.find({ company: new RegExp(`^${escapeRegex(core)}`, 'i'), createdAt: { $gte: since } })
      .select('company role deadline createdAt')
      .limit(5)
      .lean();
  }
  res.json({ draft: parsed, possibleDuplicates: possibleDuplicates.map((d) => ({ id: d._id, company: d.company, role: d.role, deadline: d.deadline })) });
});

// Step 2: save the reviewed drive.
router.post('/', async (req, res) => {
  const data = driveSchema.parse(req.body);
  const drive = await Drive.create({ ...toDoc(data), createdBy: req.user._id });
  indexDriveInBackground(drive); // make it searchable by Ask PlaceMate
  const { views } = await buildDriveViews(req.user, [drive], { includeRawText: true });
  res.status(201).json({ drive: views[0] });
});

// List all drives with this student's eligibility + match score.
router.get('/', async (req, res) => {
  const { status = 'all', sort = 'deadline', q = '', includeClosed = 'false' } = req.query;
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), 'i');
    filter.$or = [{ company: rx }, { role: rx }];
  }
  const drives = await Drive.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  let { views, matchError, hasResume } = await buildDriveViews(req.user, drives);

  if (includeClosed !== 'true') views = views.filter((v) => !v.isClosed);
  if (status !== 'all') views = views.filter((v) => v.eligibility.status === status);

  const far = Number.MAX_SAFE_INTEGER;
  const sorters = {
    deadline: (a, b) => (a.deadline ? new Date(a.deadline).getTime() : far) - (b.deadline ? new Date(b.deadline).getTime() : far),
    match: (a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1) || (b.match?.textScore ?? 0) - (a.match?.textScore ?? 0),
    ctc: (a, b) => (b.ctcLpa ?? -1) - (a.ctcLpa ?? -1),
    recent: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  };
  views.sort(sorters[sort] || sorters.deadline);
  res.json({ drives: views, matchError, hasResume });
});

router.get('/:id', async (req, res) => {
  const drive = await Drive.findById(req.params.id).lean();
  if (!drive) throw new HttpError(404, 'Drive not found.');
  const { views, matchError, hasResume } = await buildDriveViews(req.user, [drive], { includeRawText: true });
  res.json({ drive: views[0], matchError, hasResume });
});

async function findOwnDrive(req) {
  const drive = await Drive.findById(req.params.id);
  if (!drive) throw new HttpError(404, 'Drive not found.');
  if (String(drive.createdBy) !== String(req.user._id)) throw new HttpError(403, 'Only the student who added this drive can change it.');
  return drive;
}

router.put('/:id', async (req, res) => {
  const drive = await findOwnDrive(req);
  drive.set(toDoc(driveSchema.parse(req.body)));
  await drive.save();
  indexDriveInBackground(drive);
  const { views } = await buildDriveViews(req.user, [drive], { includeRawText: true });
  res.json({ drive: views[0] });
});

router.delete('/:id', async (req, res) => {
  const drive = await findOwnDrive(req);
  await Application.deleteMany({ drive: drive._id });
  await drive.deleteOne();
  await removeDrive(drive._id);
  res.json({ ok: true });
});

// Track this student's progress on the drive (applied, test, interview, offer...).
const applicationSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  notes: z.string().max(2000).optional(),
});

router.put('/:id/application', async (req, res) => {
  const { status, notes } = applicationSchema.parse(req.body);
  if (!(await Drive.exists({ _id: req.params.id }))) throw new HttpError(404, 'Drive not found.');
  const app = await Application.findOneAndUpdate(
    { user: req.user._id, drive: req.params.id },
    { $set: { status, ...(notes !== undefined && { notes }) } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  res.json({ application: { status: app.status, notes: app.notes, updatedAt: app.updatedAt } });
});

router.delete('/:id/application', async (req, res) => {
  await Application.deleteOne({ user: req.user._id, drive: req.params.id });
  res.json({ ok: true });
});

export default router;
