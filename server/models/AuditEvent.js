import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    actor: { type: String, required: true },
    action: { type: String, required: true },
    from: { type: String },
    to: { type: String },
    comment: { type: String },
    time: { type: String },
  },
  { timestamps: true }
);

export const AuditEvent =
  mongoose.models.AuditEvent || mongoose.model('AuditEvent', auditEventSchema);
