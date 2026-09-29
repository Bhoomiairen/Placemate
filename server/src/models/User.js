import mongoose from 'mongoose';

export const BRANCHES = [
  'CSE', 'IT', 'ECE', 'EEE', 'ECS', 'MECH', 'CIVIL', 'CHEM', 'AI-ML', 'DATA-SCIENCE', 'CSBS', 'MBA-TECH', 'OTHER',
];

const profileSchema = new mongoose.Schema(
  {
    branch: { type: String, enum: BRANCHES },
    cgpa: { type: Number, min: 0, max: 10 },
    cgpaScale: { type: Number, enum: [4, 10], default: 10 },
    tenthPercent: { type: Number, min: 0, max: 100 },
    twelfthPercent: { type: Number, min: 0, max: 100 },
    diplomaPercent: { type: Number, min: 0, max: 100 },
    gradPercentage: { type: Number, min: 0, max: 100 },
    activeBacklogs: { type: Number, min: 0, default: 0 },
    backlogHistory: { type: Boolean, default: false },
    graduationYear: { type: Number, min: 2000, max: 2100 },
    gapYears: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const resumeSchema = new mongoose.Schema(
  {
    fileName: String,
    text: String,
    skills: [String], // includes implied skills (Spring Boot -> Java)
    skillsStated: [String], // exactly what the resume says
    skillsByCategory: mongoose.Schema.Types.Mixed,
    links: [String],
    ats: mongoose.Schema.Types.Mixed,
    uploadedAt: Date,
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    profile: { type: profileSchema, default: () => ({}) },
    resume: { type: resumeSchema, default: null },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  const resume = this.resume
    ? {
        fileName: this.resume.fileName,
        skills: this.resume.skills,
        skillsStated: this.resume.skillsStated,
        skillsByCategory: this.resume.skillsByCategory,
        links: this.resume.links,
        ats: this.resume.ats,
        uploadedAt: this.resume.uploadedAt,
      }
    : null;
  return { id: this._id, name: this.name, email: this.email, profile: this.profile, resume, createdAt: this.createdAt };
};

export const User = mongoose.model('User', userSchema);
