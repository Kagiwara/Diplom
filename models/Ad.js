const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    image: { type: String, required: true },
    link: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ad', adSchema);