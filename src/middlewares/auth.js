import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Seller from '../models/seller.model.js';

const jwt_secret = process.env.JWT_SECRET;


export const userAuth = async (req, res, next) => {
    try {
        const { accessToken } = req.cookies;

        console.log(req.cookies)

        if (!accessToken) {
            return res.status(401).json({ status: false, message: "Unauthorized token" });
        }

        const decoded = jwt.verify(accessToken, jwt_secret);
        const { _id } = decoded;

        const user = await User.findById(_id);

        if (!user || user.role === null) {
            return res.status(401).json({ status: false, message: "Unauthorized user" });
        }

        req.user = user;

        next();
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


export const sellerAuth = async ( req, res, next ) => {
    try {
        const { accessToken } = req.cookies;

        if(!accessToken){
            return res.status(401).json({ status: false, message: "access Unauthorized"});
        }

        const decoded = jwt.verify(accessToken, jwt_secret);
        const user = await User.findById(decoded._id);

        if(!user || user.role !== 'seller') {
            return res.status(401).json({ status: false, message: "User Unauthorized"});
        }

        const seller = await Seller.findOne({ userInfo: user._id });

        if(!seller){
            return res.status(401).json({ status: false, message: "seller Unauthorized"});
        }

        req.user = user;
        req.seller = seller;

        next();
    } catch (error) {
        res.status(400).json({ status: false, message: "Internal Server Error."})
    }
}