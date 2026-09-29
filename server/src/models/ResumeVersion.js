import mongoose from 'mongoose';

// A small record per upload so the dashboard can chart how the ATS score improves.
const resumeVersionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName: String,
    atsScore: Number,
    skillCount: Number,
    issueCount: Number,
  },
  { timestamps: true },
);

export const ResumeVersion = mongoose.model('ResumeVersion', resumeVersionSchema);
