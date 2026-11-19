import mongoose from 'mongoose';

const TOKEN_STATUS = ['waiting', 'serving', 'done', 'no_show', 'cancelled'];

const notificationSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['issued', 'near', 'called'], required: true },
    channel: String,
    ok: Boolean,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const tokenSchema = new mongoose.Schema(
  {
    clinic: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    dayKey: { type: String, required: true }, // YYYY-MM-DD in clinic timezone
    seq: { type: Number, required: true },
    number: { type: String, required: true }, // e.g. "A-12"

    name: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, default: '' },
    source: { type: String, enum: ['online', 'walk_in'], default: 'online' },
    priority: { type: Boolean, default: false }, // senior citizen / emergency
    accessKey: { type: String, required: true, select: false }, // lets the patient cancel

    status: { type: String, enum: TOKEN_STATUS, default: 'waiting', index: true },
    sortAt: { type: Date, default: Date.now }, // queue order (can move on re-queue)
    counter: { type: mongoose.Schema.Types.ObjectId, default: null },
    counterName: { type: String, default: '' },

    issuedAt: { type: Date, default: Date.now },
    calledAt: Date,
    completedAt: Date,
    serviceMs: Number,

    notifications: { type: [notificationSchema], default: [] },
  },
  { timestamps: true }
);

tokenSchema.index({ clinic: 1, dayKey: 1, status: 1, priority: -1, sortAt: 1 });
tokenSchema.index({ clinic: 1, dayKey: 1, seq: 1 }, { unique: true });

export const Token = mongoose.model('Token', tokenSchema);
