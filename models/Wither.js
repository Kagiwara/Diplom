const mongoose = require('mongoose');

const witherSchema = new mongoose.Schema({
    title: { type: String, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    buyUrl: { type: String, required: true }
});

module.exports = mongoose.model('Wither', witherSchema);