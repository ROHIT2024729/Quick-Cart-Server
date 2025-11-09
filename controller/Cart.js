import { Cart } from "../models/Cart.js";
import { Product } from "../models/Product.js";
import TryCatch from "../utils/TryCatch.js";

export const addToCart = TryCatch(async(req , res) => {
    const {product} = req.body;

    const cart = await Cart.findOne({
        product: product,
        user: req.user._id,
    }).populate("product");
    if(cart) {
        if(cart.product.stock === cart.quantity ) return res.status(400).json({
            message:"Out of Stock",
        })
        cart.quantity = cart.quantity + 1;

        await cart.save();

        return res.json({
            message:"Added to Cart",
        })

    }

    const cartProd = Product.findById(product);

    if(cartProd.stock === 0) return res.status(400).json({
            message:"Out of Stock",
        })

        await Cart.create({
            quantity:1,
            product: product,
            user: req.user._id,
        });

        res.json({
            message:"Added to Cart",
        })
});

export const removeFromCart = TryCatch(async(req , res) => {
    const cart = await Cart.findById(req.params.id);

    await Cart.deleteOne();

    res.json({
        message:"Remove from Cart!",
    });
});

export const updateCart = TryCatch(async(req,res) =>  {
    const {action} = req.query;

    if(action === "inc") {
        const {id} = req.body;
        const cart = await Cart.findById(id).populate("product");

        if(cart.quantity < cart.product.stock) {
            cart.quantity++;
            await cart.save();
        }
        else {
            return res.status(400).json({
                message:"Out of Stock",
            })
        }

        res.json({
            message: "Cart Updated",
        })

    }

    if(action  === "dec" ) {
        const {id} = req.body;
        const cart = await Cart.findById(id).populate("product");

        if(cart.quantity > 1) {
            cart.quantity--;
            await cart.save();
        }
        else {
                return res.status(400).send({
                    message:"You have Only one item in cart!",
                })
        }
        res.json({
            message:"Cart Updated!",
        })
    }
})

export const fetchCart = TryCatch(async(req , res) => {
    const cart = await Cart.find({user: req.user._id}).populate("product");

    const sumOfQuantities = cart.reduce(
        (total, item) => total + item.quantity,
        0
    );


    let subTotal = 0;

    cart.forEach((i)=>{
        const itemSubTotal = i.product.price * i.quantity;
        subTotal += itemSubTotal;
    });

    res.json({cart, subTotal, sumOfQuantities});
});