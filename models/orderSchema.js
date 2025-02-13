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
        },
        returnRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ReturnRequest'
        },
        refundProcessed: {
            type: Boolean,
            default: false
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    couponDiscount: {
        code: {
            type: String
        },
        amount: {
            type: Number
        }
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
        enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Payment Failed'],
        default: 'Pending'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    deliveryDate: {
        type: Date
    },
    razorpayOrderId: String,
    razorpayPaymentId: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
