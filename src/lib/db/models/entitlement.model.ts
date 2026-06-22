import mongoose, { Schema, Document } from "mongoose";

export interface IEntitlement extends Document {
  user_account_id: string;
  occurrence: number;
  limits: Record<string, number | boolean>;
  usage: Record<string, number>;
  period_start: Date;
  period_end: Date;
  updated_at: Date;
}

const EntitlementSchema = new Schema<IEntitlement>(
  {
    user_account_id: { type: String, required: true, index: true, unique: true },
    occurrence: { type: Number, default: 0 },
    limits: { type: Schema.Types.Mixed, default: {} },
    usage: { type: Schema.Types.Mixed, default: {} },
    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "entitlements", timestamps: false }
);

export const Entitlement =
  mongoose.models.Entitlement ||
  mongoose.model<IEntitlement>("Entitlement", EntitlementSchema);
