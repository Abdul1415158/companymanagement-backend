const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
    {
        interviewId: {
            type: String,
            default: () => `INT-${Date.now().toString().slice(-6)}`,
            unique: true,
        },
        candidateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Candidate',
            default: null,
        },
        candidateName: {
            type: String,
            required: true,
            trim: true,
        },
        candidateEmail: {
            type: String,
            default: '',
            trim: true,
        },
        position: {
            type: String,
            required: true,
            trim: true,
        },
        interviewType: {
            type: String,
            enum: ['Initial HR Screening', 'Technical Assessment', 'Managerial / Leadership', 'Final Committee / Executive'],
            default: 'Technical Assessment',
        },
        date: {
            type: String, // YYYY-MM-DD
            required: true,
        },
        time: {
            type: String, // HH:MM AM/PM
            required: true,
        },
        platform: {
            type: String,
            enum: ['Google Meet', 'Zoom', 'Microsoft Teams', 'On-Site Office', 'Phone Call'],
            default: 'Google Meet',
        },
        meetingLink: {
            type: String,
            default: '',
        },
        interviewers: [
            {
                type: String,
                trim: true,
            },
        ],
        status: {
            type: String,
            enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'],
            default: 'SCHEDULED',
        },
        technicalRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
        communicationRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
        problemSolvingRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
        culturalFitRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
        overallRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
        recommendation: {
            type: String,
            enum: ['STRONG_HIRE', 'HIRE', 'HOLD', 'REJECT', 'PENDING'],
            default: 'PENDING',
        },
        feedbackNotes: {
            type: String,
            default: '',
        },
        finalDecisionBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Interview', interviewSchema);
