const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")
const productController = require("../controllers/user/productController")
const cartController = require("../controllers/user/cartController")
const orderController = require("../controllers/user/orderController")
const wishlistController = require("../controllers/user/wishlistController")
const walletController = require("../controllers/user/walletController")
const returnRequestController = require('../controllers/user/returnRequestController');
const userCouponController = require('../controllers/user/couponController');
const { userAuth, isBlockedUser } = require('../middlewares/auth');


//--------------------------------------------------------------------------------------------------------------------------------------------------------

// Render the temporary landing page
router.get("/",(req, res) => {
    res.render("landing"); 
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------

// home page
router.get("/home", isBlockedUser, userController.loadHomepage)


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//signup routes
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//login routes
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout", userAuth, isBlockedUser, userController.logout);


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//google authentication route
router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}))
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}), isBlockedUser, (req,res)=>{
    req.session.user = req.user
    res.redirect("/home")
})


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//product details route
router.get('/api/products/filter', productController.filterProducts);
router.get("/productDetails", isBlockedUser, productController.productDetails)
router.get("/filter-products", isBlockedUser, productController.filterProducts)


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//user profile route
router.get("/userprofile", isBlockedUser, userController.profile)
router.post("/update-name", userAuth, isBlockedUser, userController.updateName)
router.post("/update-phone", userAuth, isBlockedUser, userController.updatePhone)
router.post("/update-password", userAuth, isBlockedUser, userController.updatePassword)
router.post("/add-address", userAuth, isBlockedUser, userController.addAddress)
router.get("/get-address/:id", userAuth, isBlockedUser, userController.getAddress)
router.put("/update-address/:id", userAuth, isBlockedUser, userController.updateAddress)
router.delete("/delete-address/:id", userAuth, isBlockedUser, userController.deleteAddress)


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//cart routes
router.get("/cart", userAuth, isBlockedUser, cartController.loadCart)
router.post("/cart/add", userAuth, isBlockedUser, cartController.addToCart)
router.put("/cart/update-quantity", userAuth, isBlockedUser, cartController.updateQuantity)
router.delete("/cart/remove/:productId/:size", userAuth, isBlockedUser, cartController.removeFromCart)


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//checkout routes
router.get("/checkout", userAuth, isBlockedUser, cartController.checkout)
router.post("/checkout/place-order", userAuth, isBlockedUser, cartController.placeOrder)
router.post("/verify-payment", userAuth, isBlockedUser, cartController.verifyPayment)
router.post("/retry-payment", userAuth, isBlockedUser, cartController.retryPayment)
router.get("/success", userAuth, isBlockedUser, (req, res) => {
    res.render('user/ordersuccess', {
        user: req.session.user,
        error_msg: req.flash('error'),
        success_msg: req.flash('success')
    });
})


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//order routes
router.get("/orders", userAuth, isBlockedUser, orderController.loadOrders)
router.post("/cancel-order/:orderId", userAuth, isBlockedUser, orderController.cancelOrder)
router.get("/order-details/:orderId", userAuth, isBlockedUser, orderController.getOrderDetails)
router.post("/cancel-order-item/:orderId/:itemId", userAuth, isBlockedUser, orderController.cancelOrderItem)


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//wishlist routes
router.post("/toggle-wishlist/:productId", userAuth, isBlockedUser, wishlistController.toggleWishlist);
router.get("/wishlist", userAuth, isBlockedUser, wishlistController.getWishlist);


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//forgot password routes
router.post('/forgot-password', userController.forgotPassword)
router.post('/verify-forgot-password-otp', userController.verifyForgotPasswordOtp)
router.post('/reset-password', userController.resetPassword)


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//error page route
router.get("/pageNotFound", userAuth, isBlockedUser, userController.pageNotFound)


//--------------------------------------------------------------------------------------------------------------------------------------------------------



// Category routes
router.get('/category/:category', userAuth, userController.getCategory);
router.get('/api/products/filter', userController.filterProducts);
router.get('/api/products/categorySearch', userController.categorySearch);
router.get('/api/products/categorySort', userController.categorySort);

// Wallet routes
router.get("/wallet", userAuth, isBlockedUser, walletController.getWalletPage)
router.post("/wallet/create-order", userAuth, isBlockedUser, walletController.createOrder)
router.post("/wallet/verify-payment", userAuth, isBlockedUser, walletController.verifyPayment)
router.get("/wallet/transactions", userAuth, isBlockedUser, walletController.getTransactions)

// Return request routes
router.post('/submit-return-request', userAuth, isBlockedUser, returnRequestController.submitReturnRequest);

// Coupon routes
router.post('/coupons/validate', userAuth, userCouponController.validateCoupon);
router.get('/coupons/applicable', userAuth, userCouponController.getApplicableCoupons);
router.post('/coupons/apply', userAuth, userCouponController.applyCoupon);
router.post('/coupons/remove', userAuth, userCouponController.removeCoupon);

module.exports = router