import mongoose from 'mongoose';

const reviewFindingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    draftId: { type: String, required: true, index: true },
    version: { type: String, required: true },
    ruleId: { type: String, required: true },
    category: { type: String, required: true },
    severity: { type: String, enum: ['high', 'medium', 'low'], required: true },
    quoted_text: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    explanation: { type: String, required: true },
    evidence_status: {
      type: String,
      enum: ['rule_match', 'verified_fact', 'not_enough_information'],
      default: 'rule_match',
    },
    human_review_required: { type: Boolean, default: false },
    suggested_revision: { type: String },
    status: {
      type: String,
      enum: ['active', 'dismissed', 'accepted'],
      default: 'active',
    },
    dismissReason: { type: String },
  },
  { timestamps: true }
);

export const ReviewFinding =
  mongoose.models.ReviewFinding || mongoose.model('ReviewFinding', reviewFindingSchema);
