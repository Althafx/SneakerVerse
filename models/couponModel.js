const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    offerAmount: {
        type: Number,
        required: true,
        min: 1
    },
    minPurchase: {
        type: Number,
        required: true,
        min: 1
    },
    startDate: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    totalUses: {
        type: Number,
        required: true,
        min: 1
    },
    usedCount: {
        type: Number,
        default: 0
    },
    maxUsesPerUser: {
        type: Number,
        required: true,
        min: 1
    },
    isActive: {
        type: Boolean,
        default: true
    },
    userUsage: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        usageCount: {
            type: Number,
            default: 1
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Coupon', couponSchema);
