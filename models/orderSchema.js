const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        size: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
            default: 'Pending'
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    shippingAddress: {
        name: String,
        street: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
        mobile: String,
        alternativePhone: String
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'wallet'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Payment Failed'],
        default: 'Pending'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
