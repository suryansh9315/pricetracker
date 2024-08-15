"use server";

import { revalidatePath } from "next/cache";
import { connectDb } from "./database";
import { scrapeAmazonProduct } from "./scraper";
import { getAveragePrice, getHighestPrice, getLowestPrice } from "./utils";
import { ObjectId } from "mongodb";
import { generateEmailBody, sendEmail } from "./nodemailer";

export const scrapeAndStoreProduct = async (productUrl) => {
  if (!productUrl) return;
  try {
    const scrapedProduct = await scrapeAmazonProduct(productUrl);
    let new_product = scrapedProduct;
    const db = await connectDb();
    if (!db) {
      alert("Error connecting to Database");
      return;
    }
    const products = db.collection("products");
    const query = { url: scrapedProduct.url };
    const old_product = await products.findOne(query);
    if (old_product) {
      const updatedPriceHistory = [
        ...old_product.priceHistory,
        { price: scrapedProduct.currentPrice },
      ];
      new_product = {
        ...scrapedProduct,
        priceHistory: updatedPriceHistory,
        lowestPrice: getLowestPrice(updatedPriceHistory),
        highestPrice: getHighestPrice(updatedPriceHistory),
        averagePrice: getAveragePrice(updatedPriceHistory),
      };
    }
    const options = { upsert: true, returnNewDocument: true };
    const newProduct = await products.findOneAndReplace(query, new_product, options);
    revalidatePath(`/products/${newProduct?._id}`);
  } catch (error) {
    console.log(error)
    throw new Error(`Failed to create/update product: ${error.message}`);
  }
};

export const getProductById = async (productId) => {
  try {
    const db = await connectDb();
    if (!db) {
      alert("Error connecting to Database");
      return null;
    }
    const products = db.collection("products");
    const product = await products.findOne({ _id: new ObjectId(productId) });
    if (!product) return null;
    return product;
  } catch (error) {
    console.log(error);
  }
};

export const getAllProducts = async () => {
  try {
    const db = await connectDb();
    if (!db) {
      alert("Error connecting to Database");
      return [];
    }
    const products = db.collection("products");
    const productsPointer = products.find();
    let productsList = [];
    for await (const doc of productsPointer) {
      productsList.push(doc);
    }
    revalidatePath(`/`);
    return productsList;
  } catch (error) {
    console.log(error);
  }
};

export const getSimilarProducts = async (productId) => {
  try {
    const db = await connectDb();
    if (!db) {
      alert("Error connecting to Database");
      return null;
    }
    const products = db.collection("products");
    const currentProduct = await products.findOne({ _id: new ObjectId(productId) });
    if (!currentProduct) return null;
    const similarProductsPointer = products.find({
      _id: { $ne: new ObjectId(productId) },
    });
    let similarProductsList = [];
    for await (const doc of similarProductsPointer) {
        similarProductsList.push(doc);
    }
    return similarProductsList.slice(0, 3);
  } catch (error) {
    console.log(error);
  }
}

export const addUserEmailToProduct = async (productId, userEmail) => {
  try {
    const db = await connectDb();
    if (!db) {
      alert("Error connecting to Database");
      return ;
    }
    const products = db.collection("products");
    const query = { _id: new ObjectId(productId) }
    const currentProduct = await products.findOne(query);
    if(!currentProduct) return;
    const userExists = currentProduct.users.some((user) => user.email === userEmail);
    if(!userExists) {
      const update = {
        $set: {
          users: [userEmail, ...currentProduct.users],
        },
      };
      const options = { upsert: false };
      const result = await products.updateOne(query, update, options);
      const emailContent = await generateEmailBody(currentProduct, "WELCOME");
      await sendEmail(emailContent, [userEmail]);
    }
  } catch (error) {
    console.log(error);
  }
}
