import mongoose from 'mongoose';

export const APPLICATION_STATUSES = ['interested', 'applied', 'test', 'interview', 'offer', 'rejected', 'not_interested'];

// One student's progress on one drive.
const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    drive: { type: mongoose.Schema.Types.ObjectId, ref: 'Drive', required: true },
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true },
);

applicationSchema.index({ user: 1, drive: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
