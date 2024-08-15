import { NextResponse } from "next/server";
import {
  getLowestPrice,
  getHighestPrice,
  getAveragePrice,
  getEmailNotifType,
} from "@/lib/utils";
import { connectDb } from "@/lib/database";
import { scrapeAmazonProduct } from "@/lib/scraper";
import { generateEmailBody, sendEmail } from "@/lib/nodemailer";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const db = await connectDb();
    const products = db.collection("products");
    const productsPointer = products.find();
    let productsList = [];
    for await (const doc of productsPointer) {
      productsList.push(doc);
    }
    if (!productsList) throw new Error("No product fetched");
    const updatedProducts = await Promise.all(
      productsList.map(async (currentProduct) => {
        const scrapedProduct = await scrapeAmazonProduct(currentProduct.url);
        if (!scrapedProduct) return;
        const updatedPriceHistory = [
          ...currentProduct.priceHistory,
          {
            price: scrapedProduct.currentPrice,
          },
        ];
        const new_product = {
          ...scrapedProduct,
          priceHistory: updatedPriceHistory,
          lowestPrice: getLowestPrice(updatedPriceHistory),
          highestPrice: getHighestPrice(updatedPriceHistory),
          averagePrice: getAveragePrice(updatedPriceHistory),
        };
        const query = { url: currentProduct.url };
        const options = { upsert: false, returnNewDocument: true };
        const newProduct = await products.findOneAndReplace(
          query,
          new_product,
          options
        );
        const emailNotifType = getEmailNotifType(
          scrapedProduct,
          currentProduct
        );
        if (emailNotifType && newProduct.users.length > 0) {
          const productInfo = {
            title: newProduct.title,
            url: newProduct.url,
          };
          const emailContent = await generateEmailBody(
            productInfo,
            emailNotifType
          );
          const userEmails = newProduct.users.map((user) => user.email);
          await sendEmail(emailContent, userEmails);
        }
        return newProduct;
      })
    );
    return NextResponse.json({
      message: "Ok",
      data: updatedProducts,
    });
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to get all products: ${error.message}`);
  }
}
