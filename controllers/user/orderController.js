const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const PDFDocument = require('pdfkit');

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

        // Get orders data with populated product details and return requests
        const orders = await Order.find({ user: userId })
            .populate({
                path: 'items.product',
                select: 'productName productImage salesPrice'
            })
            .populate({
                path: 'items.returnRequest',
                select: 'status requestDate'
            })
            .sort({ orderDate: -1 });

        // Process orders to separate them based on item status
        const processedOrders = orders.map(order => {
            // Create a deep copy of the order
            const orderObj = order.toObject();
            
            // Separate items by status
            const activeItems = [];
            const deliveredItems = [];
            const cancelledItems = [];

            order.items.forEach(item => {
                if (item.status === 'Delivered') {
                    // Check if there's a return request
                    if (item.returnRequest) {
                        if (item.returnRequest.status === 'Approved') {
                            // If return is approved, update item status
                            item.status = 'Return Approved';
                        }
                    }
                    deliveredItems.push(item);
                } else if (item.status === 'Cancelled') {
                    cancelledItems.push(item);
                } else {
                    activeItems.push(item);
                }
            });

            // Create separate order objects for each status
            const orderCopies = [];

            if (activeItems.length > 0) {
                const activeOrder = { ...orderObj, items: activeItems, displayStatus: 'active' };
                orderCopies.push(activeOrder);
            }

            if (deliveredItems.length > 0) {
                const deliveredOrder = { ...orderObj, items: deliveredItems, displayStatus: 'delivered' };
                orderCopies.push(deliveredOrder);
            }

            if (cancelledItems.length > 0) {
                const cancelledOrder = { ...orderObj, items: cancelledItems, displayStatus: 'cancelled' };
                orderCopies.push(cancelledOrder);
            }

            return orderCopies;
        });

        // Flatten the array of order arrays
        const flattenedOrders = processedOrders.flat();

        console.log('Processed Orders:', JSON.stringify(flattenedOrders, null, 2));

        res.render('user/orders', {
            title: 'Orders',
            orders: flattenedOrders,
            user: req.session.user,
            error_msg: req.flash('error'),
            success_msg: req.flash('success'),
            path: '/orders'
        });

    } catch (error) {
        console.error('Error in loadOrders:', error);
        console.error('Stack trace:', error.stack);
        req.flash('error', 'Failed to load orders');
        res.redirect('/');
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
                switch (item.size.toLowerCase()) {
                    case 's':
                    case 'small':
                        sizeField = 'small';
                        break;
                    case 'm':
                    case 'medium':
                        sizeField = 'medium';
                        break;
                    case 'l':
                    case 'large':
                        sizeField = 'large';
                        break;
                    default:
                        continue;
                }

                if (product.quantities[sizeField] !== undefined) {
                    product.quantities[sizeField] += item.quantity;
                    product.totalQuantity += item.quantity;
                    await product.save();
                }
            }
        }

        order.status = 'Cancelled';
        order.items.forEach(item => {
            if (item.status !== 'Delivered' && item.status !== 'Return Approved') {
                item.status = 'Cancelled';
            }
        });

        await order.save();

        // If payment was made, process refund to wallet
        if (order.paymentStatus === 'Paid') {
            const wallet = await Wallet.findOneAndUpdate(
                { userId: req.session.user._id },
                {
                    $inc: { balance: order.totalAmount },
                    $push: {
                        transactions: {
                            type: 'credit',
                            amount: order.totalAmount,
                            description: `Refund for cancelled order #${order._id}`
                        }
                    }
                },
                { upsert: true, new: true }
            );
        }

        res.json({
            success: true,
            message: 'Order cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
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

        // Check if refund is already processed
        if (orderItem.refundProcessed) {
            return res.status(400).json({
                success: false,
                message: 'Refund already processed for this item'
            });
        }

        // Update product stock
        const product = await Product.findById(orderItem.product._id);
        if (product) {
            // Convert size to lowercase for quantities object
            let sizeField;
            switch (orderItem.size.toLowerCase()) {
                case 's':
                case 'small':
                    sizeField = 'small';
                    break;
                case 'm':
                case 'medium':
                    sizeField = 'medium';
                    break;
                case 'l':
                case 'large':
                    sizeField = 'large';
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid size'
                    });
            }

            if (product.quantities[sizeField] !== undefined) {
                product.quantities[sizeField] += orderItem.quantity;
                product.totalQuantity += orderItem.quantity;
                await product.save();
            }
        }

        // Cancel the specific item
        orderItem.status = 'Cancelled';
        orderItem.refundProcessed = true; // Mark refund as processed
        
        // If all items are cancelled, cancel the entire order
        const activeItems = order.items.filter(item => item.status !== 'Cancelled');
        if (activeItems.length === 0) {
            order.status = 'Cancelled';
        }

        // Add refund to user's wallet
        const wallet = await Wallet.findOne({ userId: req.session.user._id });
        if (wallet) {
            const refundAmount = orderItem.price * orderItem.quantity;
            wallet.balance += refundAmount;
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for cancelled order item (Order #${order._id.toString().slice(-6)})`,
                status: 'completed',  
                timestamp: new Date()    
            });
            await wallet.save();
            
            // Save order after successful refund
            await order.save();

            res.json({
                success: true,
                message: 'Order item cancelled and refund processed successfully',
                refundAmount: refundAmount
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'User wallet not found'
            });
        }
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

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user')
            .populate('items.product');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Create a new PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50
        });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add company logo or name
        doc.fontSize(20).font('Helvetica-Bold').text('SneakerVerse', { align: 'center' });
        doc.fontSize(16).font('Helvetica-Bold').text('Order Invoice', { align: 'center' });
        doc.moveDown();

        // Add order details
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Order ID: ${order._id}`);
        doc.text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`);
        doc.moveDown();

        // Add customer details
        doc.text('Customer Details:');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Name: ${order.shippingAddress.name}`);
        doc.text(`Address: ${order.shippingAddress.street}`);
        if (order.shippingAddress.landmark) {
            doc.text(`Landmark: ${order.shippingAddress.landmark}`);
        }
        doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`);
        doc.text(`Phone: ${order.shippingAddress.mobile}`);
        doc.moveDown();

        // Add payment details
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.moveDown();

        // Add table headers
        const tableTop = doc.y;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Product', 50, tableTop);
        doc.text('Quantity', 300, tableTop);
        doc.text('Price', 400, tableTop);
        doc.text('Total', 500, tableTop);

        // Add line below headers
        doc.moveTo(50, doc.y + 5)
           .lineTo(550, doc.y + 5)
           .stroke();

        // Add items
        let tableY = doc.y + 20;
        doc.fontSize(10).font('Helvetica');
        
        order.items.forEach(item => {
            doc.text(item.product.productName, 50, tableY, { width: 240 });
            doc.text(item.quantity.toString(), 300, tableY);
            doc.text(`₹${item.price.toFixed(2)}`, 400, tableY);
            doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, 500, tableY);
            tableY += 25;
        });

        // Add line above total
        doc.moveTo(50, tableY + 5)
           .lineTo(550, tableY + 5)
           .stroke();

        // Add total
        tableY += 20;
        doc.fontSize(12).font('Helvetica-Bold');
        
        // Add subtotal
        doc.text('Subtotal:', 400, tableY);
        const subtotal = order.totalAmount + (order.couponDiscount?.amount || 0);
        doc.text(`₹${subtotal.toFixed(2)}`, 500, tableY);
        
        // Add discount if applied
        if (order.couponDiscount && order.couponDiscount.amount > 0) {
            tableY += 25;
            doc.text(`Discount (${order.couponDiscount.code}):`, 400, tableY);
            doc.text(`-₹${order.couponDiscount.amount.toFixed(2)}`, 500, tableY);
        }
        
        // Add final total
        tableY += 25;
        doc.text('Final Total:', 400, tableY);
        doc.text(`₹${order.totalAmount.toFixed(2)}`, 500, tableY);

        // Move down for footer section
        doc.moveDown(4);

        // Add separator line
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();

        // Add thank you note
        doc.moveDown(2);
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text('Thank you for shopping with SneakerVerse!', 50, doc.y, {
            align: 'center',
            width: 500
        });

        // Add support information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Customer Support', 50, doc.y, {
            align: 'center',
            width: 500
        });

        // Add support details
        doc.moveDown();
        doc.fontSize(10).font('Helvetica');
        doc.text('Email: support@SneakerVerse.com', 50, doc.y, {
            align: 'center',
            width: 500
        });
        
        doc.moveDown();
        doc.text('Phone: 8592930487', 50, doc.y, {
            align: 'center',
            width: 500
        });

        // Finalize the PDF
        doc.end();

    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).send('Error generating invoice');
    }
};

module.exports = {
    loadOrders,
    cancelOrder,
    cancelOrderItem,
    getOrderDetails,
    getOrderProductDetails,
    generateInvoice
};