const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
    {
        reportId: {
            type: String,
            default: () => `DWR-${Date.now().toString().slice(-6)}`,
            unique: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        userName: {
            type: String,
            default: '',
        },
        department: {
            type: String,
            default: 'General',
        },
        date: {
            type: String, // YYYY-MM-DD
            required: true,
        },
        taskTitle: {
            type: String,
            required: true,
            trim: true,
        },
        workSlot: {
            type: String,
            default: 'General Hours',
            trim: true,
        },
        workCompleted: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            default: '',
        },
        proofUrl: {
            type: String,
            default: '',
        },
        screenshotUrl: {
            type: String,
            default: '',
        },
        blockers: {
            type: String,
            default: '',
        },
        nextAction: {
            type: String,
            default: '',
        },
        hrRecorded: {
            type: Boolean,
            default: false,
        },
        hrRecordedAt: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ['RECORDED', 'PENDING_REVIEW', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED'],
            default: 'PENDING_REVIEW',
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        reviewerName: {
            type: String,
            default: '',
        },
        reviewComments: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('DailyReport', dailyReportSchema);
