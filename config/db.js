const mongoose = require("mongoose")
const env = require("dotenv").config()

const connectDB = async()=>{
    try{
        mongoose.connect((process.env.MONGODB_URI))
        console.log("mongodb is connected")

    }catch(error){

        console.log("mongodb connection error  ",error.message)
        process.exit(1)

    }
}
module.exports = connectDB