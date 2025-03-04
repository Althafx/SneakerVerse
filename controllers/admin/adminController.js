const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const Order = require("../../models/orderSchema") // Assuming you have an order schema

//--------------------------------------------------------------------------------------------------------------------------------------------------------

//admin login
const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin/adminlogin",{message:null})
}

const login=async(req,res)=>{
   
    try{
        const {email,password} = req.body

        // Find the admin user in the database
        const findAdmin = await User.findOne({ email: email, isAdmin: true });
        if (!findAdmin) {
            return res.render("admin/adminlogin", { message: "No admin account found with this email" });
        }

        // Direct password comparison since we're not using bcrypt
        if (password === findAdmin.password) {
            req.session.admin = true;
          
            return res.redirect("/admin/dashboard"); 
        } else {
          
            return res.render("admin/adminlogin", { message: "Incorrect password" });
        }
    }catch(error){
        console.log("login error",error)
        res.render("user/pageNotFound", { title: 'Error', message: "An error occurred during login" })
    }
}


const logout=async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("error destroying session",err)
                return res.render("user/pageNotFound", { title: 'Error', message: "Error destroying session" })
            }
            res.redirect("/")
        })
       
    } catch(error){
        console.log("logout error",error)
        res.render("user/pageNotFound", { title: 'Error', message: "An error occurred during logout" })
    }
   
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------

//dshboard controlling
const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin");
        }
        res.render("admin/dashboard", {
            admin: req.session.admin,
            path: '/admin/dashboard'
        });
    } catch (error) {
        console.log("Error loading dashboard:", error);
        res.render("user/pageNotFound", { title: 'Error', message: "Error loading dashboard" })
    }
};

// Add path middleware for all admin routes
const addPathMiddleware = (req, res, next) => {
    res.locals.path = req.path; // This will be available in all templates
    next();
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

// Get all orders for admin management
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find()
            .populate('user', 'username email name')
            .populate({
                path: 'items.product',
                select: 'productName productImage salesPrice'
            })
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        res.render('admin/orderManage', {
            orders,
            admin: req.session.admin,
            path: '/admin/orders',
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


// Get detailed view of a specific order
const getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('user', 'name email phone')
            .populate({
                path: 'items.product',
                select: 'productName productImage salesPrice'
            });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Ensure shipping address fields are not undefined
        const shippingAddress = {
            name: order.shippingAddress?.name || order.user?.name || '',
            street: order.shippingAddress?.street || '',
            city: order.shippingAddress?.city || '',
            state: order.shippingAddress?.state || '',
            pincode: order.shippingAddress?.pincode || '',
            mobile: order.shippingAddress?.mobile || order.user?.phone || '',
            alternativePhone: order.shippingAddress?.alternativePhone || '',
            landmark: order.shippingAddress?.landmark || ''
        };

        // Create a sanitized order object
        const sanitizedOrder = {
            ...order.toObject(),
            shippingAddress: shippingAddress
        };

        res.json({
            success: true,
            order: sanitizedOrder
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order details'
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------


// Update order status
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
       

        const order = await Order.findByIdAndUpdate(
            orderId,
            { 
                $set: { 
                    'items.$[].status': status,
                    status: status 
                }
            },
            { 
                new: true,
                populate: {
                    path: 'items.product',
                    select: 'productName productImage salesPrice'
                }
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Emit socket event for real-time updates
        if (req.app.get('io')) {
            req.app.get('io').emit('orderStatusUpdate', {
                orderId: order._id,
                status: status,
                items: order.items
            });
        }

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

// Update individual product status in an order
const updateProductStatus = async (req, res) => {
    try {
        const { orderId, productId, status } = req.body;
       

        // Find the order and update the specific item's status
        const order = await Order.findOneAndUpdate(
            { 
                _id: orderId,
                'items._id': productId // Using item's _id instead of product._id
            },
            { 
                $set: { 
                    'items.$.status': status 
                }
            },
            { 
                new: true,
                populate: {
                    path: 'items.product',
                    select: 'productName productImage salesPrice'
                }
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order or item not found'
            });
        }

        // Update overall order status if all items have the same status
        const allItemsHaveSameStatus = order.items.every(item => item.status === status);
        if (allItemsHaveSameStatus) {
            order.status = status;
            await order.save();
        }

        // Emit socket event for real-time updates
        if (req.app.get('io')) {
            req.app.get('io').emit('orderStatusUpdate', {
                orderId: order._id,
                status: order.status,
                items: order.items.map(item => ({
                    _id: item._id,
                    product: {
                        _id: item.product._id,
                        productName: item.product.productName,
                        productImage: item.product.productImage
                    },
                    status: item.status,
                    size: item.size,
                    quantity: item.quantity
                }))
            });
        }

        res.json({
            success: true,
            message: 'Product status updated successfully',
            order: {
                _id: order._id,
                status: order.status,
                items: order.items.map(item => ({
                    _id: item._id,
                    product: {
                        _id: item.product._id,
                        productName: item.product.productName,
                        productImage: item.product.productImage
                    },
                    status: item.status,
                    size: item.size,
                    quantity: item.quantity
                }))
            }
        });
    } catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product status'
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {
    loadLogin,
    login,
    logout,
    loadDashboard,
    getOrders,
    getOrderDetails,
    updateOrderStatus,
    updateProductStatus,
    addPathMiddleware
}