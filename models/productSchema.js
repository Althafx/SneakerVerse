const mongoose = require("mongoose")
const { Schema } = mongoose

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salesPrice: {
        type: Number,
        required: true,
        default: function() {
            return this.regularPrice;
        }
    },
    mainPrice: {
        type: Number,
        default: function() {
            return this.regularPrice;
        }
    },
    productOffer: {  // Discount percentage (e.g., 10 means 10% off)
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    offer: {  // New field to store the discounted price
        discountedPrice: { 
            type: Number, 
            default: null 
        },
        discountPercentage: { 
            type: Number, 
            default: 0,
            min: 0,
            max: 100
        }
    },
    quantities: {
        small: { type: Number, default: 0, min: 0 },
        medium: { type: Number, default: 0, min: 0 },
        large: { type: Number, default: 0, min: 0 }
    },
    totalQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    color: {
        type: String,
        required: true
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "out of stock", "Discontinued"],
        required: true,
        default: "Available"
    },

}, { timestamps: true })

// Middleware to calculate discounted price before saving
productSchema.pre('save', function (next) {
    // If product has a product offer
    if (this.productOffer > 0) {
        this.offer = {
            discountedPrice: Math.floor(this.salesPrice - (this.salesPrice * this.productOffer / 100)),
            discountPercentage: this.productOffer
        };
    } 
    // If product's category has an offer and it's better than the product offer
    else if (this.category && this.category.categoryOffer > 0) {
        this.offer = {
            discountedPrice: Math.floor(this.salesPrice - (this.salesPrice * this.category.categoryOffer / 100)),
            discountPercentage: this.category.categoryOffer
        };
    } 
    // No offers or invalid offers
    else {
        this.offer = {
            discountedPrice: null,
            discountPercentage: 0
        };
        this.productOffer = 0; // Reset product offer if it's 0 or negative
    }

    // Ensure salesPrice is always set
    if (!this.salesPrice || isNaN(this.salesPrice)) {
        this.salesPrice = this.regularPrice;
    }

    next();
});

// Virtual for checking if product has any active offer
productSchema.virtual('hasOffer').get(function() {
    return (this.offer && this.offer.discountPercentage > 0) || 
           (this.category && this.category.categoryOffer > 0);
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
