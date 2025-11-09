import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
export const isAuth = async(req , res , next) => {
    try{
        const {token} = req.headers;


        if(!token)
            return res.status(403).json({
            message: "Please Login!",
        })

        const decodedData = jwt.verify(token, process.env.JWT_SEC);

        req.user = await User.findById(decodedData._id);
        next();
    }
    catch(err) {
        res.status(403).json({
            message: "Please Login!",
        })
    }
}