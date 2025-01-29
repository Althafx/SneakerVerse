const User = require("../models/userSchema")


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data&&!data.isBlocked){
                next()
            }else{
                res.redirect("/login")
            }

        })
        .catch(error=>{
            console.log("error in user auth middleware",error)
            res.status(500).send("Internal server error")
        })
        
    }else{
        res.redirect("/login")
    }
}




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
            const user = await User.findById(req.session.user);
            if (user && user.isBlocked) {
                // Clear user session if blocked
                delete req.session.user;
                return res.redirect('/login?message=' + encodeURIComponent('Your account has been blocked by admin. Please contact support.'));
            }
            next();
        } else {
            next(); // If no user session, let other middleware handle it
        }
    } catch (error) {
        console.error("Error in isBlockedUser middleware:", error);
        next(); // Proceed to next middleware in case of error
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


module.exports = {
    userAuth,
    adminAuth,
    isBlockedUser
};