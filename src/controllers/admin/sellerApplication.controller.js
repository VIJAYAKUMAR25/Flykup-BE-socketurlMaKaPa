import Seller from "../../models/seller.model.js";


// pending seller application count 
export const pendingApplicationCount = async(req,res) =>{
    try {
      const pendingReqCount = await Seller.find({approvalStatus:'pending'}).countDocuments();
      return res.status(200).json({status: true, message: 'pending application count fetched successfully!', data: pendingReqCount || 0});
    } catch (error) {
      console.error("Error in pendingApplicationCount:", error.message);
      return res.status(500).json({status: false, message:'Internal server error.'})
    }
  }