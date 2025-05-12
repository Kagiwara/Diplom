const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    img: { type: String, required: true },
    playUrl: { type: String, required: true },
    forumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum' } // Связь с форумом
});

module.exports = mongoose.model('Game', GameSchema);