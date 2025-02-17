const express = require('express');
const router = express.Router();
const { retryPayment, verifyRetryPayment } = require('../../controllers/user/retryPaymentController');
const { userAuth, isBlockedUser } = require('../../middlewares/auth');

// Retry payment routes
router.post('/retry-payment', userAuth, isBlockedUser, retryPayment);
router.post('/verify-retry-payment', userAuth, isBlockedUser, verifyRetryPayment);

module.exports = router;
