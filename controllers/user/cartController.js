const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");

const loadCart = async(req, res, next) => {
    try {
        if(!req.session.user) {
            return res.redirect("/login");
        }

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.product',
                model: 'Product',
                select: 'productName productImage salesPrice quantities'
            });

        // Filter out any invalid items
        if (cart && cart.items) {
            cart.items = cart.items.filter(item => 
                item && 
                item.product && 
                item.size && 
                typeof item.size === 'string'
            );
            await cart.save();
        }

        // Map size keys for display
        if (cart && cart.items) {
            cart.items.forEach(item => {
                if (item.product && item.product.quantities) {
                    const sizeKey = {
                        'S': 'small',
                        'M': 'medium',
                        'L': 'large'
                    }[item.size] || item.size.toLowerCase();
                    
                    item.availableQuantity = item.product.quantities[sizeKey] || 0;
                }
            });
        }

        // Set locals for the view
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

const updateQuantity = async (req, res, next) => {
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
        const cart = await Cart.findOne({ userId });
        const product = await Product.findById(productId);

        if (!cart || !product) {
            return res.status(404).json({
                success: false,
                message: 'Cart or product not found'
            });
        }

        // Find the cart item
        const cartItem = cart.items.find(item => 
            item.product.toString() === productId && 
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
        const availableStock = product.quantities[sizeKey] || 0;

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
        } else if (action === 'decrease') {
            if (newQuantity > 1) {
                newQuantity -= 1;
            }
        }

        // Update cart item quantity and price
        cartItem.quantity = newQuantity;
        cartItem.price = newQuantity * product.salesPrice;

        // Recalculate cart total
        cart.totalAmount = cart.items.reduce((total, item) => total + item.price, 0);

        await cart.save();

        res.json({
            success: true,
            message: 'Quantity updated successfully'
        });
    } catch (error) {
        next(error);

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
        const userId = req.session.user;
        const { addressId, paymentMethod } = req.body;
        console.log("place order",userId,addressId,paymentMethod)

        // Validate inputs
        if (!addressId || !paymentMethod) {
            req.flash('error', 'Missing required fields');
            return res.redirect('/checkout');
        }

        // Get cart and validate it's not empty
        const cart = await Cart.findOne({ userId })
            .populate('items.product');

        if (!cart || cart.items.length === 0) {
            req.flash('error', 'Your cart is empty');
            return res.redirect('/cart');
        }

        // Get delivery address from Address model
        const addressDoc = await Address.findOne({ userId });
        if (!addressDoc) {
            req.flash('error', 'No addresses found');
            return res.redirect('/checkout');
        }

        // Find the selected address
        const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            req.flash('error', 'Selected address not found');
            return res.redirect('/checkout');
        }

        // Check stock availability and update quantities
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (!product) {
                req.flash('error', 'One or more products not found');
                return res.redirect('/checkout');
            }

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
                    req.flash('error', 'Invalid size selected');
                    return res.redirect('/checkout');
            }

            // Check if enough stock is available
            if (product.quantities[sizeField] < item.quantity) {
                req.flash('error', `Sorry, only ${product.quantities[sizeField]} items available for ${product.productName} in size ${item.size}`);
                return res.redirect('/checkout');
            }

            // Reduce the stock quantity
            product.quantities[sizeField] -= item.quantity;
            
            // Update total quantity
            product.totalQuantity = product.quantities.small + product.quantities.medium + product.quantities.large;

            // Save the updated product
            await product.save();
            console.log(`Updated stock for ${product.productName}, size ${item.size}: ${product.quantities[sizeField]} remaining`);
        }

        // Calculate order total
        const orderTotal = cart.items.reduce((total, item) => {
            return total + (item.product.salesPrice * item.quantity);
        }, 0);

        // Create order items array
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            quantity: item.quantity,
            price: item.product.salesPrice,
            size: item.size,
            status: 'Pending'
        }));

        // Create new order with correctly mapped address fields
        const order = new Order({
            user: userId,
            items: orderItems,
            totalAmount: orderTotal,
            shippingAddress: {
                name: selectedAddress.name,
                street: selectedAddress.landMark, // Using landMark as street
                landmark: selectedAddress.landMark,
                city: selectedAddress.city,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
                mobile: selectedAddress.phone,
                alternativePhone: selectedAddress.altPhone
            },
            paymentMethod: paymentMethod,
            status: paymentMethod === 'cod' ? 'Pending' : 'Payment Pending'
        });

        await order.save();
        console.log("Order saved successfully:", order._id);

        // Clear the cart
        await Cart.findOneAndDelete({ userId: userId });

        // Handle wallet payment if selected
        if (paymentMethod === 'wallet') {
            const user = await User.findById(userId);
            if (!user) {
                req.flash('error', 'User not found');
                return res.redirect('/checkout');
            }
            if (user.wallet < orderTotal) {
                req.flash('error', 'Insufficient wallet balance');
                return res.redirect('/checkout');
            }
            user.wallet -= orderTotal;
            await user.save();
        }

        // Redirect based on payment method
        if (paymentMethod === 'online') {
            return res.redirect('/payment-gateway');
        }

        // Redirect to success page for COD and wallet payments
        return res.redirect('/success');

    } catch (error) {
        console.error('Place order error:', error);
        req.flash('error', 'Failed to place order. Please try again.');
        return res.redirect('/checkout');
    }
};



module.exports = {
    loadCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    checkout,
    placeOrder
}