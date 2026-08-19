const mongoose = require('mongoose');

const managerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        department: {
            type: String,
            required: true,
        },
        teamMembers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        approvalsPending: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Manager', managerSchema);
