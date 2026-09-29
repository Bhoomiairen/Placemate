import mongoose from 'mongoose';

const criteriaSchema = new mongoose.Schema(
  {
    minCgpa: Number,
    cgpaScale: Number, // 10 or 4
    min10th: Number,
    min12th: Number,
    minDiploma: Number,
    minGradPercent: Number,
    branches: [String], // ["ALL"] = any branch, [] = not specified
    maxActiveBacklogs: Number,
    allowBacklogHistory: { type: Boolean, default: null },
    graduationYears: [Number],
    maxGapYears: Number,
  },
  { _id: false },
);

// Drives are shared: one student adds a notice, everyone in the batch sees it
// with their own eligibility and match score.
const driveSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 160 },
    ctcLpa: Number,
    ctcMaxLpa: Number,
    stipendPerMonth: Number,
    bond: String,
    deadline: Date,
    driveDate: Date,
    criteria: { type: criteriaSchema, default: () => ({}) },
    skills: [String],
    rawText: { type: String, required: true, maxlength: 50000 },
    evidence: mongoose.Schema.Types.Mixed, // which line each field was extracted from
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

driveSchema.index({ deadline: 1 });

export const Drive = mongoose.model('Drive', driveSchema);
