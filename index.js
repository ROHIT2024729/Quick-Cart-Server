import express from "express";
import dotenv from 'dotenv';
import connectDb from "./utils/db.js";
import userRoutes from "./routers/user.js";
import cloudinary from 'cloudinary';
import productRoutes from "./routers/product.js";
import cartRoutes from "./routers/Cart.js";
import addressRoutes from "./routers/Address.js";
import orderRoutes from "./routers/order.js";
import cors from 'cors';
import axios from 'axios';

const app = express();


const url = `https://quick-cart-server-osdm.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log("website reloded");
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

dotenv.config();

cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,

})
app.use(express.json());

app.use(cors());
//Using Routes
app.use("/api", userRoutes);
app.use("/api", productRoutes);
app.use("/api",cartRoutes);
app.use("/api", addressRoutes);
app.use("/api",orderRoutes);

const port = process.env.PORT;
app.listen(port, async()=>{
    await connectDb();
    console.log(`Server is listening at ${port}`);
});