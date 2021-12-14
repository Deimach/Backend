import mongoose from 'mongoose'
let Schema  = mongoose.Schema;
import User from '../user/User.js'


let UserPaymentSchema = new mongoose.Schema({
    created: { type: Date, default: Date.now },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    customerId: {
        type: String,
        required: true,
    },
    paymentId: {
        type: String,
        required: false,
    },
    mandateId: {
        type: String,
        required: false,
    },
    subscriptionId: {
        type: String,
        required: false,
    },
    paymentStatus: {
        type: Boolean,
        required: false,
    }
});

export default mongoose.model('UserPayment', UserPaymentSchema);
