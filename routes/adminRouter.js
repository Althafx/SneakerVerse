const express = require("express");
const router = express.Router();
const { userAuth, adminAuth } = require("../middlewares/auth");

const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");

const multer = require("../helpers/multer"); // Import your configured multer instance

// Admin Error Page
router.get("/pageerror", adminController.pageerror);

// Admin Login
router.get("/login",adminAuth, adminController.loadLogin);
router.post("/login",adminAuth, adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/logout",adminAuth, adminController.logout);

// Customer Management
router.get("/users", adminAuth, customerController.customerInfo);
router.patch("/blockCustomer", adminAuth, customerController.customerBlocked);
router.patch("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category Management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.patch("/listCategory/:id", adminAuth, categoryController.getListCategory);
router.patch("/unlistCategory/:id", adminAuth, categoryController.getUnlistCategory);
router.put("/editCategory", adminAuth, categoryController.getEditCategory);
router.put("/editCategory/:id", adminAuth, categoryController.editCategory);
router.delete("/deleteCategory/:id", adminAuth, categoryController.deleteCategory);

// Brand Management
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, multer.uploadSingle, brandController.addBrand);
router.patch("/blockBrand", adminAuth, brandController.blockBrand);
router.patch("/unBlockBrand", adminAuth, brandController.unBlockBrand);
router.delete("/deleteBrand", adminAuth, brandController.deleteBrand);

// Product Management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post(
  "/addProducts",
  adminAuth,
  multer.uploadMultiple,
  productController.addProducts
);
router.get("/products", adminAuth, productController.getAllProducts);
router.get("/editProduct/:id", adminAuth, productController.getEditProduct);
router.patch("/editProduct/:id", adminAuth, multer.uploadMultiple, productController.updateProduct);
router.patch("/blockProduct/:id", adminAuth, productController.blockProduct);
router.patch("/unblockProduct/:id", adminAuth, productController.unblockProduct);
router.delete('/products/delete/:id', adminAuth, productController.deleteProduct);

module.exports = router;
