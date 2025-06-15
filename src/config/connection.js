import mongoose from 'mongoose';

const db_username = process.env.MONGO_USERNAME;
const db_password = process.env.MONGO_PASSWORD;
const db_cluster = process.env.MONGO_CLUSTER;

// Development DataBase
const db_name = process.env.MONGO_DEV_DB;

// Production DataBase
// const db_name = process.env.MONGO_PROD_DB;


const cloudURL = `mongodb+srv://${db_username}:${db_password}@${db_cluster}/${db_name}?retryWrites=true&w=majority&appName=Flykup`;

const connectDB = async () => {
    await mongoose.connect(cloudURL);
}

export default connectDB;