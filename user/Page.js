import mongoose from 'mongoose'
let Schema  = mongoose.Schema;
import User from '../user/User'
import UIElement from '../user/UIElement'

let PageSchema = new mongoose.Schema({
    sideBarVisible: {
        type: Boolean,
        required: true
    },
    uiElements: [UIElement],
    created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Page', PageSchema);