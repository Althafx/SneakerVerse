const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require('fs').promises;
const path = require('path');



//--------------------------------------------------------------------------------------------------------------------------------------------------------


//loads add products page
const getProductAddPage = async (req, res, next) => {
    try {
        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });
        res.render("product-add", {
            cat: category,
            brand: brand,
            path: '/admin/addProducts'
        });
    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//saving addded products
const addProducts = async (req, res, next) => {
    try {
        console.log("Request body:", req.body);
        const products = req.body;

        // Validate required fields
        const requiredFields = ['productName', 'description', 'brand', 'category', 'regularPrice', 'salePrice', 'color'];
        for (const field of requiredFields) {
            if (!products[field]) {
                return res.status(400).json({ message: `${field} is required` });
            }
        }

        // Parse quantities
        const quantities = {
            small: parseInt(products.small_quantity) || 0,
            medium: parseInt(products.medium_quantity) || 0,
            large: parseInt(products.large_quantity) || 0
        };

        // Calculate total quantity
        const totalQuantity = quantities.small + quantities.medium + quantities.large;

        if (totalQuantity === 0) {
            return res.status(400).json({ message: "At least one size must have quantity greater than 0" });
        }

        // Debug log
        console.log("Quantities being saved:", quantities);
        console.log("Total quantity:", totalQuantity);

        const productExists = await Product.findOne({
            productName: products.productName
        });
        
        if (productExists) {
            return res.status(400).json({ message: "Product already exists, try another name" });
        }

        // Initialize the images array
        const images = [];

        // Check if files were uploaded
        if (req.files) {
            // Process each image field (image1, image2, image3, image4)
            for (let i = 1; i <= 4; i++) {
                const fieldName = `image${i}`;
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    const file = req.files[fieldName][0];
                    images.push(file.filename);
                }
            }
        }

        if (images.length === 0) {
            return res.status(400).json({ message: "At least one image is required" });
        }

        // Find category by name and get its ID
        console.log("Looking for category:", products.category);
        const allCategories = await Category.find({});
        console.log("All available categories:", allCategories.map(c => c.name));
        
        const category = await Category.findOne({ 
            name: { $regex: new RegExp('^' + products.category + '$', 'i') }
        });
        
        console.log("Found category:", category);
        
        if (!category) {
            return res.status(400).json({ 
                message: "Invalid category",
                availableCategories: allCategories.map(c => c.name),
                receivedCategory: products.category
            });
        }

        // Create new product with the processed images
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: category._id,
            regularPrice: products.regularPrice,
            salesPrice: products.salePrice,
            color: products.color,
            quantities: quantities,
            totalQuantity: totalQuantity,
            productImage: images,
            status: "Available"
        });

        console.log("New product data:", newProduct);
        await newProduct.save();
        res.status(200).json({ message: "Product added successfully" });
    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//showing products in db
const getAllProducts = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
            ],
        })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate("category")
        .exec();

        // Log product data for debugging
        console.log('Product data sample:', productData.map(p => ({
            name: p.productName,
            quantities: p.quantities,
            totalQuantity: p.totalQuantity
        })));

        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
            ],
        }).countDocuments();

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        console.log('Rendering products page with data:', {
            productCount: productData.length,
            categoryCount: category.length,
            brandCount: brand.length,
            sampleProduct: productData[0] ? {
                name: productData[0].productName,
                quantities: productData[0].quantities,
                totalQuantity: productData[0].totalQuantity
            } : null
        });

        res.render("products", {
            title: "Admin Panel",
            data: productData,
            category,
            brand,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            search,
            path: '/admin/products'
        });
    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//opens edit control of products
const getEditProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category');
        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        if (!product) {
            req.session.message = {
                type: 'error',
                text: 'Product not found!'
            };
            return res.redirect('/admin/products');
        }

        console.log('Categories:', category); // Debug log
        console.log('Brands:', brand); // Debug log
        console.log('Product before transform:', product); // Debug log

        // Transform the data to match the template
        const transformedProduct = {
            _id: product._id,
            name: product.productName,
            description: product.description,
            brand: product.brand,
            category: product.category._id,
            regularPrice: product.regularPrice,
            salesPrice: product.salesPrice,
            quantities: product.quantities,
            totalQuantity: product.totalQuantity,
            color: product.color,
            productImage: product.productImage || [], // Changed from images to productImage
            status: product.status,
            size: product.size || [] // Add default empty array if size is undefined
        };

        console.log('Transformed product:', transformedProduct); // Debug log

        res.render('admin/edit-product.ejs', {
            product: transformedProduct,
            cat: category,
            brand: brand,
            message: req.session.message,
            path: '/admin/edit-product'
        });
        delete req.session.message;
    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//updates db with new added products
const updateProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const {
            productName,
            description,
            regularPrice,
            salesPrice,
            category,
            brand,
            small_quantity,
            medium_quantity,
            large_quantity,
            color,
            deletedImages
        } = req.body;

        console.log('Update request body:', req.body);
        console.log('Files:', req.files);
        console.log('Deleted images:', deletedImages);

        // Parse quantities
        const quantities = {
            small: parseInt(small_quantity) || 0,
            medium: parseInt(medium_quantity) || 0,
            large: parseInt(large_quantity) || 0
        };

        // Calculate total quantity
        const totalQuantity = quantities.small + quantities.medium + quantities.large;

        // Get the existing product
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found!'
            });
        }

        // Handle image updates
        let productImage = [...existingProduct.productImage] || []; // Create a copy of existing images

        // Handle image deletions if any were specified
        if (deletedImages) {
            try {
                const deletedImagesArray = JSON.parse(deletedImages);
                console.log('Parsed deleted images:', deletedImagesArray);

                // Remove deleted images from the productImage array
                productImage = productImage.filter(img => !deletedImagesArray.includes(img));

                // Delete the actual image files
                for (const filename of deletedImagesArray) {
                    try {
                        const imagePath = path.join(__dirname, '../../public/uploads/product-images', filename);
                        await fs.unlink(imagePath);
                        console.log(`Successfully deleted image: ${filename}`);
                    } catch (err) {
                        console.error(`Error deleting image file ${filename}:`, err);
                    }
                }
            } catch (err) {
                console.error('Error parsing deletedImages:', err);
            }
        }

        // Handle new image uploads
        if (req.files) {
            const newImages = [];
            for (let i = 1; i <= 4; i++) {
                const fieldName = `image${i}`;
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    newImages.push(req.files[fieldName][0].filename);
                }
            }
            productImage = [...productImage, ...newImages];
        }

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                productName,
                description,
                regularPrice,
                salesPrice,
                category,
                brand,
                quantities,
                totalQuantity,
                color,
                productImage,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Failed to update product'
            });
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: updatedProduct
        });

    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//blocking a producct
const blockProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        await Product.findByIdAndUpdate(productId, { 
            status: 'Blocked',
            isBlocked: true
        });
        
        // Return JSON response for AJAX request
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ 
                success: true, 
                message: 'Product blocked successfully'
            });
        }
        
        req.session.message = {
            type: 'success',
            text: 'Product blocked successfully!'
        };
        res.redirect('/admin/products');
    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//unblocking a product
const unblockProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        await Product.findByIdAndUpdate(productId, { 
            status: 'Available',
            isBlocked: false
        });
        
        // Return JSON response for AJAX request
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ 
                success: true, 
                message: 'Product unblocked successfully'
            });
        }

        req.session.message = {
            type: 'success',
            text: 'Product unblocked successfully!'
        };
        res.redirect('/admin/products');
    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//deleting a product
const deleteProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Delete the product's images
        if (product.productImage && product.productImage.length > 0) {
            for (const image of product.productImage) {
                try {
                    const imagePath = path.join(__dirname, '../../public/uploads/product-images', image);
                    await fs.unlink(imagePath);
                    console.log(`Deleted image: ${image}`);
                } catch (err) {
                    console.error(`Error deleting image ${image}:`, err);
                }
            }
        }

        await Product.findByIdAndDelete(productId);
        
        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        next(error);
    }

};


//--------------------------------------------------------------------------------------------------------------------------------------------------------

const addProductOffer = async (req, res) => {
    try {
        const { productId, percentge } = req.body;
        const findProduct = await Product.findOne({_id:productId});
        const findCategory = await Category.findOne({_id:findProduct.category});
        if(findCategory.categoryOffer>percentage){
            return res.json({status:false,message:"This products category already have a category offer"})
        }

        findProduct.salesPrice = findProduct.salesPrice.Math.floor(findProduct.regularPrice * (percentage/100))
        findProduct.productOffer = parseInt(percentage);
        await findProduct.save();
        findCategory.categoryOffer =0
        await findCategory.save();
        res.json({status:true})
           

    } catch (error) {
        res.redirect('/admin/products')
        res.status(500).json({status:false})
        next(error);
    }
}


const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;
        const findProduct = await Product.findOne({_id:productId});
        const percentage = findProduct.productOffer;


        findProduct.salesPrice = findProduct.salesPrice+Math.floor(findProduct.regularPrice * (percentage/100))
        findProduct.productOffer = 0
        await findProduct.save();
        
        res.json({status:true})
           

    } catch (error) {
        res.redirect('/admin/products')
        res.status(500).json({status:false})
        next(error);
    }
}



module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    getEditProduct,
    updateProduct,
    blockProduct,
    unblockProduct,
    deleteProduct,
    addProductOffer,
    removeProductOffer
};
