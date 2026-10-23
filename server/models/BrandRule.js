import mongoose from 'mongoose';

const brandRuleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    category: { type: String, required: true, index: true },
    severity: { type: String, enum: ['high', 'medium', 'low'], required: true },
    text: { type: String, required: true },
    summary: { type: String },
    active: { type: Boolean, default: true },
    version: { type: String, default: 'v1.0' },
    standard: { type: String },
    prohibitedExamples: [{ type: String }],
    compliantExamples: [{ type: String }],
  },
  { timestamps: true }
);

export const BrandRule = mongoose.models.BrandRule || mongoose.model('BrandRule', brandRuleSchema);
