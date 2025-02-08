const User = require("../models/userSchema")


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const userAuth = async (req, res, next) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.redirect("/login");
        }

        const user = await User.findById(req.session.user._id);
        if (!user || user.isBlocked) {
            return res.redirect("/login");
        }

        // Set req.user for use in controllers
        req.user = user;
        next();
    } catch (error) {
        console.log("Error in user auth middleware", error);
        res.status(500).send("Internal server error");
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const adminAuth = async(req,res,next)=>{
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
        next();
    } catch(error) {
        console.log("Error in admin auth middleware:", error);
        res.status(500).send("Internal server error");
    }
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const isBlockedUser = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await User.findById(req.session.user._id);
            if (user && user.isBlocked) {
                // Clear user session if blocked
                delete req.session.user;
                return res.redirect("/login");
            }
        }
        next();
    } catch (error) {
        console.log("Error in isBlockedUser middleware:", error);
        res.status(500).send("Internal server error");
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


module.exports = {
    userAuth,
    adminAuth,
    isBlockedUser
};