import mongoose from 'mongoose';

const revisionSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    text: { type: String, required: true },
    note: { type: String },
    fixedRule: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const draftSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    submitter: { type: String, default: 'Alex Rivera (Creator)' },
    status: {
      type: String,
      enum: ['Draft', 'In review', 'Changes requested', 'Approved', 'Rejected'],
      default: 'In review',
    },
    currentVersion: { type: String, default: 'v2' },
    currentText: { type: String, required: true },
    revisions: [revisionSchema],
  },
  { timestamps: true }
);

export const Draft = mongoose.models.Draft || mongoose.model('Draft', draftSchema);
