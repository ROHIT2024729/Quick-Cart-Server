import { Product } from "../models/Product.js";
import bufferGenerator from "../utils/bufferGenerator.js";
import TryCatch from "../utils/TryCatch.js";
import cloudinary from 'cloudinary';
export const createProduct = TryCatch(async(req , res ) => {
    if(req.user.role !== "admin") return res.status(403).json({
        message: "You are not a Admin!"
    });

    const {title, about, category, price, stock} = req.body;
    const files = req.files;

    if(!files || files.length === 0) return res.status(400).json({
        message:"No files to uploads",
    });

    const imageUploadPromises = files.map(async(file)=>{
        const fileBuffer = bufferGenerator(file);

        const result = await cloudinary.v2.uploader.upload(fileBuffer.content);

        return {
            id: result.public_id,
            url: result.secure_url,
        };
    });

    const uploadedImage = await Promise.all(imageUploadPromises);
    const product = await Product.create({
        title,
        about,
        category,
        price,
        stock,
        images: uploadedImage,

    });
    res.status(201).json({
        message:"Product Created!",
        product
    })
})


export const getAllProducts = TryCatch(async (req, res) => {
  const { search, category, page = 1, sortByPrice } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limit = 8;
  const skip = (pageNum - 1) * limit;

  // build filter
  const filter = {};
  if (search) {
    filter.title = {
      $regex: search,
      $options: "i",
    };
  }
  if (category) {
    filter.category = category;
  }

  // default sort: newest first
  let sortOption = { createdAt: -1 }; // fixed typo (was cratedAt)

  if (sortByPrice) {
    if (sortByPrice === "lowToHigh") {
      sortOption = { price: 1 };
    } else if (sortByPrice === "highToLow") {
      sortOption = { price: -1 };
    }
  }

  // Use query chaining **before** awaiting
  const productsQuery = Product.find(filter).sort(sortOption).skip(skip).limit(limit);
  const products = await productsQuery.exec();

  // get distinct categories (no filter needed, but you may pass one if you want categories within results)
  const categories = await Product.distinct("category");

  // latest 4 products globally
  const newProduct = await Product.find().sort({ createdAt: -1 }).limit(4).exec();

  // count documents matching the same filter (important for pagination)
  const countProduct = await Product.countDocuments(filter);

  const totalPages = Math.ceil(countProduct / limit);

  res.json({
    products,
    categories,
    totalPages,
    newProduct,
    page: pageNum,
    totalProducts: countProduct,
  });
});

export const getSingleProduct = TryCatch(async(req , res)=>{
    const product = await Product.findById(req.params.id);


    const relatedProduct = await Product.find({
        category: product.category,
        _id: {$ne: product._id},
    }).limit(4);

    res.json({ product, relatedProduct });



})


export const updateProduct = TryCatch(async(req , res)=>{
      if(req.user.role !== "admin") return res.status(403).json({
        message:"You are not the admin!",
      });

      const {title, about, category, price, stock} = req.body;


      const updateFields = {}
      if(title) updateFields.title = title;
      if(about) updateFields.about = about;
      if(category) updateFields.category = category;
      if(price) updateFields.price = price;
      if(stock) updateFields.stock = stock;


      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true, runValidators: true}
      );


      if(!updatedProduct) return res.status(404).json({
        message: "Product not Found!",
      });

      res.json({
        message: "Product Updated!",
      })
})


export const updateProductImage = TryCatch(async (req, res) => {
  // 1) basic auth check
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not the Admin" });
  }

  const { id } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ message: "No files to upload!" });
  }

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ message: "Product not Found!" });
  }

  // 2) inspect existing images (helpful for debugging)
  const oldImages = Array.isArray(product.images) ? product.images : [];
  console.log(`Found ${oldImages.length} old images for product ${id}`, oldImages);

  // 3) build list of public_ids to delete (support different key names)
  const publicIdsToDelete = oldImages
    .map(img => {
      if (!img) return null;
      if (typeof img === "string") return img; // stored as string public_id
      // common object shapes: { id }, { public_id }, { publicId }
      return img.id || img.public_id || img.publicId || null;
    })
    .filter(Boolean);

  console.log("publicIdsToDelete:", publicIdsToDelete);

  // 4) delete old images in parallel, with basic retry and collect results
  const deleteResults = [];
  if (publicIdsToDelete.length > 0) {
    const destroyOne = async (publicId) => {
      try {
        const res = await cloudinary.v2.uploader.destroy(publicId, { invalidate: true });
        // response for successful destroy typically has result: 'ok' or 'not found'
        return { publicId, ok: true, result: res };
      } catch (err) {
        console.error("Destroy error for", publicId, err);
        // try once more (simple retry)
        try {
          const res2 = await cloudinary.v2.uploader.destroy(publicId, { invalidate: true });
          return { publicId, ok: true, result: res2, retried: true };
        } catch (err2) {
          console.error("Retry destroy failed for", publicId, err2);
          return { publicId, ok: false, error: err2.toString() };
        }
      }
    };

    const destroyPromises = publicIdsToDelete.map(pid => destroyOne(pid));
    const settled = await Promise.all(destroyPromises);
    deleteResults.push(...settled);
  }

  console.log("deleteResults:", deleteResults);

  // 5) upload new images (same as before)
  const imageUploadPromises = files.map(async (file) => {
    const fileBuffer = bufferGenerator(file);
    // If bufferGenerator returns { content, mimetype } or similar, adapt accordingly.
    // For robustness, handle both Buffer and data URI.
    const uploadRes = await cloudinary.v2.uploader.upload(fileBuffer.content);
    return { id: uploadRes.public_id, url: uploadRes.secure_url };
  });

  const uploadedImages = await Promise.all(imageUploadPromises);

  // 6) update product and save
  product.images = uploadedImages;
  await product.save();

  // 7) return detailed result for debugging
  return res.status(200).json({
    message: "Images updated!",
    product,
    deleted: deleteResults,
    uploaded: uploadedImages,
  });
});
