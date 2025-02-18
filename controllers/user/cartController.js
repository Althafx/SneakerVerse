const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Wallet = require('../../models/walletSchema');
const Coupon = require('../../models/couponModel'); // Changed from couponSchema to couponModel
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');

const loadCart = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect("/login");
        }

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.product',
                model: 'Product',
                select: 'productName productImage salesPrice quantities productOffer category mainPrice offer',
                populate: {
                    path: 'category',
                    select: 'categoryOffer name'
                }
            });

        if (cart && cart.items) {
            cart.items = cart.items.filter(item => 
                item && 
                item.product && 
                item.size &&
                typeof item.size === 'string'
            );

            // Calculate final prices and quantities
            cart.items.forEach(item => {
                if (item && item.product) {
                    // Get size mapping
                    const sizeKey = {
                        'S': 'small',
                        'M': 'medium',
                        'L': 'large'
                    }[item.size] || item.size.toLowerCase();
                    
                    // Set available quantity
                    item.availableQuantity = item.product.quantities[sizeKey] || 0;

                    // Calculate price based on offers
                    if (item.product.offer && item.product.offer.discountedPrice) {
                        // Use the pre-calculated discounted price from the product schema
                        item.price = item.product.offer.discountedPrice * item.quantity;
                    } else if (item.product.category && item.product.category.categoryOffer > 0) {
                        // Calculate category offer price if no product offer exists
                        const discountedPrice = Math.floor(item.product.salesPrice - (item.product.salesPrice * item.product.category.categoryOffer / 100));
                        item.price = discountedPrice * item.quantity;
                    } else {
                        // Use regular sales price if no offers exist
                        item.price = item.product.salesPrice * item.quantity;
                    }
                }
            });

            // Update total amount
            cart.totalAmount = cart.items.reduce((total, item) => total + item.price, 0);
            await cart.save();
        }

        res.locals.path = '/cart';
        res.locals.error_msg = req.flash('error');
        res.locals.success_msg = req.flash('success');

        res.render("user/cart", {
            cart: cart || { items: [] },
            user: req.session.user
        });
    } catch (error) {
        next(error);
    }
};

const addToCart = async (req, res, next) => {
    try {
        const { productId, size, quantity = 1 } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to add items to cart'
            });
        }

        if (!size || typeof size !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid size'
            });
        }

        const requestedQuantity = parseInt(quantity);
        if (isNaN(requestedQuantity) || requestedQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid quantity'
            });
        }

        // Get product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Map size abbreviations to full names
        const sizeMap = {
            'S': 'small',
            'M': 'medium',
            'L': 'large'
        };

        const sizeKey = sizeMap[size.toUpperCase()];
        if (!sizeKey) {
            return res.status(400).json({
                success: false,
                message: 'Invalid size selected'
            });
        }

        // Check if size is available in stock
        if (!product.quantities || typeof product.quantities !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Product quantities not properly configured'
            });
        }

        if (typeof product.quantities[sizeKey] !== 'number') {
            return res.status(400).json({
                success: false,
                message: `Size ${size} is not available for this product`
            });
        }

        if (product.quantities[sizeKey] <= 0) {
            return res.status(400).json({
                success: false,
                message: `Size ${size} is out of stock`
            });
        }

        // Check if requested quantity is available
        if (requestedQuantity > product.quantities[sizeKey]) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.quantities[sizeKey]} items available in size ${size}`
            });
        }

        // Find existing cart or create new one
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [], totalAmount: 0 });
        }

        // Check if product with same size already exists in cart
        const existingItem = cart.items.find(item => 
            item.product.toString() === productId && 
            item.size && 
            item.size.toUpperCase() === size.toUpperCase()
        );

        if (existingItem) {
            // Check if adding requested quantity would exceed stock
            if (existingItem.quantity + requestedQuantity > product.quantities[sizeKey]) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.quantities[sizeKey]} items available in size ${size}. You already have ${existingItem.quantity} in your cart.`
                });
            }
            // If product exists, add the requested quantity
            existingItem.quantity += requestedQuantity;
            existingItem.price = product.salesPrice * existingItem.quantity;
        } else {
            // If product doesn't exist, add new item with requested quantity
            cart.items.push({
                product: productId,
                quantity: requestedQuantity,
                size: size.toUpperCase(),
                price: product.salesPrice * requestedQuantity
            });
        }

        // Calculate total amount
        cart.totalAmount = cart.items.reduce((total, item) => total + item.price, 0);

        await cart.save();

        res.json({
            success: true,
            message: `Added ${requestedQuantity} item(s) to cart successfully`
        });

    } catch (error) {
        next(error);

    }
};

const updateQuantity = async (req, res) => {
    try {
        const { productId, size, action } = req.body;
        const userId = req.session.user;

        // Validate inputs
        if (!productId || !size || !action) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Get cart and product
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.product',
            select: 'productName salesPrice quantities'
        });
        
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        // Find the cart item
        const cartItem = cart.items.find(item => 
            item.product._id.toString() === productId && 
            item.size === size
        );

        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        // Map size to product quantity key
        const sizeMap = {
            'S': 'small',
            'M': 'medium',
            'L': 'large'
        };
        const sizeKey = sizeMap[size] || size.toLowerCase();
        const availableStock = cartItem.product.quantities[sizeKey] || 0;

        // Calculate new quantity
        let newQuantity = cartItem.quantity;
        if (action === 'increase') {
            // Check stock limit
            if (newQuantity >= availableStock) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot exceed available stock quantity'
                });
            }
            // Check maximum limit of 10
            if (newQuantity >= 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 10 items allowed per product'
                });
            }
            newQuantity += 1;
        } else if (action === 'decrease' && newQuantity > 1) {
            newQuantity -= 1;
        }

        // Update cart item quantity and price
        cartItem.quantity = newQuantity;
        cartItem.price = newQuantity * cartItem.product.salesPrice;

        // Recalculate cart total
        cart.totalAmount = cart.items.reduce((total, item) => total + item.price, 0);

        await cart.save();

        // Send back all necessary data
        res.json({
            success: true,
            message: 'Quantity updated successfully',
            quantity: newQuantity,
            itemTotal: cartItem.price,
            total: cart.totalAmount,
            cartCount: cart.items.reduce((total, item) => total + item.quantity, 0)
        });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update quantity'
        });
    }
};

const removeFromCart = async (req, res, next) => {
    try {
        const { productId,size } = req.params;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to remove items'
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }
        console.log(cart,"cart")
        const sizeMap = {
            'S': 'small',
            'M': 'medium',
            'L': 'large'
        };

        const sizeKey = sizeMap[size.toUpperCase()];
        if (!sizeKey) {
            return res.status(400).json({
                success: false,
                message: 'Invalid size selected'
            });
        }
        console.log(sizeKey,"sizeKey")

        // Find the item to remove and calculate its price
        const itemToRemove = cart.items.find(item => 
            item.product.toString() === productId && item.size === size
        );

        if (!itemToRemove) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        // Update total amount by subtracting the removed item's price
        cart.totalAmount = Math.max(0, cart.totalAmount - itemToRemove.price);

        // Filter out the item with matching productId AND size
        cart.items = cart.items.filter(item => 
            !(item.product.toString() === productId && item.size === size)
        );

        await cart.save();

        res.json({
            success: true,
            message: 'Item removed from cart successfully'
        });

    } catch (error) {
        next(error);

    }
};

const checkout = async(req, res, next) => {
    try {
        // Get user ID from session
        const userId = req.session.user;
        console.log('User ID:', userId); // Debug log

        if (!userId) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        // Get cart items with product details
        const cart = await Cart.findOne({ userId: userId })
            .populate({
                path: 'items.product',
                select: 'productName salesPrice productImage brand'
            });

        console.log('Cart:', cart); // Debug log

        if (!cart || !cart.items || cart.items.length === 0) {
            req.flash('error', 'Your cart is empty');
            return res.redirect('/cart');
        }

        // Get user's addresses from Address model
        const addressDoc = await Address.findOne({ userId: userId });
        console.log('Address Document:', addressDoc); // Debug log

        const addresses = addressDoc ? addressDoc.address : [];

        // Get user data
        const user = await User.findById(userId);
        console.log('User Data:', {
            id: user._id,
            name: user.name,
            email: user.email,
            addressCount: addresses.length
        }); // Debug log

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/login');
        }

        // Get wallet data
        const wallet = await Wallet.findOne({ userId });

        // Calculate totals
        const subtotal = cart.items.reduce((total, item) => {
            if (item.product) {
                return total + (item.product.salesPrice * item.quantity);
            }
            return total;
        }, 0);

        // Log data for debugging
        console.log('Checkout Data:', {
            userId,
            cartId: cart._id,
            itemCount: cart.items.length,
            subtotal,
            addressCount: addresses.length,
            hasAddresses: addresses.length > 0
        });

        // Render checkout page with data
        return res.render('user/checkout', {
            cart,
            subtotal,
            user,
            addresses: addresses,
            wallet: wallet || { balance: 0 },
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });

    } catch (error) {
        console.error('Checkout error:', error);
        req.flash('error', 'Something went wrong. Please try again.');
        return res.redirect('/cart');
    }
};

const placeOrder = async(req, res, next) => {
    try {
        console.log('Request body:', req.body);
        console.log('Session user:', req.session.user);

        const userId = req.session.user;
        const { addressId, paymentMethod } = req.body;
        
        console.log("Place order details:", {
            userId,
            addressId,
            paymentMethod
        });

        // Validate inputs
        if (!addressId || !paymentMethod) {
            console.log('Missing required fields:', { addressId, paymentMethod });
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Get cart and validate it's not empty
        const cart = await Cart.findOne({ userId })
            .populate('items.product');

        console.log('Cart found:', cart ? 'Yes' : 'No', 'Items:', cart?.items?.length);

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Your cart is empty'
            });
        }

        // Get delivery address
        const addressDoc = await Address.findOne({ userId });
        console.log('Address document found:', addressDoc ? 'Yes' : 'No');

        if (!addressDoc) {
            return res.status(400).json({
                success: false,
                message: 'No addresses found'
            });
        }

        // Find the selected address
        const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
        console.log('Selected address found:', selectedAddress ? 'Yes' : 'No');

        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: 'Selected address not found'
            });
        }

        // Calculate order total
        let orderTotal = cart.items.reduce((total, item) => {
            return total + (item.product.salesPrice * item.quantity);
        }, 0);

        // Apply coupon discount if present
        let appliedCoupon = null;
        if (req.session.appliedCoupon) {
            appliedCoupon = req.session.appliedCoupon;
            orderTotal -= appliedCoupon.discount;
        }

        console.log('Order total:', orderTotal, 'Applied coupon:', appliedCoupon);

        // If payment method is wallet, check balance
        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ userId });
            
            if (!wallet || wallet.balance < orderTotal) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }

            // Deduct from wallet
            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: -orderTotal },
                    $push: {
                        transactions: {
                            type: 'debit',
                            amount: orderTotal,
                            description: 'Order payment',
                            status: 'completed'
                        }
                    }
                }
            );
        }

        // Create order items array
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            quantity: item.quantity,
            price: item.product.salesPrice,
            size: item.size,
            status: 'Pending'
        }));

        // Create new order
        const order = new Order({
            user: userId,
            items: orderItems,
            totalAmount: orderTotal,
            couponDiscount: appliedCoupon ? {
                code: appliedCoupon.code,
                amount: appliedCoupon.discount
            } : null,
            shippingAddress: {
                name: selectedAddress.name,
                street: selectedAddress.landMark,
                landmark: selectedAddress.landMark,
                city: selectedAddress.city,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
                mobile: selectedAddress.phone,
                alternativePhone: selectedAddress.altPhone
            },
            paymentMethod: paymentMethod,
            status: paymentMethod === 'wallet' ? 'Processing' : (paymentMethod === 'cod' ? 'Pending' : 'Pending'),
            paymentStatus: paymentMethod === 'wallet' ? 'Paid' : (paymentMethod === 'cod' ? 'Pending' : 'Pending')
        });

        await order.save();
        console.log('Order saved:', order._id);

        // Update product quantities after order is placed
        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            if (product && product.quantities) {
                const sizeKey = {
                    'S': 'small',
                    'M': 'medium',
                    'L': 'large'
                }[item.size] || item.size.toLowerCase();
                
                if (product.quantities[sizeKey] !== undefined) {
                    product.quantities[sizeKey] -= item.quantity;
                    await product.save();
                    console.log(`Updated quantity for product ${product._id}, size ${sizeKey}: ${product.quantities[sizeKey]}`);
                }
            }
        }

        // Update coupon usage if a coupon was applied
        if (appliedCoupon) {
            const coupon = await Coupon.findOne({ code: appliedCoupon.code });
            if (coupon) {
                // Increment total usage count
                coupon.usedCount = (coupon.usedCount || 0) + 1;
                
                // Update user's usage count
                const userUsageIndex = coupon.userUsage.findIndex(u => u.userId.toString() === userId);
                if (userUsageIndex >= 0) {
                    coupon.userUsage[userUsageIndex].usageCount += 1;
                } else {
                    coupon.userUsage.push({
                        userId: userId,
                        usageCount: 1
                    });
                }
                
                await coupon.save();
                console.log('Updated coupon usage:', coupon.code, 'Total uses:', coupon.usedCount);
            }
        }

        // Clear applied coupon after order is placed
        if (req.session.appliedCoupon) {
            delete req.session.appliedCoupon;
        }

        // Handle different payment methods
        if (paymentMethod === 'online') {
            try {
                console.log('Creating Razorpay order for amount:', orderTotal * 100);
                
                if (!razorpay || !razorpay.orders) {
                    throw new Error('Razorpay not properly initialized');
                }

                // Create Razorpay order
                const razorpayOrder = await razorpay.orders.create({
                    amount: Math.round(orderTotal * 100),
                    currency: 'INR',
                    receipt: order._id.toString(),
                    notes: {
                        orderId: order._id.toString()
                    }
                });

                console.log('Razorpay order created:', razorpayOrder);

                // Save Razorpay order details
                order.razorpayOrderId = razorpayOrder.id;
                await order.save();

                // Get user details for prefill
                const user = await User.findById(userId);

                // Return payment details for frontend
                return res.json({
                    success: true,
                    orderId: order._id.toString(), // Ensure orderId is a string
                    amount: Math.round(orderTotal * 100), // Amount in paise
                    razorpayOrderId: razorpayOrder.id,
                    orderDetails: {
                        name: user.name,
                        email: user.email,
                        orderId: order._id.toString() // Ensure orderId is a string
                    }
                });
            } catch (error) {
                console.error('Razorpay order creation error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create payment order'
                });
            }
        } else {
            // For COD and wallet payments, clear cart and return success
            await Cart.findOneAndDelete({ userId });
            
            return res.json({
                success: true,
                message: 'Order placed successfully',
                orderId: order._id
            });
        }

    } catch (error) {
        console.error('Place order error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to place order'
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        console.log('Verifying payment with body:', req.body);
        const {
            order_id,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            status
        } = req.body;

        console.log('Looking for order with ID:', order_id);
        console.log('Order ID type:', typeof order_id);
        
        if (!order_id) {
            console.log('Order ID is missing in request');
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Find the order
        const order = await Order.findById(order_id);
        console.log('Database query result:', order ? 'Order found' : 'Order not found');
        
        if (!order) {
            console.log('Order not found:', order_id);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log('Found order:', {
            id: order._id,
            status: order.status,
            paymentStatus: order.paymentStatus
        });

        // If status is failed, update order status and return
        if (status === 'failed') {
            console.log('Payment failed, updating order status');
            order.status = 'Payment Failed';
            order.paymentStatus = 'Failed';
            await order.save();
            
            // Clear the cart after failed payment
            await Cart.findOneAndDelete({ userId: order.user });

            return res.status(200).json({
                success: false,
                message: 'Payment failed'
            });
        }

        // Verify Razorpay signature
        const isValidSignature = verifyRazorpaySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValidSignature) {
            console.log('Invalid payment signature');
            order.status = 'Payment Failed';
            order.paymentStatus = 'Failed';
            await order.save();
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Update order status
        order.status = 'Processing';
        order.paymentStatus = 'Paid';
        order.razorpayPaymentId = razorpay_payment_id;
        await order.save();

        // Clear the cart after successful payment
        await Cart.findOneAndDelete({ userId: order.user });

        console.log('Payment verified successfully');
        return res.json({
            success: true,
            message: 'Payment verified successfully'
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
};

const verifyRazorpaySignature = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
    try {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.error('Missing required parameters for signature verification');
            return false;
        }

        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            console.error('Razorpay secret key not found');
            return false;
        }

        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        
        console.log('Signature verification:', {
            generated: generated_signature,
            received: razorpay_signature,
            match: generated_signature === razorpay_signature
        });
        
        return generated_signature === razorpay_signature;
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
};

const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        console.log('Retrying payment for order:', orderId);

        // Find the order
        const order = await Order.findById(orderId).populate('user');
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Verify order belongs to user
        if (order.user._id.toString() !== req.session.user._id) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Verify order status
        if (order.paymentStatus !== 'Failed' && order.paymentStatus !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Invalid order status for payment retry'
            });
        }

        console.log('Creating new Razorpay order for amount:', order.totalAmount * 100);

        // Create new Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(order.totalAmount * 100),
            currency: 'INR',
            receipt: order._id.toString(),
            notes: {
                orderId: order._id.toString()
            }
        });

        console.log('New Razorpay order created:', razorpayOrder);

        // Update order with new Razorpay order ID and set status to Pending
        order.razorpayOrderId = razorpayOrder.id;
        order.status = 'Pending';  
        order.paymentStatus = 'Pending';
        await order.save();

        // Return payment details for frontend
        return res.json({
            success: true,
            order: razorpayOrder,
            key: process.env.RAZORPAY_KEY_ID,
            orderDetails: {
                name: order.user.name,
                email: order.user.email,
                amount: Math.round(order.totalAmount * 100),
                orderId: order._id,
                razorpayOrderId: razorpayOrder.id
            }
        });

    } catch (error) {
        console.error('Retry payment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize payment: ' + error.message
        });
    }
};

module.exports = {
    loadCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    checkout,
    placeOrder,
    verifyPayment,
    retryPayment
}