const multer = require('multer');
const path = require('path');
const fs = require('fs');


//--------------------------------------------------------------------------------------------------------------------------------------------------------


// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, "../public/uploads/product-images");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


// Storage configuration for uploaded files
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------


// File filter for images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed"), false);
    }
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------


// Multer configuration
const uploads = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------


module.exports = {
    uploads,
    fileFilter,
    storage,
    uploadSingle: uploads.single('image'),        // For single image upload (brands)
    uploadMultiple: uploads.fields([              // For multiple images (products)
        { name: 'image1', maxCount: 1 },
        { name: 'image2', maxCount: 1 },
        { name: 'image3', maxCount: 1 },
        { name: 'image4', maxCount: 1 }
    ])
};
