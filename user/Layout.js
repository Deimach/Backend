import mongoose from 'mongoose'
let Schema  = mongoose.Schema;
import User from '../user/User.js'
import UIElement from './UIElement.js'
import { v4 as uuidv4 } from 'uuid';

let LayoutSchema = new mongoose.Schema({
    consultant: {
        type: Schema.Types.ObjectId,
        required: false,
        ref: 'User'
    },
    version: {
        type: Number,
        required: true,
    },
    created: { type: Date, default: Date.now },
    uiElements: [UIElement],
    layoutID: {
        type: 'String',
        required: true,
        default: () => uuidv4(),
    },
    name: {
        type: 'String',
        required: true,
    },
});
//mongoose.model('Layout', LayoutSchema);

export default mongoose.model('Layout', LayoutSchema);