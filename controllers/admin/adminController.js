const User = require("../../models/userSchema")
const mongoose = require("mongoose")


//--------------------------------------------------------------------------------------------------------------------------------------------------------

//admin login
const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin/adminLogin",{message:null})
}

const login=async(req,res)=>{
   
    try{
        const {email,password} = req.body

        // Find the admin user in the database
        const findAdmin = await User.findOne({ email: email, isAdmin: true });
        if (!findAdmin) {
            return res.render("admin/adminLogin", { message: "No admin account found with this email" });
        }

        // Direct password comparison since we're not using bcrypt
        if (password === findAdmin.password) {
            req.session.admin = true;
            console.log("login success");
            return res.redirect("/admin/dashboard"); 
        } else {
            console.log("login failed");
            return res.render("admin/adminLogin", { message: "Incorrect password" });
        }
    }catch(error){
        console.log("login error",error)
        res.render("user/pageNotFound", { title: 'Error', message: "An error occurred during login" })
    }
}


const logout=async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("error destroying session",err)
                return res.render("user/pageNotFound", { title: 'Error', message: "Error destroying session" })
            }
            res.redirect("/")
        })
       
    } catch(error){
        console.log("logout error",error)
        res.render("user/pageNotFound", { title: 'Error', message: "An error occurred during logout" })
    }
   
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------

//dshboard controlling
const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin");
        }
        res.render("admin/dashboard", {
            admin: req.session.admin,
            path: '/admin/dashboard'
        });
    } catch (error) {
        console.log("Error loading dashboard:", error);
        res.render("user/pageNotFound", { title: 'Error', message: "Error loading dashboard" })
    }
};

// Add path middleware for all admin routes
const addPathMiddleware = (req, res, next) => {
    res.locals.path = req.path; // This will be available in all templates
    next();
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------




module.exports = {
    loadLogin,
    login,
    logout,
    loadDashboard,

    addPathMiddleware
}