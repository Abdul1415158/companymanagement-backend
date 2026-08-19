const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
    },
    positionApplied: {
      type: String,
      default: 'General',
      trim: true,
    },
    roleApplied: {
      type: String,
      default: 'General',
      trim: true,
    },
    source: {
      type: String,
      default: 'Website',
    },
    status: {
      type: String,
      enum: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED'],
      default: 'APPLIED',
    },
    portalAccess: {
      type: String,
      enum: ['NOT_INVITED', 'INVITATION_SENT', 'ACTIVE'],
      default: 'NOT_INVITED',
    },
    invitationToken: {
      type: String,
      default: null,
    },
    invitationExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Pre-save hook to keep positionApplied and roleApplied synchronized
candidateSchema.pre('save', function (next) {
  if (this.positionApplied && !this.roleApplied) {
    this.roleApplied = this.positionApplied;
  } else if (this.roleApplied && !this.positionApplied) {
    this.positionApplied = this.roleApplied;
  }
  next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
