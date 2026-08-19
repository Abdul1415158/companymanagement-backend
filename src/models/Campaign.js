const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        budget: {
            type: Number,
            default: 0,
        },
        channel: {
            type: String,
            default: 'Digital',
        },
        status: {
            type: String,
            enum: ['PLANNED', 'ACTIVE', 'PAUSED', 'ENDED'],
            default: 'PLANNED',
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Campaign', campaignSchema);
