import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema(
  {
    clinic: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'receptionist'], default: 'receptionist' },
  },
  { timestamps: true }
);

staffSchema.methods.checkPassword = function checkPassword(pw) {
  return bcrypt.compare(pw, this.passwordHash);
};

staffSchema.statics.hashPassword = (pw) => bcrypt.hash(pw, 10);

staffSchema.methods.toSafe = function toSafe() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    clinic: this.clinic.toString(),
  };
};

export const Staff = mongoose.model('Staff', staffSchema);
