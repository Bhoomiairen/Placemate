import mongoose from 'mongoose';

// A piece of a drive notice plus its embedding vector, used by Ask PlaceMate to find
// the notice text that answers a question. Rebuilt whenever a drive is added or edited.
const driveChunkSchema = new mongoose.Schema(
  {
    drive: { type: mongoose.Schema.Types.ObjectId, ref: 'Drive', required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    model: { type: String, required: true }, // which embedding model produced the vector
  },
  { timestamps: true },
);

export const DriveChunk = mongoose.model('DriveChunk', driveChunkSchema);
