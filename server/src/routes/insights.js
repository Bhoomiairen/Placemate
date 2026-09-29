import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Drive } from '../models/Drive.js';
import { ResumeVersion } from '../models/ResumeVersion.js';
import { buildDriveViews } from '../services/driveView.js';

const router = Router();
router.use(requireAuth);

const DAY = 24 * 3600 * 1000;

/**
 * Dashboard data. The key feature is the skill gap ACROSS drives:
 * "6 of the 9 drives you're eligible for ask for Docker, and your resume doesn't show it."
 */
router.get('/', async (req, res) => {
  const drives = await Drive.find({}).sort({ deadline: 1 }).limit(500).lean();
  const { views, matchError, hasResume } = await buildDriveViews(req.user, drives);
  const open = views.filter((v) => !v.isClosed);
  const now = Date.now();

  const byStatus = { eligible: 0, not_eligible: 0, incomplete: 0 };
  for (const v of open) byStatus[v.eligibility.status] += 1;

  // Skills missing from the resume, counted over open drives the student can actually apply to.
  const target = open.filter((v) => v.eligibility.status !== 'not_eligible' && v.match);
  const gapCount = new Map();
  for (const v of target) for (const s of v.match.missingSkills) gapCount.set(s, (gapCount.get(s) || 0) + 1);
  const skillGaps = [...gapCount.entries()]
    .map(([skill, count]) => ({ skill, count, share: Math.round((count / target.length) * 100) }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, 10);

  // Why the student is being filtered out.
  const reasonLabels = { cgpa: 'CGPA', tenth: '10th %', twelfth: '12th / Diploma %', grad: 'Graduation %', branch: 'Branch', activeBacklogs: 'Active backlogs', backlogHistory: 'Backlog history', batch: 'Batch', gap: 'Education gap' };
  const reasonCount = new Map();
  for (const v of open) for (const k of v.eligibility.failedKeys) reasonCount.set(k, (reasonCount.get(k) || 0) + 1);
  const notEligibleReasons = [...reasonCount.entries()]
    .map(([key, count]) => ({ key, label: reasonLabels[key] || key, count }))
    .sort((a, b) => b.count - a.count);

  const upcomingDeadlines = open
    .filter((v) => v.deadline && new Date(v.deadline).getTime() - now < 7 * DAY && v.eligibility.status !== 'not_eligible')
    .filter((v) => !['applied', 'test', 'interview', 'offer', 'rejected', 'not_interested'].includes(v.application?.status))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 6)
    .map(pick);

  const bestMatches = open
    .filter((v) => v.eligibility.status !== 'not_eligible' && v.match?.score != null)
    .sort((a, b) => b.match.score - a.match.score || b.match.textScore - a.match.textScore)
    .slice(0, 5)
    .map(pick);

  const applicationCounts = {};
  for (const v of views) if (v.application) applicationCounts[v.application.status] = (applicationCounts[v.application.status] || 0) + 1;

  const history = await ResumeVersion.find({ user: req.user._id }).sort({ createdAt: 1 }).limit(20).lean();

  res.json({
    hasResume,
    matchError,
    profileComplete: Boolean(req.user.profile?.branch && req.user.profile?.cgpa != null && req.user.profile?.graduationYear),
    totals: { openDrives: open.length, ...byStatus, applied: views.filter((v) => v.application && !['interested', 'not_interested'].includes(v.application.status)).length },
    skillGaps,
    targetDriveCount: target.length,
    notEligibleReasons,
    upcomingDeadlines,
    bestMatches,
    applicationCounts,
    atsScore: req.user.resume?.ats?.score ?? null,
    resumeHistory: history.map((h) => ({ atsScore: h.atsScore, uploadedAt: h.createdAt })),
  });
});

function pick(v) {
  return { id: v.id, company: v.company, role: v.role, deadline: v.deadline, ctcLpa: v.ctcLpa, score: v.match?.score ?? null, eligibility: v.eligibility.status, application: v.application?.status || null };
}

export default router;
