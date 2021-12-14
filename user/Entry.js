import mongoose from 'mongoose'
let Schema  = mongoose.Schema;
import User from '../user/User.js'
import Layout from '../user/Layout.js'
let EntrySchema = new mongoose.Schema({
    values: [{
        identifier: {
            type: String
        },
        value: [String]
    }],
    layout: { type: Schema.Types.ObjectId, ref: 'Layout', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    created: { type: Date, default: Date.now },
});
//mongoose.model('Entry', EntrySchema);

export default mongoose.model('Entry', EntrySchema);