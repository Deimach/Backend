import mongoose from 'mongoose'
const setupDB =  () => {
    if (process.env.NODE_ENV === "development") {
        if (process.env.DB_ENV === "productive_db") {
            mongoose.connect("mongodb://admin:" + "passwordHere" + "@deimach.de:portHere/newBackend?authSource=admin&w=1'");
        } else {
            mongoose.connect("mongodb://localhost:27017/newbackend?authSource=admin&w=1'");
        }
    } else {
        let pw = process.env.DB_PASS;
        mongoose.connect("mongodb://admin:" + pw + "@127.0.0.1:27017/newBackend?authSource=admin&w=1'");
    }
    mongoose.set('debug', true);
}
export default setupDB()