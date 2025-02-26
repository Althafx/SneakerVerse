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
        const category = await Category.findById(product.category);

        if (!product || !product.category.isListed) {
            return res.render("user/pageNotFound", { 
                title: 'Product Not Found', 
                message: "The product you're looking for is not available" 
            });
        }

        // Check if the category has an offer
        if (category && category.categoryOffer) {
            const discountPercentage = category.categoryOffer;
            const discountedPrice = Math.floor(product.salesPrice * (1 - discountPercentage / 100));

            // Attach the offer information to the product
            product.offer = {
                discountPercentage,
                discountedPrice
            };
        }

        // Get related products based on the category
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
        
     

        // Render the product details page with the updated product
        res.render("user/product-details", { 
            user: userData, 
            product: product,
            relatedProducts: filteredRelatedProducts,
        });
    } catch (error) {
        console.error('Error in product details:', error);
        res.render("user/pageNotFound", { 
            title: 'Error', 
            message: "An error occurred while loading product details" 
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const filterProducts = async (req, res) => {
    try {
        const { search, category, brand, sort, page = 1 } = req.query;
        const productsPerPage = 8;
        
       
        
        // Build the filter query
        let query = { isBlocked: false };
        
        // Add search filter with category name
        if (search) {
            const categories = await Category.find({
                name: { $regex: search, $options: 'i' }
            }).select('_id');
            
            const categoryIds = categories.map(cat => cat._id);
            
            query.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { category: { $in: categoryIds } }
            ];
        }
        
        // Add category filter
        if (category && category !== 'all') {
            query.category = category;
        }
        
        // Add brand filter
        if (brand && brand !== 'all') {
            query.brand = { $regex: new RegExp('^' + brand + '$', 'i') };
        }

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / productsPerPage);
        
        // Get products with filters
        let sortQuery = {};
        
        switch (sort) {
            case 'price-low':
                sortQuery = { salesPrice: 1 };
                break;
            case 'price-high':
                sortQuery = { salesPrice: -1 };
                break;
            case 'new':
                sortQuery = { createdAt: -1 };
                break;
            case 'a-z':
                sortQuery = { productName: 1 };
                break;
            case 'z-a':
                sortQuery = { productName: -1 };
                break;
            default:
                sortQuery = { createdAt: -1 };
        }

        // Fetch products with pagination and populate category with offer information
        const products = await Product.find(query)
            .populate({
                path: 'category',
                select: 'name categoryOffer isListed'
            })
            .sort(sortQuery)
            .skip((page - 1) * productsPerPage)
            .limit(productsPerPage)
            .lean();

        // Process products to include correct offer information
        const processedProducts = products.map(product => {
            const processed = { ...product };
            // Only include offer information if category has an offer
            if (product.category && product.category.categoryOffer) {
                processed.offer = {
                    discountPercentage: product.category.categoryOffer,
                    discountedPrice: Math.floor(product.salesPrice * (1 - product.category.categoryOffer / 100))
                };
            } else {
                // Remove offer property if no valid offer exists
                delete processed.offer;
            }
            return processed;
        });
        
        res.json({ 
            success: true, 
            products: processedProducts,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProducts,
                productsPerPage
            }
        });
    } catch (error) {
        console.error('Error in filterProducts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------


const filterProductsOld = async (req, res) => {
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

//--------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {
    productDetails,
    filterProducts,
    filterProductsOld
};