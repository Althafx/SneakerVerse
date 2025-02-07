const ReturnRequest = require('../../models/returnRequestSchema');

const adminReturnRequestController = {
    // Get all return requests
    getAllReturnRequests: async (req, res) => {
        try {
            const returnRequests = await ReturnRequest.find()
                .populate('orderId')
                .populate('userId', 'username email')
                .populate('productId', 'productName productImage')
                .sort({ requestDate: -1 });

            res.json(returnRequests);
        } catch (error) {
            console.error('Error fetching return requests:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch return requests'
            });
        }
    },

    // Update return request status
    updateReturnStatus: async (req, res) => {
        try {
            const { requestId, status } = req.body;

            const returnRequest = await ReturnRequest.findById(requestId);
            if (!returnRequest) {
                return res.status(404).json({
                    success: false,
                    message: 'Return request not found'
                });
            }

            returnRequest.status = status;
            await returnRequest.save();

            res.json({
                success: true,
                message: 'Return request status updated successfully'
            });
        } catch (error) {
            console.error('Error updating return status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update return status'
            });
        }
    }
};

module.exports = adminReturnRequestController;
