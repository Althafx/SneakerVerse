const ReturnRequest = require('../../models/returnRequestSchema');
const Order = require('../../models/orderSchema');

const returnRequestController = {
    // Submit a return request
    submitReturnRequest: async (req, res) => {
        try {
            console.log('Return request body:', req.body);
            console.log('User session:', req.session.user);

            const { orderId, productId, size, reason } = req.body;
            
            // Get user ID from session
            const userId = req.session.user._id;

            // Validate required fields
            if (!orderId || !productId || !size || !reason) {
                console.log('Missing required fields');
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            // Check if order exists and belongs to the user
            const order = await Order.findOne({ _id: orderId, user: userId });
            if (!order) {
                console.log('Order not found or does not belong to user');
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Check if a return request already exists
            const existingRequest = await ReturnRequest.findOne({
                orderId,
                productId,
                userId,
                size
            });

            if (existingRequest) {
                console.log('Return request already exists');
                return res.status(400).json({
                    success: false,
                    message: 'A return request already exists for this item'
                });
            }

            console.log('Creating new return request');
            // Create new return request
            const returnRequest = new ReturnRequest({
                orderId,
                productId,
                userId,
                size,
                reason
            });

            await returnRequest.save();
            console.log('Return request saved:', returnRequest._id);

            // Update the order item with return request reference
            const updateResult = await Order.updateOne(
                { 
                    _id: orderId,
                    'items.product': productId,
                    'items.size': size
                },
                {
                    $set: {
                        'items.$.returnRequest': returnRequest._id
                    }
                }
            );
            console.log('Order update result:', updateResult);

            res.json({
                success: true,
                message: 'Return request submitted successfully'
            });
        } catch (error) {
            console.error('Error submitting return request:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to submit return request'
            });
        }
    }
};

module.exports = returnRequestController;
