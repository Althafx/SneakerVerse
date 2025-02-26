const ReturnRequest = require('../../models/returnRequestSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');

//--------------------------------------------------------------------------------------------------------------------------------------------------------

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

            // Find return request with all necessary populated fields
            const returnRequest = await ReturnRequest.findById(requestId)
                .populate({
                    path: 'orderId',
                    populate: {
                        path: 'items.product',
                        model: 'Product'
                    }
                })
                .populate('userId')
                .populate('productId');

            if (!returnRequest) {
                return res.status(404).json({
                    success: false,
                    message: 'Return request not found'
                });
            }

            // If the status is being updated to 'Approved'
            if (status === 'Approved' && returnRequest.status !== 'Approved') {
                // Find the specific order item
                const order = await Order.findById(returnRequest.orderId._id);
                if (!order) {
                    return res.status(404).json({
                        success: false,
                        message: 'Order not found'
                    });
                }

                const orderItem = order.items.find(item => 
                    item.product.toString() === returnRequest.productId._id.toString() && 
                    item.size === returnRequest.size
                );

                if (!orderItem) {
                    return res.status(404).json({
                        success: false,
                        message: 'Order item not found'
                    });
                }

                // Check if refund was already processed
                if (orderItem.refundProcessed) {
                    return res.status(400).json({
                        success: false,
                        message: 'Refund was already processed for this item'
                    });
                }

                try {
                    // Start a session for the transaction
                    const session = await ReturnRequest.startSession();
                    await session.withTransaction(async () => {
                        // 1. Update product stock
                        const product = await Product.findById(returnRequest.productId._id);
                        if (!product) {
                            throw new Error('Product not found');
                        }

                        // Convert size to the correct format
                        let sizeKey = returnRequest.size.toLowerCase();
                        
                        // Map common size variations to the correct key
                        const sizeMap = {
                            's': 'small',
                            'm': 'medium',
                            'l': 'large',
                            'small': 'small',
                            'medium': 'medium',
                            'large': 'large'
                        };

                        sizeKey = sizeMap[sizeKey];
                        
                        if (!product.quantities || !sizeKey || !(sizeKey in product.quantities)) {
                            throw new Error(`Invalid product size: ${returnRequest.size}. Available sizes are: small, medium, large`);
                        }

                        // Increment the quantity for the specific size
                        product.quantities[sizeKey] += orderItem.quantity;
                        
                        // Update total quantity
                        product.totalQuantity += orderItem.quantity;

                        await product.save({ session });

                        // 2. Process refund to user's wallet
                        let refundAmount = orderItem.price * orderItem.quantity;
                        
                        // If a coupon was applied to the order, calculate the proportional discount
                        if (order.couponDiscount && order.couponDiscount.amount > 0) {
                            // Calculate what percentage this item's total is of the order total
                            const itemTotal = orderItem.price * orderItem.quantity;
                            const orderSubtotal = order.totalAmount + order.couponDiscount.amount;
                            const itemPercentage = itemTotal / orderSubtotal;
                            
                            // Apply the proportional coupon discount to this item
                            const itemDiscount = order.couponDiscount.amount * itemPercentage;
                            refundAmount -= itemDiscount;
                        }

                        const walletUpdate = await Wallet.findOneAndUpdate(
                            { userId: returnRequest.userId },
                            { 
                                $inc: { balance: refundAmount },
                                $push: {
                                    transactions: {
                                        type: 'credit',
                                        amount: refundAmount,
                                        description: `Refund for returned product (Order #${order._id})`
                                    }
                                }
                            },
                            { session, upsert: true, new: true }
                        );

                        if (!walletUpdate) {
                            throw new Error('Failed to update wallet');
                        }

                        // 3. Mark the order item as refunded
                        orderItem.refundProcessed = true;
                        await order.save({ session });

                        // 4. Update return request status
                        returnRequest.status = status;
                        await returnRequest.save({ session });
                    });
                    session.endSession();

                    return res.json({
                        success: true,
                        message: 'Return request approved, stock updated, and refund processed successfully'
                    });
                } catch (error) {
                    console.error('Transaction error:', error);
                    return res.status(500).json({
                        success: false,
                        message: error.message || 'Failed to process return request transaction'
                    });
                }
            } else {
                // For other status updates
                returnRequest.status = status;
                await returnRequest.save();

                res.json({
                    success: true,
                    message: 'Return request status updated successfully'
                });
            }
        } catch (error) {
            console.error('Error updating return status:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update return status'
            });
        }
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = adminReturnRequestController;
