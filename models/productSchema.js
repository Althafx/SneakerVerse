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
    mainPrice: {
        type: Number,
        default: function() {
            return this.salesPrice || this.regularPrice;
        }
    },
    salesPrice: {
        type: Number,
        required: true
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
productSchema.pre('save', async function (next) {
    try {
        // On first save, set mainPrice to salesPrice
        if (this.isNew) {
            this.mainPrice = this.salesPrice;
        }
        // If salesPrice is changing and no offers are active, update mainPrice
        else if (this.isModified('salesPrice') && 
                (!this.productOffer || this.productOffer <= 0) && 
                (!this.category?.categoryOffer || this.category.categoryOffer <= 0)) {
            this.mainPrice = this.salesPrice;
        }

        // Ensure category is populated for offer calculation
        if (this.category && !this.category.categoryOffer && typeof this.category !== 'string') {
            await this.populate('category');
        }

        let productOfferPercentage = this.productOffer || 0;
        let categoryOfferPercentage = 0;

        // Get category offer percentage
        if (this.category) {
            if (typeof this.category === 'object') {
                categoryOfferPercentage = this.category.categoryOffer || 0;
            } else {
                // If category is not populated, populate it
                const populatedProduct = await this.constructor.findById(this._id).populate('category');
                if (populatedProduct && populatedProduct.category) {
                    categoryOfferPercentage = populatedProduct.category.categoryOffer || 0;
                }
            }
        }

        // If there are any offers, calculate the new salesPrice
        if (productOfferPercentage > 0 || categoryOfferPercentage > 0) {
            const finalPercentage = Math.max(productOfferPercentage, categoryOfferPercentage);
            const discountAmount = Math.floor(this.mainPrice * (finalPercentage / 100));
            this.salesPrice = this.mainPrice - discountAmount;
            
            this.offer = {
                discountedPrice: this.salesPrice,
                discountPercentage: finalPercentage
            };
        } else {
            // No offers - restore original salesPrice from mainPrice
            this.salesPrice = this.mainPrice;
            this.offer = {
                discountedPrice: null,
                discountPercentage: 0
            };
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Virtual for checking if product has any active offer
productSchema.virtual('hasOffer').get(function() {
    return (this.offer && this.offer.discountPercentage > 0) || 
           (this.category && this.category.categoryOffer > 0);
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
