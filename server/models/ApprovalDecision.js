import mongoose from 'mongoose';

const approvalDecisionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    draftId: { type: String, required: true, index: true },
    reviewer: { type: String, required: true },
    decision: {
      type: String,
      enum: ['Approved', 'Changes requested', 'Rejected'],
      required: true,
    },
    comment: { type: String, required: true },
    version: { type: String, required: true },
  },
  { timestamps: true }
);

export const ApprovalDecision =
  mongoose.models.ApprovalDecision || mongoose.model('ApprovalDecision', approvalDecisionSchema);
