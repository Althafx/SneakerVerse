const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");



const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        
        // Get the product and populate its category
        const product = await Product.findById(productId).populate('category');

        if (!product || !product.category.isListed) {
            return res.redirect('/error');
        }

        // Fetch related products from the same category that are not blocked
        // and ensure the category is still listed
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },
            isBlocked: false
        })
        .populate({
            path: 'category',
            match: { isListed: true }
        })
        .limit(4);

        // Filter out products whose categories didn't match (weren't listed)
        const filteredRelatedProducts = relatedProducts.filter(prod => prod.category);

        res.render("user/product-details", { 
            user: userData, 
            product,
            relatedProducts: filteredRelatedProducts
        });
    } catch (error) {
        console.error('Error in product details:', error);
        res.redirect('/error');
    }
};

module.exports = {
    productDetails
}