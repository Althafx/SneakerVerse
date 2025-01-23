const mongoose = require("mongoose")
const {Schema} = mongoose

const productSchema = new Schema({
    productName:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    brand:{
        type:String,
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salesPrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantities:{
        small:{
            type:Number,
            default:0,
            min:0
        },
        medium:{
            type:Number,
            default:0,
            min:0
        },
        large:{
            type:Number,
            default:0,
            min:0
        }
    },
    totalQuantity:{
        type:Number,
        default:0,
        min:0
    },
    color:{
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discontinued"],
        required:true,
        default:"Available"
    },

},{timestamps:true})

// // Pre-save middleware to calculate total quantity
// productSchema.pre('save', function(next) {
//     const quantities = this.quantities || {};
//     this.totalQuantity = (quantities.small || 0) + (quantities.medium || 0) + (quantities.large || 0);
//     next();
// });

// // Pre-update middleware to update the updatedAt timestamp
// productSchema.pre('findOneAndUpdate', function(next) {
//     this._update.updatedAt = new Date();
    
//     // Calculate total quantity if quantities are being updated
//     if (this._update.quantities) {
//         const quantities = this._update.quantities;
//         this._update.totalQuantity = (quantities.small || 0) + (quantities.medium || 0) + (quantities.large || 0);
//     }
    
//     next();
// });

const Product = mongoose.model("Product",productSchema)
module.exports = Product