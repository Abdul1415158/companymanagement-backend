const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
    {
        postId: {
            type: String,
            default: () => `POST-${Date.now().toString().slice(-6)}`,
            unique: true,
        },
        companyBrand: {
            type: String,
            default: 'BKR Tech Solutions',
            trim: true,
        },
        campaign: {
            type: String,
            default: 'General Awareness',
            trim: true,
        },
        postTitle: {
            type: String,
            required: true,
            trim: true,
        },
        contentType: {
            type: String,
            enum: ['Static Graphic', 'Carousel', 'Video / Reel', 'Article / Newsletter', 'Story', 'Announcement'],
            default: 'Static Graphic',
        },
        caption: {
            type: String,
            default: '',
        },
        designer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        contentWriter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        plannedDate: {
            type: String, // YYYY-MM-DD
            default: '',
        },
        plannedTime: {
            type: String, // HH:MM AM/PM
            default: '',
        },
        status: {
            type: String,
            enum: [
                'IDEA',
                'ASSIGNED',
                'CONTENT_PREP',
                'DESIGN',
                'INTERNAL_REVIEW',
                'REVISION',
                'APPROVED',
                'SCHEDULED',
                'PUBLISHED',
            ],
            default: 'IDEA',
        },
        designAssetUrl: {
            type: String,
            default: '',
        },
        platforms: [
            {
                name: {
                    type: String,
                    enum: ['LinkedIn', 'Facebook', 'Instagram', 'TikTok', 'Twitter / X'],
                    required: true,
                },
                required: {
                    type: Boolean,
                    default: true,
                },
                published: {
                    type: Boolean,
                    default: false,
                },
                publishedAt: {
                    type: Date,
                    default: null,
                },
                postUrl: {
                    type: String,
                    default: '',
                },
            },
        ],
        approvalNotes: {
            type: String,
            default: '',
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Post', postSchema);
