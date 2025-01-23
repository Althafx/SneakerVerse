const User = require("../../models/userSchema")
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const nodemailer = require("nodemailer")
const env = require("dotenv").config()
const bcrypt = require("bcrypt")

const pageNotFound = async(req,res)=>{
    try{
        res.render("pageNotFound")
    }catch(error){
        res.redirect("/pageNotFound")
        console.log("error loading error page")
    }

}

const loadSignup = async(req,res)=>{
    try{
        return res.render('signup')
    }catch(error){
        console.log("home page not loading",error)
        res.status(500).send("server error")
    }
}

function generateOtp(){
    return Math.floor(1000 + Math.random() * 9000).toString()
}
async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }

        })
        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"verify your account",
            text:`Your otp is ${otp}`,
            html:`<b>YOUR OTP:${otp}</b>`
        })

        return info.accepted.length>0

    }
    catch(error){
        console.log("error sending email",error)
        return false
    }
}

const signup = async(req,res)=>{
    
    
    try{
        const {name,email,phone,password,confirmPassword} = req.body
        if(password!=confirmPassword){
            return res.render("signup",{message:"passwords do not match"})
        }

        const findUser = await User.findOne({email})
        if(findUser){
            return res.render("signup",{message:"user with this email already exists"})
        }

        const otp = generateOtp()

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.render("signup", { message: "Failed to send OTP. Try again." });
        }
        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };
        res.render("verify-Otp");
        console.log("OTP Sent",otp)
       
    }catch(error){
        console.error('Error checking email:', error); // Log the error details
        error2.style.display = "block";
        error2.innerHTML = "Unable to validate email. Try again later.";
        console.error("signup error",error)
        res.redirect("/pageNotFound")
       
    }
}







const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        
        // Get all listed categories
        const listedCategories = await Category.find({ isListed: true }).select('_id');
        const listedCategoryIds = listedCategories.map(cat => cat._id);

        // Find products that are not blocked and belong to listed categories
        const products = await Product.find({
            isBlocked: false,
            category: { $in: listedCategoryIds }
        }).populate('category');

        if (user) {
            const userData = await User.findOne({ _id: user });
            res.locals.user = userData;
            res.render('home', { userData, products });
        } else {
            res.render('home', { products });
        }
    } catch (error) {
        console.error('Error loading homepage:', error);
        res.redirect('/error');
    }
}

const securePassword = async(password)=>{
    try{
        
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    }catch(error){
        console.log("error hashing password",error)
        return false
    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            });
            await saveUserData.save();
            req.session.user = saveUserData;
            res.json({ success: true, redirectUrl: "/home" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error Verifying OTP", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        const otp = generateOtp();
        console.log("resend otp",otp)
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.status(400).json({ success: false, message: "Failed to resend OTP." });
        }

        req.session.userOtp = otp;
        // console.log(otp)
        res.json({ success: true, message: "OTP resent successfully." });
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


const loadLogin = async (req, res) => {
    try {
        // Check if the user is already logged in
        if (!req.session.user) {
            // Extract optional query parameters for email and error messages
            const email = req.query.email || ""; // Default to an empty string
            const message = req.query.message || ""; // Default to an empty string
            
            // Render the login page, passing email and error variables
            return res.render("login", { email, message });
        } else {
            // Redirect to the home page if the user is already logged in
            return res.redirect("/home");
        }
    } catch (error) {
        // Redirect to a generic error page if something goes wrong
        console.error("Error loading login page:", error);
        return res.redirect("/pageNotFound");
    }
};



const logout = async(req,res)=>{
    try{
        req.session.destroy((err)=>{
            if(err){
                console.log("error in destroying session",err.message)
                res.redirect("/pageNotFound")
            }
        })
        res.redirect("/login")
}
catch(error){
    console.log("error in logout",error)
    res.redirect("/pageNotFound")
}   
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email or password is missing
        if (!email || !password) {
            return res.render("login", { message: "Email and password are required" });
        }

        // Find the user in the database
        const findUser = await User.findOne({ email: email });
        if (!findUser) {
            return res.render("login", { message: "No account found with this email" });
        }

        // Check if the user is blocked
        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by the admin" });
        }

        // Validate the password
        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect password or email" });
        }

        // Successful login: store the user ID in the session
        req.session.user = findUser.id;

        // Redirect to user homepage
        return res.redirect("/home");
    } catch (error) {
        console.error("Error in login:", error);
        return res.render("login", { message: "An error occurred during login. Please try again." });
    }
};

const loadProductDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category');

        if (!product) {
            return res.redirect('/error');
        }

        // Fetch related products from the same category
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },  // Exclude current product
            isBlocked: false,
            status: 'Available'
        })
        .populate('category')
        .limit(4);  // Show only 4 related products

        res.render('user/product-details', {
            product,
            relatedProducts
        });
    } catch (error) {
        console.log(error.message);
        res.redirect('/error');
    }
};

module.exports = {
     loadHomepage,
     pageNotFound ,
     loadSignup,
     signup,
     verifyOtp,
     resendOtp,
     loadLogin,
     login,
     logout,
     loadProductDetails
}