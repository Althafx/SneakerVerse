const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")
const productController = require("../controllers/user/productController")
const userAuth = require('../middlewares/auth').userAuth;

router.get("/",(req, res) => {
    res.render("landing"); // Render the landing page
});
router.get("/home",userController.loadHomepage)

router.get("/pageNotFound",userAuth,userController.pageNotFound)
router.get('/signup',userAuth,userController.loadSignup)
router.post('/signup',userAuth,userController.signup)
router.post("/verify-otp",userAuth,userController.verifyOtp)
router.post("/resend-otp",userAuth,userController.resendOtp)

router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}))

router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
    req.session.user = req.user
    res.redirect("/home")
})

router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout",userAuth, userController.logout);

//product management
router.get("/productDetails", productController.productDetails)

module.exports = router