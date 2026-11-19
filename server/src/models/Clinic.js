import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true } }, { _id: true });

const clinicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    department: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    tokenPrefix: { type: String, default: 'A', maxlength: 2 },
    counters: { type: [counterSchema], default: () => [{ name: 'Counter 1' }] },

    // queue behaviour
    isOpen: { type: Boolean, default: true },
    paused: { type: Boolean, default: false },
    pauseMessage: { type: String, default: '' },
    defaultServiceMinutes: { type: Number, default: 8, min: 1, max: 120 },
    alertWhenAhead: { type: Number, default: 3, min: 1, max: 20 },
    maxWaiting: { type: Number, default: 200 },

    // optional geofence for joining from phone
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    joinRadiusKm: { type: Number, default: 0 }, // 0 = anyone can join
  },
  { timestamps: true }
);

clinicSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    department: this.department,
    address: this.address,
    isOpen: this.isOpen,
    paused: this.paused,
    pauseMessage: this.pauseMessage,
    counters: this.counters.map((c) => ({ id: c._id.toString(), name: c.name })),
    needsLocation: this.joinRadiusKm > 0 && this.location?.lat != null,
  };
};

export const Clinic = mongoose.model('Clinic', clinicSchema);
