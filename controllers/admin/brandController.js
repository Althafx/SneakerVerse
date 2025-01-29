const Brand = require("../../models/brandSchema")
// const Product = require("../..models/productSchema")
const multer = require("../../helpers/multer")


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const getBrandPage = async(req,res)=>{
    try{
        const page=parseInt(req.query.page) || 1
        const limit = 4
        const skip =(page-1)*limit
        const brandData = await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit)
        const totalBrands= await Brand.countDocuments()
        const totalPages = Math.ceil(totalBrands/limit)
        const reverseBrand = brandData.reverse()
        res.render("brands",{
            data:reverseBrand,
            currentPage:page,
            totalPages:totalPages,
            totalBrands:totalBrands,
            path: '/admin/brands'
        })
    }
    catch(error){
        res.render("user/pageNotFound", { title: 'Error', message: "Error loading brands page" });
    }
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const addBrand = async(req,res)=>{
    try{
        const brand = req.body.name
        const findBrand = await Brand.findOne({ brand: { $regex: new RegExp(`^${brand}$`, 'i') } })
        if(findBrand){
            return res.redirect("/admin/brands")
        }
        if(!findBrand){
            const image= req.file.filename;
            const newBrand = new Brand({
                brandName:brand,
                brandImage:image
            })
            await newBrand.save()
            res.redirect("/admin/brands")
        }
    }catch(error){
        res.render("user/pageNotFound", { title: 'Error', message: "Error adding brand" });
    }

}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const blockBrand=async(req,res)=>{
    try{
        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/brands")
    }catch(error){
        res.render("user/pageNotFound", { title: 'Error', message: "Error blocking brand" });
    }

}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const unBlockBrand = async(req,res)=>{
    try{
        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/brands")
    }catch(error){
        res.render("user/pageNotFound", { title: 'Error', message: "Error unblocking brand" });
    }


}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


const deleteBrand = async(req,res)=>{
    try{
        const{id}=req.query;
        if(!id){
            return res.render("user/pageNotFound", { title: 'Error', message: "Brand ID not provided" });
        }
        await Brand.deleteOne({_id:id});
        res.redirect("/admin/brands");
    }catch(error){
        console.error("error deleting brand",error);
        res.render("user/pageNotFound", { title: 'Error', message: "Error deleting brand" });
    }


}


//--------------------------------------------------------------------------------------------------------------------------------------------------------


module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand

}