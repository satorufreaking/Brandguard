import mongoose from 'mongoose';

const approvedFactSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    value: { type: String, required: true },
    source: { type: String, required: true },
    validUntil: { type: String, required: true },
  },
  { timestamps: true }
);

export const ApprovedFact = mongoose.models.ApprovedFact || mongoose.model('ApprovedFact', approvedFactSchema);
