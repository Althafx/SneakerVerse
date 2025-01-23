const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
  try {
    // Handle search and page input
    let search = req.query.search ? req.query.search.trim() : "";
    let page = parseInt(req.query.page) || 1;
    if (page < 1) page = 1;

    const limit = 3;

    // Fetch filtered users with pagination
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    // Count total documents matching the search criteria
    const count = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    }).countDocuments();

    // Calculate total pages
    const totalPage = Math.ceil(count / limit);

    // Render the view with the data
    res.render("customers", {
      data: userData,
      search,
      totalPage,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching customer data:", error);
    res.status(500).send("Internal Server Error");
  }
};

const customerBlocked = async(req,res)=>{
    try{
        let id=req.query.id;
        await User.updateOne({_id:id},{isBlocked:true});
        res.json({ success: true, message: 'User blocked successfully' });
    }catch(error){
        console.error('Error blocking user:', error);
        res.status(500).json({ success: false, message: 'Failed to block user' });
    }
}

const customerunBlocked = async(req,res)=>{
    try{
        let id=req.query.id;
        await User.updateOne({_id:id},{isBlocked:false});
        res.json({ success: true, message: 'User unblocked successfully' });
    }catch(error){
        console.error('Error unblocking user:', error);
        res.status(500).json({ success: false, message: 'Failed to unblock user' });
    }
}



module.exports = {
  customerInfo,
  customerBlocked,
  customerunBlocked
};
