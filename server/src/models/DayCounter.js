import mongoose from 'mongoose';

// Atomic per-clinic, per-day token sequence (A-1, A-2, ...). Resets every day.
const dayCounterSchema = new mongoose.Schema({
  clinic: { type: mongoose.Schema.Types.ObjectId, required: true },
  dayKey: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
dayCounterSchema.index({ clinic: 1, dayKey: 1 }, { unique: true });

export const DayCounter = mongoose.model('DayCounter', dayCounterSchema);

export async function nextSeq(clinicId, dayKey) {
  const doc = await DayCounter.findOneAndUpdate(
    { clinic: clinicId, dayKey },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.seq;
}
