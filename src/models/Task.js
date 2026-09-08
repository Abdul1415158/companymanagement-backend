const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        department: {
            type: String,
            default: 'General',
        },
        priority: {
            type: String,
            enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
            default: 'NORMAL',
        },
        status: {
            type: String,
            enum: [
                'OPEN',
                'ASSIGNED',
                'ACKNOWLEDGED',
                'IN_PROGRESS',
                'SUBMITTED',
                'UNDER_REVIEW',
                'REVISION_REQUIRED',
                'RESUBMITTED',
                'APPROVED',
                'DONE',
                'COMPLETED',
                'BLOCKED',
                'CANCELLED',
                'REVIEW',
            ],
            default: 'ASSIGNED',
        },
        dueDate: {
            type: Date,
            default: null,
        },
        submissionNotes: {
            type: String,
            default: '',
        },
        proofUrl: {
            type: String,
            default: '',
        },
        feedback: {
            type: String,
            default: '',
        },
        revisionsCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
