const mongoose = require('mongoose');

const ForumSchema = new mongoose.Schema({
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true }, // Связь с игрой
    title: { type: String, required: true }, // Название форума
    description: { type: String, default: '' }, // Описание
    createdAt: { type: Date, default: Date.now } // Время создания
});

module.exports = mongoose.model('Forum', ForumSchema);