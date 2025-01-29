const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")
const productController = require("../controllers/user/productController")
const cartController = require("../controllers/user/cartController")
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
router.get("/productDetails", isBlockedUser, productController.productDetails)
router.get("/filter-products", isBlockedUser, productController.filterProducts)


//--------------------------------------------------------------------------------------------------------------------------------------------------------



//user profile route
router.get("/userprofile", userAuth, isBlockedUser, userController.profile)
router.post("/update-name", userAuth, isBlockedUser, userController.updateName)
router.post("/update-phone", userAuth, isBlockedUser, userController.updatePhone)
router.post("/update-password", userAuth, isBlockedUser, userController.updatePassword)
router.post("/add-address", userAuth, isBlockedUser, userController.addAddress)
router.get("/get-address/:id", userAuth, isBlockedUser, userController.getAddress)
router.put("/update-address/:id", userAuth, isBlockedUser, userController.updateAddress)
router.delete("/delete-address/:id", userAuth, isBlockedUser, userController.deleteAddress)


//cart routes
router.get("/cart", userAuth, isBlockedUser, cartController.loadCart)
router.post("/cart/add", userAuth, isBlockedUser, cartController.addToCart)
router.put("/cart/update-quantity", userAuth, isBlockedUser, cartController.updateQuantity)
router.delete("/cart/remove/:productId/:size", userAuth, isBlockedUser, cartController.removeFromCart)

//forgot password routes
router.post('/forgot-password', userController.forgotPassword)
router.post('/verify-forgot-password-otp', userController.verifyForgotPasswordOtp)
router.post('/reset-password', userController.resetPassword)

//error page route
router.get("/pageNotFound", userAuth, isBlockedUser, userController.pageNotFound)

module.exports = router