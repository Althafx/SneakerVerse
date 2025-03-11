const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { adminAuth } = require('../middlewares/auth');
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const multer = require("../helpers/multer");
const dashboardController = require('../controllers/admin/dashboardController');
const adminReturnRequestController = require('../controllers/admin/returnRequestController');
const couponController = require('../controllers/admin/couponController');

// Add path middleware to all admin routes
router.use(adminController.addPathMiddleware);

// Admin Login
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/dashboard", adminAuth, dashboardController.getDashboardData);
router.get('/dashboard/chart-data', adminAuth, dashboardController.getChartDataAPI);
router.post("/generate-report", adminAuth, dashboardController.generateSalesReport);
router.get("/logout", adminAuth, adminController.logout);

// Customer Management
router.get("/users", adminAuth, customerController.customerInfo);
router.patch("/blockCustomer", adminAuth, customerController.customerBlocked);
router.patch("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category Management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.patch("/listCategory/:id", adminAuth, categoryController.getListCategory);
router.patch("/unlistCategory/:id", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory/:id", adminAuth, categoryController.getEditCategory);
router.put("/editCategory/:id", adminAuth, categoryController.editCategory);
router.delete("/deleteCategory/:id", adminAuth, categoryController.deleteCategory);

// Brand Management
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, multer.uploadSingle, brandController.addBrand);
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unblockBrand", adminAuth, brandController.unBlockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand);

// Product Management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, multer.uploadMultiple, productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.get("/editProduct/:id", adminAuth, productController.getEditProduct);
router.patch("/editProduct/:id", adminAuth, multer.uploadMultiple, productController.updateProduct);
router.patch("/blockProduct/:id", adminAuth, productController.blockProduct);
router.patch("/unblockProduct/:id", adminAuth, productController.unblockProduct);
router.delete('/products/delete/:id', adminAuth, productController.deleteProduct);

// Offer routes
router.post('/addCategoryOffer', adminAuth, categoryController.addOffer);
router.post('/removeCategoryOffer', adminAuth, categoryController.removeOffer);
router.post('/addProductOffer', adminAuth, productController.addProductOffer);
router.post('/removeProductOffer', adminAuth, productController.removeProductOffer);

// Coupon Management Routes
router.get('/offers', adminAuth, couponController.getCouponPage);
router.post('/coupons/add', adminAuth, couponController.addCoupon);
router.patch('/coupons/toggle/:couponId', adminAuth, couponController.toggleCouponStatus);
router.delete('/coupons/delete/:couponId', adminAuth, couponController.deleteCoupon);

// Return request management routes
router.get('/return-requests', adminAuth, adminReturnRequestController.getAllReturnRequests);
router.post('/update-return-status', adminAuth, adminReturnRequestController.updateReturnStatus);

// Order Management Routes
router.get('/orders', adminAuth, adminController.getOrders);
router.get('/order/:orderId', adminAuth, adminController.getOrderDetails);
router.post('/api/updateOrderStatus', adminAuth, adminController.updateOrderStatus);
router.post('/api/updateProductStatus', adminAuth, adminController.updateProductStatus);

module.exports = router;
