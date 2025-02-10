const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");

const loadOrders = async (req, res) => {
    try {
        console.log('Session data:', req.session);
        console.log('User in session:', req.session.user);

        if (!req.session.user || !req.session.user._id) {
            req.flash('error', 'Please login to view orders');
            return res.redirect('/login');
        }

        const userId = req.session.user._id;
        console.log('User ID:', userId);

        // Get orders data with populated product details
        const orders = await Order.find({ user: userId })
            .populate({
                path: 'items.product',
                select: 'productName productImage salesPrice'
            })
            .populate('items.returnRequest')
            .sort({ orderDate: -1 });

        console.log('Found orders:', orders.length);
        if (orders.length > 0) {
            console.log('Sample order:', {
                _id: orders[0]._id,
                items: orders[0].items.map(item => ({
                    _id: item._id,
                    product: {
                        _id: item.product._id,
                        name: item.product.productName
                    }
                }))
            });
        }

        res.render('user/orders', {
            user: req.session.user,
            orders: orders,
            error_msg: req.flash('error'),
            success_msg: req.flash('success'),
            path: '/orders'
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        console.error('Stack trace:', error.stack);
        req.flash('error', 'Failed to load orders');
        res.redirect('/home');
    }
};

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order belongs to user
        if (order.user.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Check if order can be cancelled
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled'
            });
        }

        // Update stock for all items
        for (const item of order.items) {
            const product = await Product.findById(item.product._id);
            if (product) {
                // Convert size to lowercase for quantities object
                let sizeField;
                switch (item.size) {
                    case 'S':
                        sizeField = 'small';
                        break;
                    case 'M':
                        sizeField = 'medium';
                        break;
                    case 'L':
                        sizeField = 'large';
                        break;
                    default:
                        continue;
                }

                // Increment the stock quantity
                product.quantities[sizeField] += item.quantity;
                product.totalQuantity = Object.values(product.quantities).reduce((a, b) => a + b, 0);
                await product.save();
                
                // Update item status
                item.status = 'Cancelled';
            }
        }

        // Update order status
        order.status = 'Cancelled';
        await order.save();

        res.json({
            success: true,
            message: 'Order cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const itemId = req.params.itemId;
        
        const order = await Order.findById(orderId)
            .populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order belongs to user
        if (order.user.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Find the specific item
        const orderItem = order.items.id(itemId);
        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Order item not found'
            });
        }

        // Check if item can be cancelled
        if (orderItem.status === 'Delivered' || orderItem.status === 'Cancelled' || 
            order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Order item cannot be cancelled'
            });
        }

        // Update product stock
        const product = await Product.findById(orderItem.product._id);
        if (product) {
            // Convert size to lowercase for quantities object
            let sizeField;
            switch (orderItem.size) {
                case 'S':
                    sizeField = 'small';
                    break;
                case 'M':
                    sizeField = 'medium';
                    break;
                case 'L':
                    sizeField = 'large';
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid size'
                    });
            }

            // Increment the stock quantity
            product.quantities[sizeField] += orderItem.quantity;
            product.totalQuantity = Object.values(product.quantities).reduce((a, b) => a + b, 0);
            await product.save();
        }

        // Cancel the specific item
        orderItem.status = 'Cancelled';
        
        // If all items are cancelled, cancel the entire order
        const activeItems = order.items.filter(item => item.status !== 'Cancelled');
        if (activeItems.length === 0) {
            order.status = 'Cancelled';
        }

        await order.save();

        res.json({
            success: true,
            message: 'Order item cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling order item:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order item'
        });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        
        const order = await Order.findById(orderId)
            .populate({
                path: 'items.product',
                model: 'Product',
                select: 'productName productImage salesPrice'
            })
            .populate('user', 'name email phone');

        if (!order) {
            req.flash('error', 'Order not found');
            return res.redirect('/orders');
        }

        // Check if order belongs to user
        if (order.user._id.toString() !== req.session.user._id.toString()) {
            req.flash('error', 'Unauthorized');
            return res.redirect('/orders');
        }

        res.render('user/orderDetails', {
            order: order,
            user: req.session.user,
            error_msg: req.flash('error'),
            success_msg: req.flash('success'),
            path: '/order-details'
        });
    } catch (error) {
        console.error('Error getting order details:', error);
        console.error('Stack trace:', error.stack);
        req.flash('error', 'Failed to load order details');
        res.redirect('/orders');
    }
};

const getOrderProductDetails = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        console.log('1. Starting getOrderProductDetails with params:', { orderId, productId });
        
        if (!req.session.user) {
            console.log('2. No user in session - redirecting to login');
            req.flash('error', 'Please login to view order details');
            return res.redirect('/login');
        }
        
        const userId = req.session.user._id;
        console.log('3. User ID:', userId);

        console.log('4. Finding order...');
        const order = await Order.findOne({
            _id: orderId,
            user: userId
        }).populate({
            path: 'items.product',
            select: 'productName description images price' // Make sure we're selecting the images field
        });

        if (!order) {
            console.log('5. Order not found');
            req.flash('error', 'Order not found');
            return res.redirect('/orders');
        }

        console.log('6. Looking for product in order items...');
        const orderItem = order.items.find(item => item.product._id.toString() === productId);
        
        if (!orderItem) {
            console.log('7. Product not found in order');
            req.flash('error', 'Product not found in order');
            return res.redirect('/orders');
        }

        console.log('8. Product found:', {
            productName: orderItem.product.productName,
            images: orderItem.product.images,
            hasImages: orderItem.product.images && orderItem.product.images.length > 0
        });

        try {
            return res.render('user/orderProductDetails', {
                title: 'Order Details',
                order,
                item: orderItem,
                user: req.session.user
            });
        } catch (renderError) {
            console.error('Error during render:', renderError);
            console.error('Render error stack:', renderError.stack);
            console.log('Order data:', JSON.stringify(order, null, 2));
            console.log('Order item data:', JSON.stringify(orderItem, null, 2));
            req.flash('error', 'Error displaying order details');
            return res.redirect('/orders');
        }

    } catch (error) {
        console.error('Error in getOrderProductDetails:', error);
        console.error('Stack trace:', error.stack);
        req.flash('error', 'Failed to load order details');
        return res.redirect('/orders');
    }
};

module.exports = {
    loadOrders,
    cancelOrder,
    cancelOrderItem,
    getOrderDetails,
    getOrderProductDetails
};