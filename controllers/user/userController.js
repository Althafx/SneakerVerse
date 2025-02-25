const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Wishlist = require("../../models/wishlistSchema");
const { isProductInWishlist } = require('./wishlistController');
const nodemailer = require("nodemailer")
const env = require("dotenv").config()
const bcrypt = require("bcrypt") // Fixed path to offerController
const Address = require('../../models/addressSchema');
const Wallet = require('../../models/walletSchema');

//--------------------------------------------------------------------------------------------------------------------------------------------------------

// Function to generate random referral code
const generateReferralCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let isUnique = false;
    
    while (!isUnique) {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const existingUser = await User.findOne({ referralCode: code });
        if (!existingUser) {
            isUnique = true;
        }
    }
    return code;
};

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
        const {name, email, phone, password, confirmPassword, referralCode} = req.body
        
        console.log('Signup attempt with data:', {
            name,
            email,
            phone,
            referralCode: referralCode || 'None provided'
        });
        
        if(password!=confirmPassword){
            return res.render("signup",{message:"passwords do not match"})
        }

        const findUser = await User.findOne({email})
        if(findUser){
            return res.render("signup",{message:"user with this email already exists"})
        }

        // Validate and store referral code if provided
        if (referralCode && referralCode.trim()) {
            const cleanReferralCode = referralCode.trim().toUpperCase();
            console.log('Validating referral code:', cleanReferralCode);
            
            const referrer = await User.findOne({ referralCode: cleanReferralCode });
            if (!referrer) {
                console.log('Invalid referral code provided');
                return res.render("signup", { 
                    message: "Invalid referral code. Please check and try again.",
                    name,
                    email,
                    phone
                });
            }
            
            // Store valid referral code and referrer email in session
            req.session.referralCode = cleanReferralCode;
            req.session.referrerEmail = referrer.email;
            console.log('Valid referral code stored in session:', cleanReferralCode);
        }

        const otp = generateOtp()
        console.log('Generated OTP for verification');

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.render("signup", { message: "Failed to send OTP. Try again." });
        }
        
        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };
        console.log('User data stored in session, proceeding to OTP verification');
        
        res.render("verify-Otp");
    } catch(error){
        console.error('Signup error:', error);
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
        console.log(otp)

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
        console.log('Verifying OTP');
       
      
        
        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            // Generate referral code for new user
            const newReferralCode = await generateReferralCode();
            console.log('Generated new referral code:', newReferralCode);

            let initialWallet = 0;
            let referrerId = null;
            let referralSuccess = false;
            let referrerEmail = null;

            // Process referral if exists
            if (req.session.referralCode) {
                const referralCode = req.session.referralCode;
                console.log('Processing referral code from session:', referralCode);
                
                const referrer = await User.findOne({ referralCode });
                if (referrer) {
                    referrerEmail = referrer.email;
                    console.log('Found referrer:', referrer.email);
                    
                    // Create new user first
                    const saveUserData = new User({
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        password: passwordHash,
                        referralCode: newReferralCode,
                        wallet: 0,
                        referredBy: referrer._id
                    });
                    
                    const savedUser = await saveUserData.save();
                    
                    // Credit referrer's wallet
                    const referrerCredited = await creditWalletForReferral(
                        referrer._id,
                        1500,
                        `Referral bonus for inviting ${savedUser.email}`
                    );
                    
                    // Credit new user's wallet
                    const newUserCredited = await creditWalletForReferral(
                        savedUser._id,
                        1500,
                        `Welcome bonus for using ${referrer.email}'s referral code`
                    );
                    
                    if (referrerCredited && newUserCredited) {
                        referralSuccess = true;
                        console.log('Successfully credited both wallets');
                    }
                    
                    // Store user in session
                    req.session.user = savedUser;
                } else {
                    console.log('Referrer not found for code:', referralCode);
                }
            } else {
                // Create new user without referral
                const saveUserData = new User({
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    password: passwordHash,
                    referralCode: newReferralCode,
                    wallet: 0
                });
                
                const savedUser = await saveUserData.save();
                req.session.user = savedUser;
            }
            
            // Clear referral code from session
            delete req.session.referralCode;
            delete req.session.referrerEmail;
            
            // Return success with referral status
            res.json({ 
                success: true, 
                redirectUrl: "/home",
                referralSuccess,
                referrerEmail,
                walletCredit: referralSuccess ? 1500 : 0
            });
        } else {
            console.log('Invalid OTP provided');
            res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error in verifyOtp:", error);
        res.status(500).json({ 
            success: false, 
            message: "An error occurred while verifying OTP" 
        });
    }
};

async function creditWalletForReferral(userId, amount, description) {
    try {
        // Update or create wallet
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0 });
        }
        
        // Add transaction
        wallet.transactions.push({
            type: 'credit',
            amount: amount,
            description: description,
            status: 'completed'
        });
        
        // Update balance
        wallet.balance += amount;
        
        // Save wallet
        await wallet.save();
        
        // Update user's wallet field
        await User.findByIdAndUpdate(userId, { wallet: wallet.balance });
        
        return true;
    } catch (error) {
        console.error('Error crediting wallet:', error);
        return false;
    }
}

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
            return res.render("login", { message: "Your account has been blocked" });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render("login", { message: "Invalid password" });
        }

        // Check and generate referral code if not exists
        if (!findUser.referralCode) {
            console.log('Generating referral code for existing user:', findUser.email);
            findUser.referralCode = await generateReferralCode();
            await findUser.save();
            console.log('Generated referral code:', findUser.referralCode);
        }

        req.session.user = findUser;
        return res.redirect("/home");
    } catch (error) {
        console.error("Login error:", error);
        return res.render("login", { message: "An error occurred during login" });
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


const loadHomepage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        let query = { isListed: true };

        // Apply category filter if provided
        if (req.query.category) {
            query.category = req.query.category;
        }

        console.log("query", query);

        // Fetch categories with active offers
        const categoriesWithOffers = await Category.find({ categoryOffer: { $gt: 0 } }).lean();

        // Get products with pagination and filter out products with unlisted categories
        let products = await Product.find({ isBlocked: false })
            .populate({
                path: 'category',
                match: { isListed: true } // Only include products where category is listed
            })
            .skip(skip)
            .limit(limit)
            .lean();

        // Filter out products whose category is null (means category was not listed)
        products = products.filter(product => product.category !== null);

        console.log("Original products", products);

        // Check wishlist status if user is logged in
        if (req.session.user) {
            const userId = req.session.user._id;
            const wishlist = await Wishlist.findOne({ userId });
            
            products = products.map(product => {
                product.isInWishlist = wishlist && wishlist.products.some(item => 
                    item.productId.toString() === product._id.toString()
                );
                return product;
            });
        }

        // Apply category offers to products
        products = products.map(product => {
            const categoryOffer = categoriesWithOffers.find(cat => cat._id.equals(product.category._id));

            if (categoryOffer) {
                const discountPercentage = categoryOffer.categoryOffer;
                const discountedPrice = Math.floor(product.salesPrice * (1 - discountPercentage / 100));

                product.offer = {
                    discountPercentage,
                    discountedPrice
                };
            }

            return product;
        });

        console.log("Updated products with offers", products);

        // Get total count for pagination (only count products with listed categories)
        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: await Category.find({ isListed: true }).distinct('_id') }
        });
        const totalPages = Math.ceil(totalProducts / limit);

        // Get all categories for the sidebar
        const categories = await Category.find({ isListed: true }).lean();

        // Calculate pagination variables
        const hasPrevPage = page > 1;
        const hasNextPage = page < totalPages;
        const prevPage = hasPrevPage ? page - 1 : null;
        const nextPage = hasNextPage ? page + 1 : null;

        res.render('user/home', {
            products,
            categories,
            currentPage: page,
            totalPages,
            hasPrevPage,
            hasNextPage,
            prevPage,
            nextPage,
            user: req.session.user,
            title: 'Home',
            path: req.path,
            showBanner: true,
            currentPage: 'home'
        });

    } catch (error) {
        console.error('Error in loadHomepage:', error);
        res.status(500).send('Internal Server Error');
    }
};


const loadProductDetails = async (req, res) => {
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
        console.error('Error in loadProductDetails:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId)
            .populate('category')
            .lean();

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Calculate offer if any
        const offerDetails = await offerController.calculateDiscountedPrice(product);
        if (offerDetails) {
            product.offer = offerDetails;
        }

        res.render('user/product-details', {
            product,
            user: req.session.user,
            title: product.productName,
            path: req.path
        });
    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.status(500).send('Internal Server Error');
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


//error page
const pageNotFound = async(req,res)=>{
    try {
        res.render("user/pageNotFound", {
            title: '404 Not Found',
            message: "The page you're looking for could not be found",
            path: req.path
        });
    } catch(error) {
        console.log("error loading error page", error);
        res.status(404).send("Page Not Found");
    }
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const profile = async(req,res)=>{
    try {
        // Session check is now handled by userAuth middleware
        const user = await User.findById(req.session.user._id).lean();
        
        // Get user's addresses
        const userAddress = await Address.findOne({ userId: req.session.user._id });
        const addresses = userAddress ? userAddress.address : [];

        // Combine user data with addresses
        const userData = {
            ...user,
            addresses
        };

        res.render('user/userprofile', { 
            user: userData,
            error_msg: req.flash('error'),
            success_msg: req.flash('success'),
            path: '/userprofile'
        });

    } catch(error) {
        console.error('Error in profile route:', error);
        req.flash('error', 'Something went wrong');
        res.redirect('/home');
    }
}

const updateName = async (req, res) => {
    try {
        const { newName } = req.body;
        const userId = req.session.user._id;  // Get the user ID from the session

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

        // Update session with the complete user object
        req.session.user = {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            addresses: updatedUser.addresses,
            isAdmin: updatedUser.isAdmin
        };

        // Save session
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        return res.status(200).json({
            success: true,
            message: 'Name updated successfully',
            user: {
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone
            }
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
        const userId = req.session.user._id;  // Get the user ID from the session

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


const getCategory = async (req, res) => {
    try {
        const categoryName = req.params.category.charAt(0).toUpperCase() + req.params.category.slice(1).toLowerCase();
        const page = parseInt(req.query.page) || 1;
        const limit = 8; // Number of products per page
        
        // Find the category by name
        const category = await Category.findOne({ 
            name: categoryName,
            isListed: true 
        });

        if (!category) {
            console.log('Category not found:', categoryName);
            return res.redirect('/home');
        }

        // Get all listed categories for the sidebar
        const categories = await Category.find({ isListed: true });

        // Count total products in this category
        const totalProducts = await Product.countDocuments({
            category: category._id,
            isBlocked: false
        });

        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / limit);
        
        // Find products in this category with pagination
        const products = await Product.find({ 
            category: category._id,
            isBlocked: false 
        })
        .populate('category')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }); // Show newest products first

        console.log(`Found ${products.length} products for category ${categoryName}`);

        // Get user data if logged in
        let userData = null;
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user });
        }

        res.render('user/home', {
            products,
            categories,
            userData,
            user: req.session.user,
            path: `/category/${req.params.category.toLowerCase()}`,
            showBanner: false,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages
        });
    } catch (error) {
        console.error('Error fetching category products:', error);
        res.redirect('/home');
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------


const categorySearch = async (req, res) => {
    try {
        const { search, category, brand, sort } = req.query;
        
        // Find the category
        const categoryObj = await Category.findOne({
            name: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(),
            isListed: true
        });

        if (!categoryObj) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Build search query
        let searchQuery = {
            category: categoryObj._id,
            isBlocked: false
        };

        // Add search term if provided
        if (search && search.trim()) {
            searchQuery.productName = {
                $regex: new RegExp(search.trim(), 'i')
            };
        }

        // Add brand filter if provided
        if (brand && brand !== 'all') {
            searchQuery.brand = brand;
        }

        console.log('Search Query:', searchQuery);
        console.log('Sort Options:', sort);

        // Build sort options
        let sortOptions = {};
        switch (sort) {
            case 'price-low':
                sortOptions = { 'salesPrice': 1 };
                break;
            case 'price-high':
                sortOptions = { 'salesPrice': -1 };
                break;
            case 'a-z':
                sortOptions = { 'productName': 1 };
                break;
            case 'z-a':
                sortOptions = { 'productName': -1 };
                break;
            default: // 'new' or undefined
                sortOptions = { 'createdAt': -1 };
        }

        // Find products
        let products = await Product.find(searchQuery)
            .populate({
                path: 'category',
                match: { isListed: true }
            })
            .sort(sortOptions)
            .limit(12);

        // Filter out products whose category is null (means category was not listed)
        products = products.filter(product => product.category !== null);

        console.log(`Found ${products.length} products`);

        res.json({
            success: true,
            products
        });

    } catch (error) {
        console.error('Error in category search:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const filterProducts = async (req, res) => {
    try {
        const { search, category, brand, sort } = req.query;

        // Build search query
        let searchQuery = { isBlocked: false };

        // Add search term if provided
        if (search && search.trim()) {
            searchQuery.productName = {
                $regex: new RegExp(search.trim(), 'i')
            };
        }

        // Add category filter if provided
        if (category && category !== 'all') {
            searchQuery.category = category;
        }

        // Add brand filter if provided
        if (brand && brand !== 'all') {
            searchQuery.brand = brand;
        }

        console.log('Search Query:', searchQuery);
        console.log('Sort Options:', sort);

        // Build sort options
        let sortOptions = {};
        switch (sort) {
            case 'price-low':
                sortOptions = { 'salesPrice': 1 };
                break;
            case 'price-high':
                sortOptions = { 'salesPrice': -1 };
                break;
            case 'a-z':
                sortOptions = { 'productName': 1 };
                break;
            case 'z-a':
                sortOptions = { 'productName': -1 };
                break;
            default: // 'new' or undefined
                sortOptions = { 'createdAt': -1 };
        }

        // Find products with explicit collation for string sorting
        let products = await Product.find(searchQuery)
            .populate({
                path: 'category',
                match: { isListed: true } // Only include products where category is listed
            })
            .collation({ locale: 'en' }) // Add collation for proper string sorting
            .sort(sortOptions)
            .limit(12);

        // Filter out products whose category is null (means category was not listed)
        products = products.filter(product => product.category !== null);

        console.log(`Found ${products.length} products`);

        res.json({
            success: true,
            products
        });
    } catch (error) {
        console.error('Error in filterProducts:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------


const categorySort = async (req, res) => {
    try {
        const { category, sort } = req.query;
        
        // Find the category
        const categoryObj = await Category.findOne({
            name: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(),
            isListed: true
        });

        if (!categoryObj) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Build sort options
        let sortOptions = {};
        switch (sort) {
            case 'price-low':
                sortOptions = { 'salesPrice': 1 };
                break;
            case 'price-high':
                sortOptions = { 'salesPrice': -1 };
                break;
            case 'a-z':
                sortOptions = { 'productName': 1 };
                break;
            case 'z-a':
                sortOptions = { 'productName': -1 };
                break;
            default: // 'new' or undefined
                sortOptions = { 'createdAt': -1 };
        }

        // Find products
        let products = await Product.find({
            category: categoryObj._id,
            isBlocked: false
        })
        .populate({
            path: 'category',
            match: { isListed: true }
        })
        .sort(sortOptions)
        .limit(12);

        // Filter out products whose category is null (means category was not listed)
        products = products.filter(product => product.category !== null);

        console.log(`Found ${products.length} products`);

        res.json({
            success: true,
            products
        });

    } catch (error) {
        console.error('Error in category sort:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
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
    resetPassword,
    getCategory,
    categorySearch,
    categorySort,
    filterProducts,
    getProductDetails
}