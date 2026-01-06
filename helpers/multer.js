const multer = require('multer');
const { storage } = require('../config/cloudinary');

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed"), false);
    }
};

const uploads = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
