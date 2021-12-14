import mongoose from 'mongoose'
let Schema  = mongoose.Schema;
import User from '../user/User.js'


let DocumentationAliasSchema = new mongoose.Schema({
    sessionNumber: {
        type: Number,
        required: true,
        default: 0,
    },
    created: { type: Date, default: Date.now },
    alias: {
        type: 'String',
        required: true,
    },
    consultant: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    diagnosis: {
        type: 'String',
        required: false,
    },
    notes: {
        type: 'String',
        required: false,
    },
});

export default mongoose.model('DocumentationAlias', DocumentationAliasSchema);