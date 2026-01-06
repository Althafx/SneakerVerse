const express = require("express")
const path = require("path")
const session = require("express-session")
const flash = require('connect-flash')
const passport = require("./config/passport")
const User = require("./models/userSchema")
const errorHandler = require('./middlewares/errorHandler')
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")

require("dotenv").config()
const connectDB = require('./config/db')

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error('Error:', err.name, err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
});

// Connect to MongoDB
connectDB().then(() => {

}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// 
const app = express()

app.use("/Public", express.static("Public"));

// Session handling
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}));

// Flash messages
app.use(flash());

// Make flash messages available to all views
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    next();
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "Public")));
app.use("/uploads", express.static(path.join(__dirname, "Public/uploads")));

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
    res.locals.getImageUrl = (image, folder = 'product-images') => {
        if (!image) return '/img/no-image.png'; // Fallback
        if (image.startsWith('http') || image.startsWith('https')) {
            return image;
        }
        // Check if it's a Cloudinary ID (assuming it contains the folder name)
        if (image.includes('sneakerverse-products')) {
            return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${image}`;
        }
        // Default to local/relative path
        return `/uploads/${folder}/${image}`;
    };
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

// Error handler 
app.use(errorHandler);

// Socket.IO setup
const http = require('http');
const socketIO = require('socket.io');
const server = http.createServer(app);
const io = socketIO(server);

// Make io accessible to routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error('Error:', err.name, err.message);
    console.error('Stack:', err.stack);
    server.close(() => {
        process.exit(1);
    });
});

module.exports = app;

//arjunanil2114@gmail.com,faheemmbasheer@gmail.com