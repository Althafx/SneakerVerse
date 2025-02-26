const Order = require('../../models/orderSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');

//--------------------------------------------------------------------------------------------------------------------------------------------------------

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Verify if order is eligible for retry payment
        if (order.paymentStatus !== 'Failed' || order.paymentMethod !== 'online') {
            return res.status(400).json({ success: false, message: 'Order is not eligible for payment retry' });
        }

        // Create new Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(order.totalAmount * 100), // Convert to paise
            currency: 'INR',
            receipt: orderId,
            notes: {
                orderId: orderId
            }
        });

        // Update order with new Razorpay order ID
        await Order.findByIdAndUpdate(orderId, {
            razorpayOrderId: razorpayOrder.id
        });

        res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id
        });

    } catch (error) {
        console.error('Retry payment error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const verifyRetryPayment = async (req, res) => {
    try {
        const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Update order status
        await Order.findByIdAndUpdate(orderId, {
            paymentStatus: 'Paid',
            status: 'Processing',
            razorpayPaymentId: razorpay_payment_id
        });

        res.json({
            success: true,
            message: 'Payment successful'
        });

    } catch (error) {
        console.error('Verify retry payment error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {
    retryPayment,
    verifyRetryPayment
};
