const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");

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

module.exports = {
    loadCart,
    addToCart,
    updateQuantity,
    removeFromCart
}