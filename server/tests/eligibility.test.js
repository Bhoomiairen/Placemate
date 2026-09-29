import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkEligibility, toTenScale } from '../src/utils/eligibility.js';

const student = { branch: 'CSE', cgpa: 7.8, cgpaScale: 10, tenthPercent: 88, twelfthPercent: 64, activeBacklogs: 0, backlogHistory: false, graduationYear: 2027, gapYears: 0 };

test('eligible when every criterion passes', () => {
  const r = checkEligibility(student, { minCgpa: 7, cgpaScale: 10, min10th: 60, min12th: 60, branches: ['CSE', 'IT'], maxActiveBacklogs: 0, graduationYears: [2027] });
  assert.equal(r.status, 'eligible');
  assert.equal(r.rows.length, 6);
});

test('not eligible with a clear reason', () => {
  const r = checkEligibility(student, { min12th: 65 });
  assert.equal(r.status, 'not_eligible');
  assert.deepEqual(r.failedKeys, ['twelfth']);
  assert.match(r.reasons[0], /12th %: need 65%, you have 64%/);
});

test('branch "ALL" and empty criteria never block', () => {
  assert.equal(checkEligibility(student, { branches: ['ALL'] }).status, 'eligible');
  assert.equal(checkEligibility(student, {}).status, 'eligible');
});

test('missing profile data -> incomplete, not a false rejection', () => {
  const r = checkEligibility({ branch: 'CSE' }, { minCgpa: 7, min10th: 60 });
  assert.equal(r.status, 'incomplete');
  assert.deepEqual(r.missing, ['CGPA', '10th %']);
});

test('4-point CGPA is compared on the same scale when possible, converted otherwise', () => {
  const nmims = { ...student, cgpa: 3.3, cgpaScale: 4 };
  assert.equal(checkEligibility(nmims, { minCgpa: 3.0, cgpaScale: 4 }).status, 'eligible');
  const converted = checkEligibility(nmims, { minCgpa: 8.5, cgpaScale: 10 });
  assert.equal(converted.status, 'not_eligible'); // 3.3/4 = 8.25/10
  assert.ok(converted.rows[0].note.includes('approximate'));
  assert.equal(toTenScale(3, 4), 7.5);
});

test('diploma students are checked against the diploma cut-off', () => {
  const diploma = { ...student, twelfthPercent: undefined, diplomaPercent: 70 };
  const r = checkEligibility(diploma, { min12th: 60, minDiploma: 65 });
  assert.equal(r.status, 'eligible');
  assert.equal(r.rows[0].label, 'Diploma %');
});

test('backlog rules', () => {
  const withHistory = { ...student, backlogHistory: true };
  assert.equal(checkEligibility(withHistory, { maxActiveBacklogs: 0 }).status, 'eligible');
  assert.equal(checkEligibility(withHistory, { allowBacklogHistory: false }).status, 'not_eligible');
  assert.equal(checkEligibility({ ...student, activeBacklogs: 2 }, { maxActiveBacklogs: 1 }).status, 'not_eligible');
});

test('graduation % is estimated from CGPA when not given', () => {
  const r = checkEligibility(student, { minGradPercent: 60 });
  assert.equal(r.status, 'eligible');
  assert.equal(r.rows[0].yours, '~78%');
});
