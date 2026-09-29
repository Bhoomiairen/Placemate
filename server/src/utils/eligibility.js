/**
 * Eligibility check: compares a student's profile with a drive's criteria.
 *
 * Returns one row per criterion so the UI can show a clear table:
 *   { key, label, required, yours, pass: true | false | null, note }
 * pass = null means "can't tell" (the student hasn't filled that part of the profile).
 *
 * Overall status:
 *   not_eligible  -> at least one criterion fails
 *   incomplete    -> nothing fails, but some profile data is missing
 *   eligible      -> every stated criterion passes
 */

export const BRANCH_LABELS = {
  CSE: 'Computer Science / Computer Engg.',
  IT: 'Information Technology',
  ECE: 'Electronics & Telecom (EXTC / ECE)',
  EEE: 'Electrical',
  ECS: 'Electronics & Computer Science',
  MECH: 'Mechanical',
  CIVIL: 'Civil',
  CHEM: 'Chemical',
  'AI-ML': 'AI & ML / AI & DS',
  'DATA-SCIENCE': 'Data Science',
  CSBS: 'CS & Business Systems',
  'MBA-TECH': 'MBA Tech',
  OTHER: 'Other',
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Convert a CGPA to the 10-point scale. Linear conversion - an approximation, and the UI says so. */
export function toTenScale(value, scale) {
  return scale === 4 ? (value / 4) * 10 : value;
}

export function checkEligibility(profile = {}, criteria = {}) {
  const rows = [];
  const add = (row) => rows.push({ note: null, ...row });
  const p = profile || {};
  const c = criteria || {};

  // CGPA
  if (isNum(c.minCgpa)) {
    const reqScale = c.cgpaScale || (c.minCgpa <= 4 ? 4 : 10);
    const required = `${c.minCgpa} / ${reqScale}`;
    if (!isNum(p.cgpa)) {
      add({ key: 'cgpa', label: 'CGPA', required, yours: null, pass: null });
    } else {
      const myScale = p.cgpaScale || 10;
      let pass;
      let note = null;
      if (myScale === reqScale) {
        pass = p.cgpa >= c.minCgpa;
      } else {
        const mine10 = toTenScale(p.cgpa, myScale);
        const req10 = toTenScale(c.minCgpa, reqScale);
        pass = mine10 >= req10;
        note = `Converted to a 10-point scale (${round(mine10)} vs ${round(req10)}). Conversion is approximate - confirm with the placement cell if it is close.`;
      }
      add({ key: 'cgpa', label: 'CGPA', required, yours: `${p.cgpa} / ${myScale}`, pass, note });
    }
  }

  // 10th
  if (isNum(c.min10th)) {
    add({
      key: 'tenth', label: '10th %', required: `${c.min10th}%`,
      yours: isNum(p.tenthPercent) ? `${p.tenthPercent}%` : null,
      pass: isNum(p.tenthPercent) ? p.tenthPercent >= c.min10th : null,
    });
  }

  // 12th or Diploma
  const min12 = isNum(c.min12th) ? c.min12th : null;
  const minDip = isNum(c.minDiploma) ? c.minDiploma : min12;
  if (min12 !== null || minDip !== null) {
    if (isNum(p.twelfthPercent) && min12 !== null) {
      add({ key: 'twelfth', label: '12th %', required: `${min12}%`, yours: `${p.twelfthPercent}%`, pass: p.twelfthPercent >= min12 });
    } else if (isNum(p.diplomaPercent) && minDip !== null) {
      add({ key: 'twelfth', label: 'Diploma %', required: `${minDip}%`, yours: `${p.diplomaPercent}%`, pass: p.diplomaPercent >= minDip });
    } else {
      add({ key: 'twelfth', label: '12th / Diploma %', required: `${min12 ?? minDip}%`, yours: null, pass: null });
    }
  }

  // Graduation percentage
  if (isNum(c.minGradPercent)) {
    if (isNum(p.gradPercentage)) {
      add({ key: 'grad', label: 'Graduation %', required: `${c.minGradPercent}%`, yours: `${p.gradPercentage}%`, pass: p.gradPercentage >= c.minGradPercent });
    } else if (isNum(p.cgpa)) {
      const estimate = round(toTenScale(p.cgpa, p.cgpaScale || 10) * 10, 1);
      add({
        key: 'grad', label: 'Graduation %', required: `${c.minGradPercent}%`, yours: `~${estimate}%`,
        pass: estimate >= c.minGradPercent,
        note: 'Estimated from your CGPA (CGPA x 10). Add your exact graduation % in your profile if your university gives one.',
      });
    } else {
      add({ key: 'grad', label: 'Graduation %', required: `${c.minGradPercent}%`, yours: null, pass: null });
    }
  }

  // Branch
  const branches = Array.isArray(c.branches) ? c.branches : [];
  if (branches.length && !branches.includes('ALL')) {
    add({
      key: 'branch', label: 'Branch', required: branches.join(', '), yours: p.branch || null,
      pass: p.branch ? branches.includes(p.branch) : null,
    });
  }

  // Backlogs
  if (isNum(c.maxActiveBacklogs)) {
    const mine = isNum(p.activeBacklogs) ? p.activeBacklogs : 0;
    add({
      key: 'activeBacklogs', label: 'Active backlogs',
      required: c.maxActiveBacklogs === 0 ? 'None' : `At most ${c.maxActiveBacklogs}`,
      yours: String(mine), pass: mine <= c.maxActiveBacklogs,
    });
  }
  if (c.allowBacklogHistory === false) {
    add({
      key: 'backlogHistory', label: 'Backlog history', required: 'Never had a backlog',
      yours: p.backlogHistory ? 'Had backlogs' : 'Clean', pass: !p.backlogHistory,
    });
  }

  // Batch
  const years = Array.isArray(c.graduationYears) ? c.graduationYears : [];
  if (years.length) {
    add({
      key: 'batch', label: 'Batch', required: years.join(' / '), yours: p.graduationYear ? String(p.graduationYear) : null,
      pass: p.graduationYear ? years.includes(p.graduationYear) : null,
    });
  }

  // Education gap
  if (isNum(c.maxGapYears)) {
    const mine = isNum(p.gapYears) ? p.gapYears : 0;
    add({
      key: 'gap', label: 'Education gap', required: c.maxGapYears === 0 ? 'No gap' : `At most ${c.maxGapYears} year(s)`,
      yours: `${mine} year(s)`, pass: mine <= c.maxGapYears,
    });
  }

  const failed = rows.filter((r) => r.pass === false);
  const unknown = rows.filter((r) => r.pass === null);
  const status = failed.length ? 'not_eligible' : unknown.length ? 'incomplete' : 'eligible';
  const reasons = failed.map((r) => `${r.label}: need ${r.required}, you have ${r.yours}`);
  const missing = unknown.map((r) => r.label);

  return { status, rows, reasons, failedKeys: failed.map((r) => r.key), missing };
}
