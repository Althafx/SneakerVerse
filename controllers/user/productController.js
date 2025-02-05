const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

//--------------------------------------------------------------------------------------------------------------------------------------------------------


const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        console.log("productId",productId)
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
console.log("product",product)
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

const filterProducts = async (req, res) => {
    try {
        const { search, category, brand, sort, page = 1 } = req.query;
        const productsPerPage = 8; // 4 products per row * 2 rows
        
        console.log('Received filter request with:', { search, category, brand, sort, page });
        
        // Build the filter query
        let query = { isBlocked: false };
        
        // Add search filter
        if (search) {
            query.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } }
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

        console.log('MongoDB query:', JSON.stringify(query, null, 2));
        
        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / productsPerPage);
        
        // Get products with filters
        let sortQuery = {};
        
        // Apply sorting at the database level
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

        console.log('MongoDB sort query:', JSON.stringify(sortQuery, null, 2));

        // Fetch products with pagination
        const products = await Product.find(query)
            .populate('category')
            .sort(sortQuery)
            .skip((page - 1) * productsPerPage)
            .limit(productsPerPage)
            .lean();

        // Log sample data
        if (products.length > 0) {
            console.log('Products on page', page, ':');
            products.forEach((p, i) => {
                console.log(`Product ${i + 1}:`, {
                    id: p._id,
                    name: p.productName,
                    price: p.salesPrice,
                    createdAt: p.createdAt
                });
            });
        }

        console.log(`Found ${products.length} products on page ${page} of ${totalPages}`);
        
        res.json({ 
            success: true, 
            products,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProducts,
                productsPerPage
            },
            debug: {
                appliedSort: sort,
                sortQuery,
                totalProducts: products.length
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

module.exports = {
    productDetails,
    filterProducts,
    filterProductsOld
};