import { Application } from '../models/Application.js';
import { checkEligibility } from '../utils/eligibility.js';
import { nlp } from './nlp.js';

/**
 * Turn raw Drive documents into what one student sees:
 * the drive + their eligibility + their resume match score + their application status.
 */
export async function buildDriveViews(user, drives, { includeRawText = false } = {}) {
  const ids = drives.map((d) => d._id);
  const applications = await Application.find({ user: user._id, drive: { $in: ids } }).lean();
  const appByDrive = new Map(applications.map((a) => [String(a.drive), a]));

  let matches = {};
  let matchError = null;
  if (user.resume?.text && drives.length) {
    try {
      const items = drives.map((d) => ({ id: String(d._id), text: d.rawText, skills: d.skills?.length ? d.skills : undefined }));
      matches = (await nlp.matchBatch(user.resume.text, user.resume.skills, items)).results || {};
    } catch (err) {
      // The list still works without scores if the NLP service is down.
      matchError = err.message;
    }
  }

  const now = new Date();
  const views = drives.map((d) => {
    const id = String(d._id);
    const app = appByDrive.get(id);
    const view = {
      id,
      company: d.company,
      role: d.role,
      location: d.location,
      ctcLpa: d.ctcLpa,
      ctcMaxLpa: d.ctcMaxLpa,
      stipendPerMonth: d.stipendPerMonth,
      bond: d.bond,
      deadline: d.deadline,
      driveDate: d.driveDate,
      criteria: d.criteria,
      skills: d.skills,
      createdAt: d.createdAt,
      isClosed: Boolean(d.deadline && d.deadline < now),
      canEdit: String(d.createdBy) === String(user._id),
      eligibility: checkEligibility(user.profile, d.criteria),
      match: matches[id] || null,
      application: app ? { status: app.status, notes: app.notes, updatedAt: app.updatedAt } : null,
    };
    if (includeRawText) {
      view.rawText = d.rawText;
      view.evidence = d.evidence;
    }
    return view;
  });
  return { views, matchError, hasResume: Boolean(user.resume?.text) };
}
