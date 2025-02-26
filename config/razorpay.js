const Razorpay = require('razorpay');
require('dotenv').config();

// Log the environment variables being used
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;


if (!key_id || !key_secret) {
    console.error('Razorpay keys not found in environment variables!');
    throw new Error('Razorpay configuration missing');
}

if (!key_id.startsWith('rzp_')) {
    console.error('Invalid Razorpay key format! Key should start with rzp_');
    throw new Error('Invalid Razorpay key format');
}

const instance = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});

module.exports = instance;