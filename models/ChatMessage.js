const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true }, // Связь с темой
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Связь с пользователем
    content: { type: String, required: true }, // Текст сообщения
    isDeleted: { type: Boolean, default: false }, // Удалено или нет
    createdAt: { type: Date, default: Date.now }, // Время создания
    updatedAt: { type: Date } // Время последнего обновления
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);