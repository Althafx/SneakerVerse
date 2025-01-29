
const express = require("express")
const path = require("path")
const session = require("express-session")
const passport = require("./config/passport")
const User = require("./models/userSchema")
const errorHandler = require('./middlewares/errorHandler')
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")

require("dotenv").config()
const connectDB = require('./config/db')
connectDB()

const app = express()

// Session handling
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72*60*60*1000
    }
}));

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, "public")));

// View engine setup
app.set("view engine", "ejs");
app.set("views", [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin')
]);

// Cache and user locals middleware
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/admin', adminRouter);
app.use("/", userRouter);

// API route
app.post("/api/check-email", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ exists: false, message: "Email is required" });
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

// 404 handler
app.use((req, res) => {
    res.status(404).render("user/pageNotFound", {
        title: "404 Not Found",
        message: "The page you're looking for does not exist."
    });
});

// Error handler must be last
app.use(errorHandler);

// Start server
app.listen(process.env.PORT, () => {
    console.log("Your SneakerVerse Server is running at PORT:", process.env.PORT);
});

module.exports = app;

