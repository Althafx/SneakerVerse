const User = require("../../models/userSchema")
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Address = require('../../models/addressSchema');
const nodemailer = require("nodemailer")
const env = require("dotenv").config()
const bcrypt = require("bcrypt")


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//sign up controls
const loadSignup = async(req,res,next)=>{
    try{
        return res.render('signup')
    }catch(error){
        next(error);
    }

}



const signup = async(req,res,next)=>{
    
    
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
        next(error);
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

//--------------------------------------------------------------------------------------------------------------------------------------------------------

//otp controls

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
        console.error("Error verifying OTP:", error);
        res.status(500).json({ 
            success: false, 
            message: "An error occurred while verifying OTP" 
        });
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
        res.json({ success: true, message: "OTP resent successfully." });
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ 
            success: false, 
            message: "An error occurred while resending OTP" 
        });
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//login controls
const loadLogin = async (req, res, next) => {
    try {
        // Check if the user is already logged in
        if (!req.session.user) {
            // Extract optional query parameters for email and error messages
            const email = req.query.email || ""; // Default to an empty string
            const message = req.query.message || ""; 
            
            // Render the login page, passing email and error variables
            return res.render("login", { email, message });
        } else {
            // Redirect to the home page if the user is already logged in
            return res.redirect("/home");
        }
    } catch (error) {
        next(error);
    }

};





const login = async (req, res, next) => {
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
        next(error);
    }

};


const logout = async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("error in destroying session",err.message)
                res.render("user/pageNotFound", { 
                    title: 'Error', 
                    message: "Error during logout" 
                });
            } else {
                res.redirect("/login");
            }
        });
    } catch(error) {
        console.log("error in logout",error);
        res.render("user/pageNotFound", { 
            title: 'Error', 
            message: "Error during logout" 
        });
    }   
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//homepage controls
const loadHomepage = async (req, res, next) => {
    try {
        const user = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 8; // Number of products per page
        
        // Get all listed categories
        const listedCategories = await Category.find({ isListed: true }).select('_id');
        const listedCategoryIds = listedCategories.map(cat => cat._id);

        // Count total products for pagination
        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: listedCategoryIds }
        });

        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / limit);

        // Find paginated products
        const products = await Product.find({
            isBlocked: false,
            category: { $in: listedCategoryIds }
        })
        .populate('category')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }); // Show newest products first

        if (user) {
            const userData = await User.findOne({ _id: user });
            res.locals.user = userData;
            res.render('home', { 
                userData, 
                products,
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page + 1,
                prevPage: page - 1,
                lastPage: totalPages
            });
        } else {
            res.render('home', { 
                products,
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page + 1,
                prevPage: page - 1,
                lastPage: totalPages
            });
        }
    } catch (error) {
        next(error);
    }

}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//product page controls
const loadProductDetails = async (req, res, next) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category');

        if (!product) {
            return res.render("user/pageNotFound", { 
                title: 'Product Not Found', 
                message: "The product you're looking for is not available" 
            });
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
        next(error);
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//error page
const pageNotFound = async(req,res)=>{
    try {
        res.render("user/pageNotFound", {
            title: '404 Not Found',
            message: "The page you're looking for could not be found"
        });
    } catch(error) {
        console.log("error loading error page", error);
        res.status(404).send("Page Not Found");
    }
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const profile = async(req,res)=>{
    try{
        const userId = req.session.user;
        const user = await User.findById(userId);
        
        // Get user's addresses
        const userAddress = await Address.findOne({ userId });
        const addresses = userAddress ? userAddress.address : [];

        if (!user) {
            return res.redirect('/login');
        }

        res.render('user/userprofile', { 
            user: { 
                ...user.toObject(), 
                addresses 
            } 
        });
    }catch(error){
        console.error('Error loading profile:', error);
        res.render("user/pageNotFound", { 
            title: 'Error', 
            message: "Error loading profile" 
        });
    }
}

const updateName = async (req, res) => {
    try {
        const { newName } = req.body;
        const userId = req.session.user;

        // Validate name
        if (!newName || newName.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Name must be at least 2 characters long'
            });
        }

        // Update user name in database
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name: newName.trim() },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update session
        req.session.user = updatedUser._id;

        return res.status(200).json({
            success: true,
            message: 'Name updated successfully'
        });
    } catch (error) {
        console.error('Error updating name:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating name'
        });
    }
};

const updatePhone = async (req, res) => {
    try {
        const { newPhone } = req.body;
        const userId = req.session.user;

        // Validate phone number (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(newPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number'
            });
        }

        // Check if phone number already exists
        const existingUser = await User.findOne({ phone: newPhone, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'This phone number is already registered'
            });
        }

        // Update user phone in database
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { phone: newPhone },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Phone number updated successfully'
        });
    } catch (error) {
        console.error('Error updating phone number:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating phone number'
        });
    }
};

const updatePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.session.user;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Password validation regex: at least 8 chars, 1 letter, and 1 number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!newPassword || !passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long and contain at least 1 letter and 1 number'
            });
        }

        // Hash the new password
        const hashedPassword = await securePassword(newPassword);
        if (!hashedPassword) {
            return res.status(500).json({
                success: false,
                message: 'Error hashing password'
            });
        }

        // Update user password in database
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { password: hashedPassword },
            { new: true }
        );





        return res.status(200).json({
            success: true,
            message: 'Password updated successfully. Please login with your new password.',
            logout: true
        });



    } catch (error) {
        console.error('Error updating password:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating password'
        });
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressData = req.body;

        // Validate all required fields
        const requiredFields = ['addressType', 'name', 'city', 'landMark', 'state', 'pincode', 'phone', 'altPhone'];
        for (const field of requiredFields) {
            if (!addressData[field]) {
                return res.status(400).json({
                    success: false,
                    message: `${field} is required`
                });
            }
        }

        // Validate phone numbers
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(addressData.phone) || !phoneRegex.test(addressData.altPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter valid 10-digit phone numbers'
            });
        }

        // Validate pincode
        if (addressData.pincode.toString().length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 6-digit pincode'
            });
        }

        // Find existing address document for user or create new one
        let userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            userAddress = new Address({ userId, address: [] });
        }

        // Add new address to array
        userAddress.address.push(addressData);
        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address added successfully'
        });
    } catch (error) {
        console.error('Error adding address:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while adding the address'
        });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id;

        // Find user's address document
        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Remove address from array
        userAddress.address = userAddress.address.filter(addr => addr._id.toString() !== addressId);
        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting address:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the address'
        });
    }
};

const getAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id;

        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        const address = userAddress.address.find(addr => addr._id.toString() === addressId);
        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        return res.status(200).json({
            success: true,
            address
        });
    } catch (error) {
        console.error('Error fetching address:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the address'
        });
    }
};

const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id;
        const updatedData = req.body;

        // Validate all required fields
        const requiredFields = ['addressType', 'name', 'city', 'landMark', 'state', 'pincode', 'phone', 'altPhone'];
        for (const field of requiredFields) {
            if (!updatedData[field]) {
                return res.status(400).json({
                    success: false,
                    message: `${field} is required`
                });
            }
        }

        // Validate phone numbers
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(updatedData.phone) || !phoneRegex.test(updatedData.altPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter valid 10-digit phone numbers'
            });
        }

        // Validate pincode
        if (updatedData.pincode.toString().length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 6-digit pincode'
            });
        }

        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Update the address
        userAddress.address[addressIndex] = {
            ...userAddress.address[addressIndex].toObject(),
            ...updatedData
        };

        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address updated successfully'
        });
    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the address'
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------


//forgot password controls
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found with this email" 
            });
        }

        // Generate OTP
        const otp = generateOtp();
        
        // Send OTP to email
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(400).json({ 
                success: false, 
                message: "Failed to send OTP. Please try again." 
            });
        }

        // Store OTP in session for verification
        req.session.forgotPasswordOtp = otp;
        req.session.forgotPasswordEmail = email;
        
        res.status(200).json({ 
            success: true, 
            message: "OTP sent successfully" 
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ 
            success: false, 
            message: "An error occurred while processing forgot password request" 
        });
    }
};

const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        
        // Verify OTP
        if (otp === req.session.forgotPasswordOtp) {
            // OTP verified, allow password reset
            res.status(200).json({ 
                success: true, 
                message: "OTP verified successfully" 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: "Invalid OTP" 
            });
        }
    } catch (error) {
        console.error('Error in OTP verification:', error);
        res.status(500).json({ 
            success: false, 
            message: "An error occurred while verifying OTP" 
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const email = req.session.forgotPasswordEmail;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: "Session expired. Please try again." 
            });
        }

        // Find user and update password
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Hash the new password
        const hashedPassword = await securePassword(newPassword);
        
        // Update user's password
        await User.updateOne(
            { email },
            { $set: { password: hashedPassword } }
        );

        // Clear session data
        delete req.session.forgotPasswordOtp;
        delete req.session.forgotPasswordEmail;

        res.status(200).json({ 
            success: true, 
            message: "Password reset successful" 
        });
    } catch (error) {
        console.error('Error in password reset:', error);
        res.status(500).json({ 
            success: false, 
            message: "An error occurred while resetting password" 
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------


module.exports = {
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadHomepage,
    loadProductDetails,
    pageNotFound,
    profile,
    updateName,
    updatePhone,
    updatePassword,
    addAddress,
    deleteAddress,
    getAddress,
    updateAddress,
    forgotPassword,
    verifyForgotPasswordOtp,
    resetPassword
}