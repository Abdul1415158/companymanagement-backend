const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
    {
        assetId: {
            type: String,
            default: () => `AST-${Date.now().toString().slice(-5)}`,
            unique: true,
        },
        assetName: {
            type: String,
            required: true,
            trim: true,
        },
        assetType: {
            type: String,
            enum: ['Laptop', 'Monitor / Display', 'Keyboard', 'Mouse', 'Headset', 'Mobile Phone', 'Other Equipment'],
            default: 'Laptop',
        },
        brand: {
            type: String,
            default: '',
            trim: true,
        },
        model: {
            type: String,
            default: '',
            trim: true,
        },
        serialNumber: {
            type: String,
            default: '',
            trim: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        assignedToName: {
            type: String,
            default: 'Unassigned',
        },
        assignedDepartment: {
            type: String,
            default: 'IT / Operations',
        },
        assignmentDate: {
            type: String, // YYYY-MM-DD
            default: '',
        },
        condition: {
            type: String,
            enum: ['Brand New', 'Good / Operational', 'Fair', 'Needs Maintenance', 'Damaged'],
            default: 'Good / Operational',
        },
        returnDate: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['ASSIGNED', 'AVAILABLE', 'UNDER_MAINTENANCE', 'RETIRED'],
            default: 'AVAILABLE',
        },
        notes: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Asset', assetSchema);
