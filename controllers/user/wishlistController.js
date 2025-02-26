const Wishlist = require('../../models/wishlistSchema');
const User = require('../../models/userSchema');

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const toggleWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to add items to wishlist' 
            });
        }

        const productId = req.params.productId;
        const userId = req.session.user._id;

        // Check if product exists in user's wishlist
        let wishlist = await Wishlist.findOne({ userId });
        
        if (!wishlist) {
            // Create new wishlist if it doesn't exist
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
            await wishlist.save();
            return res.json({ success: true, action: 'added' });
        }

        // Check if product is already in wishlist
        const productIndex = wishlist.products.findIndex(
            item => item.productId.toString() === productId
        );

        if (productIndex > -1) {
            // Remove product if it exists
            wishlist.products.splice(productIndex, 1);
            await wishlist.save();
            return res.json({ success: true, action: 'removed' });
        } else {
            // Add product if it doesn't exist
            wishlist.products.push({ productId });
            await wishlist.save();
            return res.json({ success: true, action: 'added' });
        }
    } catch (error) {
        console.error('Error in toggleWishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const getWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user._id;
        
        // Get user data
        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect('/login');
        }

        // Set user data in locals for header
        res.locals.user = userData;

        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId',
                populate: {
                    path: 'category',
                    select: 'name isBlocked'
                }
            });

        if (wishlist) {
            // Filter out blocked products and products from blocked categories
            wishlist.products = wishlist.products.filter(item => 
                item.productId && 
                !item.productId.isBlocked && 
                !item.productId.category.isBlocked
            );

            // Save the wishlist if any items were removed
            await wishlist.save();
        }
        
        // Set path in locals for active menu item
        res.locals.path = '/wishlist';
        
        res.render('user/wishlist', { 
            wishlist: wishlist ? wishlist.products : [],
            title: 'Wishlist',
            userData
        });
    } catch (error) {
        console.error('Error in getWishlist:', error);
        res.status(500).send('Internal Server Error');
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

// Helper function to check if a product is in wishlist
const isProductInWishlist = async (userId, productId) => {
    try {
        const wishlist = await Wishlist.findOne({
            userId,
            'products.productId': productId
        });
        return !!wishlist;
    } catch (error) {
        console.error('Error checking wishlist status:', error);
        return false;
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const removeFromWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to remove items from wishlist' 
            });
        }

        const productId = req.params.productId;
        const userId = req.session.user._id;

        // Find and update the wishlist
        const wishlist = await Wishlist.findOne({ userId });
        
        if (!wishlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Wishlist not found' 
            });
        }

        // Remove the product from wishlist
        const updatedWishlist = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { _id: productId } } },
            { new: true }
        );

        if (!updatedWishlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Failed to remove item from wishlist' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Item removed from wishlist successfully' 
        });
    } catch (error) {
        console.error('Error in removeFromWishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {
    toggleWishlist,
    getWishlist,
    isProductInWishlist,
    removeFromWishlist
};
