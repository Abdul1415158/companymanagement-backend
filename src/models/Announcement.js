const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
    {
        announcementId: {
            type: String,
            default: () => `ANN-${Date.now().toString().slice(-6)}`,
            unique: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
        },
        audience: {
            type: String,
            enum: ['ALL', 'Engineering', 'Marketing', 'Operations', 'Management', 'Interns'],
            default: 'ALL',
        },
        priority: {
            type: String,
            enum: ['NORMAL', 'IMPORTANT', 'URGENT'],
            default: 'NORMAL',
        },
        category: {
            type: String,
            enum: ['Company Update', 'Policy Change', 'Holiday Notice', 'Event', 'Celebration'],
            default: 'Company Update',
        },
        publishedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        publisherName: {
            type: String,
            default: 'BKR Administration',
        },
        publishDate: {
            type: Date,
            default: Date.now,
        },
        expiryDate: {
            type: Date,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
