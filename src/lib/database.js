import { MongoClient } from "mongodb";

const url = process.env.MONGO_URI;
const dbName = "PriceTracker";

let cachedDb = null;

export const connectDb = async () => {
  if(!url) return console.log('MONGODB_URI is not defined');
  if (cachedDb) {
    return cachedDb;
  }
  try {
    const client = new MongoClient(url);
    const db = client.db(dbName);
    cachedDb = db;
    return db;
  } catch (error) {
    console.log(error);
    return cachedDb;
  }
};
