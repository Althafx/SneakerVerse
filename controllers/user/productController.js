const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        
        const product = await Product.findById(productId).populate('category');

        if (!product || !product.category.isListed) {
            return res.render("user/pageNotFound", { 
                title: 'Product Not Found', 
                message: "The product you're looking for is not available" 
            });
        }

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

        const filteredRelatedProducts = relatedProducts.filter(prod => prod.category);

        res.render("user/product-details", { 
            user: userData, 
            product,
            relatedProducts: filteredRelatedProducts
        });
    } catch (error) {
        console.error('Error in product details:', error);
        res.render("user/pageNotFound", { 
            title: 'Error', 
            message: "An error occurred while loading product details" 
        });
    }
};

const filterProducts = async (req, res) => {
    try {
        const { search, sort, category, brand } = req.query;
        
        // Build the filter query
        const query = { isBlocked: false };
        
        // Add search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Add category filter
        if (category && category !== 'all') {
            query.category = category;
        }
        
        // Add brand filter
        if (brand && brand !== 'all') {
            query.brand = brand.toLowerCase();
        }
        
        // Create the sort object
        let sortQuery = {};
        switch (sort) {
            case 'price-low':
                sortQuery = { price: 1 };
                break;
            case 'price-high':
                sortQuery = { price: -1 };
                break;
            case 'new':
                sortQuery = { createdAt: -1 };
                break;
            case 'a-z':
                sortQuery = { name: 1 };
                break;
            case 'z-a':
                sortQuery = { name: -1 };
                break;
            default:
                sortQuery = { createdAt: -1 }; // Default sort by newest
        }
        
        // Fetch filtered products
        const products = await Product.find(query)
            .sort(sortQuery)
            .populate('category');
            
        // Return only necessary product data
        const filteredProducts = products.map(product => ({
            _id: product._id,
            name: product.name,
            price: product.price,
            images: product.images,
            brand: product.brand,
            category: product.category.name
        }));
        
        res.json({ success: true, products: filteredProducts });
    } catch (error) {
        console.error('Error in filtering products:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error occurred while filtering products' 
        });
    }
};

module.exports = {
    productDetails,
    filterProducts
};