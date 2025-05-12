const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema({
    forumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true }, // Связь с форумом
    title: { type: String, required: true }, // Название темы
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Создатель темы
    createdAt: { type: Date, default: Date.now } // Время создания
});

module.exports = mongoose.model('Topic', TopicSchema);