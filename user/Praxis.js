import mongoose from 'mongoose'
let Schema  = mongoose.Schema;
import User from '../user/User.js'

let PraxisSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    city: {
        type: String,
        trim: true,
    },
    plz: {
        type:String,
        trim:true
    },
    street: {
        type: String,
        trim: true,
    },
    email: {
        type: String,
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
});

export default mongoose.model('Praxis', PraxisSchema);
