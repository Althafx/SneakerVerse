const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/")
    }
    res.render("adminlogin",{message:null})
}

const login=async(req,res)=>{
   
    try{
        const {email,password} = req.body

        // Find the admin user in the database
        const findAdmin = await User.findOne({ email: email, isAdmin: true });
        if (!findAdmin) {
            return res.render("adminlogin", { message: "No admin account found with this email" });
        }

        // Validate the password
        const passwordMatch = await (password, findAdmin.password);
        if (passwordMatch) {
            req.session.admin = true;
            console.log("login success");
            return res.redirect("/admin/dashboard"); 
        } else {
            console.log("login failed");
            return res.render("adminlogin", { message: "Incorrect password" });
        }
    }catch(error){
        console.log("login error",error)
        res.redirect("/page-not-found")
    }
}

const loadDashboard=(req,res)=>{
    if(req.session.admin){
        try{
            res.render("dashboard")

        }catch(error){
            console.log("dashboard error",error)
            res.redirect("/page-not-found")
        }
       
    }
}

const pageerror=async(req,res)=>{
    res.render("pageerror")
}

const logout=async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("error destroying session",err)
                return res.redirect("/pageerror")
            }
            res.redirect("/")
        })
       
    } catch(error){
        console.log("logout error",error)
        res.redirect("/pageerror")
    }
   
}

const blockCustomer = async (req, res) => {
    try {
        const userId = req.query.id;
        await User.findByIdAndUpdate(userId, { isBlocked: true });

        // Return JSON response for AJAX request
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ 
                success: true, 
                message: 'User blocked successfully'
            });
        }

        req.session.message = {
            type: 'success',
            text: 'Customer blocked successfully!'
        };
        res.redirect('/admin/customers');
    } catch (error) {
        console.error('Error blocking customer:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error blocking user' 
            });
        }
        res.redirect('/admin/pageerror');
    }
};

const unblockCustomer = async (req, res) => {
    try {
        const userId = req.query.id;
        await User.findByIdAndUpdate(userId, { isBlocked: false });

        // Return JSON response for AJAX request
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ 
                success: true, 
                message: 'User unblocked successfully'
            });
        }

        req.session.message = {
            type: 'success',
            text: 'Customer unblocked successfully!'
        };
        res.redirect('/admin/customers');
    } catch (error) {
        console.error('Error unblocking customer:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error unblocking user' 
            });
        }
        res.redirect('/admin/pageerror');
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    blockCustomer,
    unblockCustomer
}