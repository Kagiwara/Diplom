const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatarUrl: { type: String, default: '/images/default-avatar.jpg' }, // URL аватара
    description: { type: String, default: '' }, // Описание пользователя
    isAdmin: { type: Boolean, default: false }
});

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next(); // Пропускаем, если пароль не изменён

    try {
        const salt = await bcrypt.genSalt(10); // Генерируем соль
        this.password = await bcrypt.hash(this.password, salt); // Хешируем пароль
        next();
    } catch (error) {
        next(error);
    }
});

// Метод для сравнения паролей
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password); // Сравниваем пароль с хешем
};

module.exports = mongoose.model('User', UserSchema);