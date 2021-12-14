import mongoose from 'mongoose'
let Schema  = mongoose.Schema;
import Entry from '../user/Entry.js'
import Layout from '../user/Layout.js'
import Praxis from '../user/Praxis.js'
import UserPayment from '../user/UserPayment.js'



let UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        lowercase: true,
        trim: true,
        type: String,
        required: true,
        unique: true,
        uniqueCaseInsensitive: true
    },
    yearOfBirth: {
        type: Number,
        trim: true,
    },
    residence: {
        type: String,
        trim: true,
    },
    job: {
        type: String,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    scopes: {
        type: [String],
        required: true,
    },
    userPayment: {
        type: Schema.Types.ObjectId,
        ref: 'UserPayment'
    },
    diagnose: {
      type: String,
      required: false,
    },
    note: {
        type: String,
        required: false,
    },
    flags: {
        type: [String],
        required: true,
    },
    changeToken: {
        type: String,
        required: false,
    },
    layouts: {
        type: [String],
        required: false,
    },
    // registerCounter: {
    //     type: Number,
    //     default: 0,
    // },
    changeTokenExpiry: { type: Date },
    created: { type: Date, default: Date.now },
    entries: [{ type: Schema.Types.ObjectId, ref: Entry }],
    consultants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    praxis: { type: Schema.Types.ObjectId, ref: 'Praxis' },
    layout: { type: Schema.Types.ObjectId, ref: 'Layout' }


});
//mongoose.model('User', UserSchema);

export default mongoose.model('User', UserSchema);
