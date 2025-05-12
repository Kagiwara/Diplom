const mongoose = require('mongoose');

const sliderSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true } // Поле для хранения URL-ссылки на изображение
});

module.exports = mongoose.model('Slider', sliderSchema);