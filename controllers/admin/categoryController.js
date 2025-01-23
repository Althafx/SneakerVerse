const Category = require('../../models/categorySchema');

const categoryInfo = async(req,res)=>{
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
            totalCategories:totalCategories
        })
    }catch(error){

        console.error(error)
        res.redirect("/pageerror")

    }
}

const addCategory = async(req,res)=>{
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
        console.error('Error adding category:', error);
        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}

const getListCategory = async(req,res)=>{
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
        console.error('Error unlisting category:', error);
        res.status(500).json({
            success: false,
            message: 'Error unlisting category'
        });
    }
}

const getUnlistCategory = async(req,res)=>{
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
        console.error('Error listing category:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing category'
        });
    }
}

const getEditCategory = async(req,res)=>{
    try{
        const id = req.query.id
        const category = await Category.findOne({_id:id})
        res.render("edit-category",{category:category})
    }catch(error){
        res.redirect("/pageerror")
    }
}

const editCategory = async (req, res) => {
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
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
};

const deleteCategory = async (req, res) => {
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
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting category'
        });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    deleteCategory
}