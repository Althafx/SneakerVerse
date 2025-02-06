const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

//load category page
const categoryInfo = async(req,res,next)=>{
    try{
        const page = parseInt(req.query.page) || 1
        const limit = 4
        const  skip = (page-1)*limit

        const categoryData = await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalCategories/limit)
        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories,
            path: '/admin/category'
        })
    }catch(error){
        next(error);
    }

}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//add categories 
const addCategory = async(req,res,next)=>{
    const {name, description} = req.body;
    try {
        // Trim the name to remove any leading/trailing spaces
        const trimmedName = name.trim();

        // Escape special characters in the name for regex
        const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Check if category exists (case-insensitive)
        const existingCategory = await Category.findOne({
            name: { 
                $regex: new RegExp(`^${escapedName}$`, 'i')
            }
        });

        if (existingCategory) {
            console.log('Found existing category:', existingCategory); // Debug log
            return res.status(400).json({
                success: false,
                error: "Category already exists (names are case-insensitive)"
            });
        }

        // Input validation
        if (!trimmedName || !description) {
            return res.status(400).json({
                success: false,
                error: "Category name and description are required"
            });
        }

        if (trimmedName.length < 3) {
            return res.status(400).json({
                success: false,
                error: "Category name must be at least 3 characters"
            });
        }

        if (description.length < 10) {
            return res.status(400).json({
                success: false,
                error: "Description must be at least 10 characters"
            });
        }

        // Create new category with trimmed name
        const newCategory = new Category({
            name: trimmedName,
            description
        });

        await newCategory.save();
        return res.json({
            success: true,
            message: "Category added successfully"
        });
    } catch(error) {
        next(error);
    }

}

//--------------------------------------------------------------------------------------------------------------------------------------------------------



//get listed categories
const getListCategory = async(req,res,next)=>{
    try {
        const id = req.params.id;
        
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { $set: { isListed: false } },
            { new: true }
        );
        
        if (!updatedCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            message: 'Category unlisted successfully'
        });
    } catch(error) {
        next(error);
    }

}




//--------------------------------------------------------------------------------------------------------------------------------------------------------



//get unlisted categories
const getUnlistCategory = async(req,res,next)=>{
    try {
        const id = req.params.id;
        
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { $set: { isListed: true } },
            { new: true }
        );
        
        if (!updatedCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            message: 'Category listed successfully'
        });
    } catch(error) {
        next(error);
    }

}


//--------------------------------------------------------------------------------------------------------------------------------------------------------




//get edit category
const getEditCategory = async(req,res,next)=>{
    try{
        const id = req.query.id
        const category = await Category.findOne({_id:id})
        res.render("edit-category",{category:category, path: '/admin/category'})
    }catch(error){
        next(error);
    }
}



//--------------------------------------------------------------------------------------------------------------------------------------------------------



//edit category
const editCategory = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;
        const trimmedName = categoryName.trim();
        const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Input validation
        if (!trimmedName || !description) {
            return res.status(400).json({
                success: false,
                error: "Category name and description are required"
            });
        }

        if (trimmedName.length < 3) {
            return res.status(400).json({
                success: false,
                error: "Category name must be at least 3 characters"
            });
        }

        if (description.length < 10) {
            return res.status(400).json({
                success: false,
                error: "Description must be at least 10 characters"
            });
        }

        // Check if category exists (excluding current category)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                error: "Category name already exists"
            });
        }

        // Update the category
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                name: trimmedName,
                description: description,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({
                success: false,
                error: "Category not found"
            });
        }

        res.json({
            success: true,
            message: "Category updated successfully",
            category: updatedCategory
        });
    } catch (error) {
        next(error);
    }

};



//--------------------------------------------------------------------------------------------------------------------------------------------------------


//delete category
const deleteCategory = async (req, res, next) => {
    try {
        const categoryId = req.params.id;
        
        // Check if category exists
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Check if any products are using this category
        const Product = require('../../models/productSchema');
        const productsWithCategory = await Product.countDocuments({ category: categoryId });
        
        if (productsWithCategory > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category as it is being used by products'
            });
        }

        // Delete the category
        await Category.findByIdAndDelete(categoryId);
        
        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        next(error);
    }

};


const addOffer = async (req, res) => {
    try {
        const percentage = Number(req.body.percentage);
        const categoryId = req.body.categoryId;

        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            return res.status(400).json({ status: false, message: "Invalid percentage value" });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(400).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });
        if (products.length === 0) {
            return res.json({ status: false, message: "No products found in this category" });
        }

        // Check if any product has a better offer
        const hasProductOffer = products.some(product => product.productOffer > percentage);
        if (hasProductOffer) {
            return res.json({ status: false, message: "Some products in this category already have better offers" });
        }

        // Update category offer
        category.categoryOffer = percentage;
        await category.save();

        // Update each product's offer
        for (const product of products) {
            // Only apply category offer if there's no product offer
            if (!product.productOffer || product.productOffer <= 0) {
                // Store current salesPrice before applying offer
                product.mainPrice = product.salesPrice;

                // Calculate discount from salesPrice
                const discountAmount = Math.floor(product.salesPrice * (percentage / 100));
                product.salesPrice = product.salesPrice - discountAmount;
                product.offer = {
                    discountedPrice: product.salesPrice,
                    discountPercentage: percentage
                };
                await product.save();
            }
        }

        res.json({ status: true, message: "Offer added successfully" });
    } catch (error) {
        console.error("Error in addOffer:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


const removeOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        
        if (!categoryId) {
            return res.status(400).json({ 
                status: false, 
                message: "Category ID is required" 
            });
        }

        // Find the category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ 
                status: false, 
                message: "Category not found" 
            });
        }

        // Find all products in this category
        const products = await Product.find({ category: categoryId });

        // Update each product
        for (const product of products) {
            // Only update if the product doesn't have its own offer
            if (!product.productOffer || product.productOffer <= 0) {
                // Restore original salesPrice
                product.salesPrice = product.mainPrice;
                product.offer = {
                    discountedPrice: null,
                    discountPercentage: 0
                };
                await product.save();
            }
        }

        // Reset category offer
        category.categoryOffer = 0;
        await category.save();

        res.json({ 
            status: true, 
            message: "Category offer removed successfully" 
        });

    } catch (error) {
        console.error("Error in removeOffer:", error);
        res.status(500).json({ 
            status: false, 
            message: "Internal server error" 
        });
    }
};








//--------------------------------------------------------------------------------------------------------------------------------------------------------


module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    deleteCategory,
    addOffer,
    removeOffer
};