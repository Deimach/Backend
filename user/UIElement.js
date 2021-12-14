import mongoose from 'mongoose'

let UIElement = new mongoose.Schema({
    identifier: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    properties: {
        type: [String],
        required: false,
    },
    values: {
        type: [String],
        required: true,
    },
    description: {
        type: String,
        required: false,
    },
}, { strict: false });

export default UIElement;