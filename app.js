const express = require("express")
const app = express()
const env = require("dotenv").config()
const User = require("./models/userSchema")
const connectDB = require('./config/db')
connectDB()
const path = require("path")
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")
const session = require("express-session")
const passport = require("./config/passport")

// Middleware to disable caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.set("view engine","ejs")
app.set("views", [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin')
])
app.use(express.static(path.join(__dirname,"public")))



app.use("/",  userRouter) // Apply session check to user routes

app.post("/api/check-email", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res
                .status(400)
                .json({ exists: false, message: "Email is required" });
        }

        const user = await User.findOne({ email });

        if (user) {
            return res.json({ exists: true, message: "Email already exists" });
        }

        res.json({ exists: false, message: "Email is available" });
    } catch (error) {
        console.error("Error in /api/check-email:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.use(passport.initialize())
app.use(passport.session())

app.use((req, res, next) => {
    res.locals.user = req.user || null; // Pass `user` to locals (e.g., from session or database)
    next();
});

app.use('/admin', adminRouter) // Apply session check to admin routes

app.listen(process.env.PORT,()=>{
    console.log("server running")

})
module.exports = app
