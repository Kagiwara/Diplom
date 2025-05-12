const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const hbs = require('hbs');
const app = express();
const port = 3000;
const session = require('express-session');
const helpers = require('./helpers');
const sharp = require('sharp');
const multer = require('multer');
const path = require('path');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
hbs.registerPartials(path.join(__dirname, 'views/partials'));
//Подключение моделей
const User = require('./models/User');
const Game = require('./models/Game');
const ChatMessage = require('./models/ChatMessage');
const Settings = require('./models/Settings');
const Ad = require('./models/Ad');
const Slider = require('./models/Slider');
const Wither = require('./models/Wither');
const Forum = require('./models/Forum');
const Topic = require('./models/Topic');
// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/diplom')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

hbs.registerHelper('json', helpers.json);

// -----------------ДЛЯ ПРОВЕРОК --------------

const upload = multer({
    storage: multer.diskStorage({
        destination: './public/images/avatars',
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 2 * 1024 * 1024 } 
});

const uploadAds = multer({
    storage: multer.diskStorage({
        destination: './public/images/ads',
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname)); 
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 } // Ограничение размера файла (5 MB)
});

// Сессии и проверки
app.use(session({
    secret: 'your-secret-key', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

app.use((req, res, next) => {
    res.locals.session = req.session; // Добавляем session в res.locals
    next();
})

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/game');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) {
        return next();
    }
    return res.status(403).send('Доступ запрещен'); 
}

app.get('/', (req, res) => {
    res.render('index', { session: req.session }); // Передаем session в шаблон
});
// ------------------------------- БЛОК С ИГРАМИ -----------------------------------
app.get('/games', async (req, res) => {
    try {
        const games = await Game.find(); // Получаем все игры
        const sliders = await Slider.find(); // Получаем данные для слайдера
        const withers = await Wither.find();
        res.render('games', { 
            games, 
            session: req.session,
            sliders, 
            withers,
        });
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        res.status(500).send('Error fetching data');
    }
});

app.get('/chat-list', async (req, res) => {
    try {
        const forums = await Forum.find().populate('gameId', 'title description');
        res.render('chat-list', { forums, session: req.session });
    } catch (error) {
        console.error('Error fetching forum list:', error);
        res.status(500).send('Error fetching forum list');
    }
});

app.post('/admin/delete-forum/:id', isAdmin, async (req, res) => {
    try {
        const forumId = req.params.id;

        // Находим и удаляем форум
        const deletedForum = await Forum.findByIdAndDelete(forumId);
        if (!deletedForum) {
            return res.status(404).send('Форум не найден');
        }

        // Удаляем все темы, связанные с этим форумом
        await Topic.deleteMany({ forumId });

        // Удаляем все сообщения, связанные с этими темами
        await ChatMessage.deleteMany({ topicId: { $in: deletedForum.topics } });

        // Удаляем ссылку на форум из игры
        await Game.findByIdAndUpdate(deletedForum.gameId, { forumId: null });

        console.log(`Форум с ID ${forumId} успешно удален`);
        res.redirect('/chat-list'); // Перенаправляем обратно в список форумов
    } catch (error) {
        console.error('Ошибка при удалении форума:', error);
        res.status(500).send('Error deleting forum');
    }
});

app.get('/forum/:forumId', async (req, res) => {
    try {
        const forum = await Forum.findById(req.params.forumId).populate('gameId', 'title');
        const topics = await Topic.find({ forumId: req.params.forumId }).populate('createdBy', 'username');
        res.render('forum-topics', { forum, topics, session: req.session });
    } catch (error) {
        console.error('Error fetching forum topics:', error);
        res.status(500).send('Error fetching forum topics');
    }
});

app.get('/forum/:forumId/create-topic', isAdmin, async (req, res) => {
    try {
        const forum = await Forum.findById(req.params.forumId).populate('gameId', 'title');
        if (!forum) return res.status(404).send('Форум не найден');
        res.render('create-topic', { forum, session: req.session });
    } catch (error) {
        console.error('Ошибка при загрузке формы создания темы:', error);
        res.status(500).send('Error loading create topic form');
    }
});

app.post('/forum/:forumId/create-topic', isAdmin, async (req, res) => {
    try {
        const { title } = req.body;
        const newTopic = new Topic({
            forumId: req.params.forumId,
            title,
            createdBy: req.session.user._id
        });
        await newTopic.save();
        res.redirect(`/forum/${req.params.forumId}`);
    } catch (error) {
        console.error('Ошибка при создании темы:', error);
        res.status(500).send('Error creating topic');
    }
});

app.post('/admin/delete-topic/:id', isAdmin, async (req, res) => {
    try {
        const topicId = req.params.id;
        // Находим и удаляем тему
        const deletedTopic = await Topic.findByIdAndDelete(topicId);
        if (!deletedTopic) {
            return res.status(404).send('Тема не найдена');
        }
        // Удаляем все сообщения, связанные с этой темой
        await ChatMessage.deleteMany({ topicId });
        console.log(`Тема с ID ${topicId} успешно удалена`);
        res.redirect(`/forum/${deletedTopic.forumId}`); // Перенаправляем обратно в форум
    } catch (error) {
        console.error('Ошибка при удалении темы:', error);
        res.status(500).send('Error deleting topic');
    }
});

app.get('/forum/:forumId/topic/:topicId', async (req, res) => {
    try {
        const forum = await Forum.findById(req.params.forumId).populate('gameId', 'title');
        const topic = await Topic.findById(req.params.topicId).populate('createdBy', 'username');
        const messages = await ChatMessage.find({ topicId: req.params.topicId }).populate('userId', 'username').sort({ createdAt: 1 });
        res.render('forum-chat', { forum, topic, messages, session: req.session });
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).send('Error fetching chat messages');
    }
});

app.post('/forum/:forumId/topic/:topicId/post', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const newMessage = new ChatMessage({
            topicId: req.params.topicId,
            userId: req.session.user._id,
            content
        });
        await newMessage.save();
        res.redirect(`/forum/${req.params.forumId}/topic/${req.params.topicId}`);
    } catch (error) {
        console.error('Error posting message:', error);
        res.status(500).send('Error posting message');
    }
});
// ------------------------- ПРОФИЛЬ ------------------------------

app.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId).select('-password'); // Не передаем хеш пароля в шаблон

        if (!user) return res.status(404).send('Пользователь не найден');

        res.render('profile', { user, session: req.session });
    } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
        res.status(500).send('Error loading profile');
    }
});

app.post('/profile/update-info', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { username, email, description } = req.body;

        if (!username || !email) {
            return res.status(400).send('Заполните все обязательные поля');
        }

        // Обновление данных пользователя
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username, email, description },
            { new: true, runValidators: true }
        );

        if (!updatedUser) return res.status(404).send('Пользователь не найден');

        req.session.user = {
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            isAdmin: updatedUser.isAdmin
        };

        console.log('Информация профиля успешно обновлена:', updatedUser);
        res.redirect('/profile'); 
    } catch (error) {
        console.error('Ошибка при обновлении информации профиля:', error);
        res.status(500).send('Error updating profile info');
    }
});

app.get('/profile/change-password', isAuthenticated, (req, res) => {
    res.render('change-password', { session: req.session });
});

app.post('/profile/change-password', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Валидация данных
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).send('Заполните все поля');
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).send('Новый пароль и подтверждение не совпадают');
        }

        // Найдем пользователя
        const user = await User.findById(userId);
        if (!user) return res.status(404).send('Пользователь не найден');

        // Проверяем текущий пароль
        const isMatch = await user.comparePassword(currentPassword); 
        if (!isMatch) return res.status(400).send('Текущий пароль неверный');

        // Устанавливаем новый пароль - используем метод save() схемы Mongoose
        user.password = newPassword; // Просто устанавливаем новый пароль
        await user.save(); // Middleware автоматически захеширует пароль

        console.log('Пароль успешно изменен');
        res.send('Пароль успешно изменен');
    } catch (error) {
        console.error('Ошибка при изменении пароля:', error);
        res.status(500).send('Error changing password');
    }
});

app.post('/profile/upload-avatar', isAuthenticated, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.session.user._id;

        // Обрезаем изображение до квадрата 200x200 пикселей
        const outputPath = path.join(__dirname, 'public/images/avatars', `${Date.now()}-avatar.jpg`);
        await sharp(req.file.path)
            .resize(200, 200)
            .toFile(outputPath);

        // Обновляем URL аватара пользователя
        const avatarUrl = `/images/avatars/${path.basename(outputPath)}`;
        await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true });

        console.log('Аватар успешно загружен и обрезан');
        res.redirect('/profile');
    } catch (error) {
        console.error('Ошибка при загрузке аватара:', error);
        res.status(500).send('Error uploading avatar');
    }
});

// ------------------------- РЕГИСТРАЦИЯ -------------------------
app.get('/registration', (req, res) => {
    res.render('registration', {});
});

app.post('/registration', async (req, res) => {
    const { username, email, password, confirmpassword } = req.body;

    // Проверка совпадения паролей
    if (password !== confirmpassword) {
        return res.status(400).send('Пароли не совпадают');
    }

    // Проверка на пустые поля
    if (!username.trim() || !email.trim() || !password.trim() || !confirmpassword.trim()) {
        return res.status(400).send('Заполните все поля');
    }

    try {
        // Проверка, существует ли пользователь с таким email
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('Пользователь с такой почтой уже зарегистрирован');
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).send('Пользователь с таким именем уже существует');
        }

        // Создание нового пользователя
        const newUser = new User({
            username,
            email,
            password // Передаем обычный пароль, он будет захеширован автоматически
        });

        await newUser.save();
        res.redirect('/login'); // Перенаправление на страницу входа после регистрации
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).send('Error during registration');
    }
});

app.get('/login', (req, res) => {
    res.render('login', {});
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Валидация входных данных
        if (!username || !password) {
            return res.status(400).send('Заполните все поля');
        }

        // Поиск пользователя по username
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send('Неправильное имя пользователя или пароль');
        }

        // Сохранение информации о пользователе в сессию
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin // Сохраняем роль администратора
        };

        // console.log('User logged in:', req.session.user); // Лог для проверки

        // Перенаправление на страницу после входа
        res.redirect('/games');
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).send('Ошибка сервера при входе');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return console.error('Ошибка при выходе:', err);
        }
        res.redirect('/'); // Перенаправление на главную страницу
    });
});
// !!!!!!!!!!!! АДМИНКА !!!!!!!!!!!!!
app.post('/admin/delete-message/:id', isAdmin, async (req, res) => {
    const messageId = req.params.id;

    try {
        const deletedMessage = await ChatMessage.findByIdAndDelete(messageId);

        if (!deletedMessage) return res.status(404).send('Message not found');

        console.log(`Message with ID ${messageId} deleted successfully`);
        res.redirect('/chat-list'); // Redirect back to the chat list
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).send('Error deleting message');
    }
});

app.get('/admin/ads',isAdmin, (req, res) => {
    
    const adsData = req.session.ads || {
        enabled: false, // По умолчанию реклама отключена
        image: '',      // Нет изображения
        text: '',       // Нет текста
        link: ''        // Нет ссылки
    };

    res.render('ads', { session: req.session, ads: adsData });
});

app.post('/admin/save-ad', uploadAds.single('image'), (req, res) => {
    const { enabled, text, link } = req.body;

    // Получаем имя загруженного файла
    let imageName = null;
    if (req.file) {
        imageName = req.file.filename; // Имя файла, сохранённого на сервере
    }

    // Сохраняем данные рекламы в сессии или базе данных
    req.session.ads = {
        enabled: enabled === 'true', // Преобразуем строку "true" в boolean
        image: imageName || req.session.ads?.image, // Если файл не загружен, используем старое изображение
        text: text || '', // Убеждаемся, что текст не undefined
        link: link || '' // Убеждаемся, что ссылка не undefined
    };

    // Перенаправляем администратора обратно на страницу управления рекламой
    res.redirect('/admin/ads');
});

app.get('/admin/slider', isAdmin, async (req, res) => {
    try {
        const sliders = await Slider.find();
        res.render('slider', { sliders, session: req.session });
    } catch (error) {
        console.error('Ошибка при получении слайдеров:', error);
        res.status(500).send('Error fetching sliders');
    }
});

app.post('/admin/slider/add', isAdmin, async (req, res) => {
    try {
        const { title, description, image } = req.body;

        // Проверяем, что все поля присутствуют
        if (!title || !description || !image) {
            return res.status(400).send('Заполните все поля');
        }

        if (!title.trim() || !description.trim() || !image.trim()) {
            return res.status(400).send('Заполните все поля корректно');
        }

        await Slider.create({ title, description, image });
        res.redirect('/admin/slider');
    } catch (error) {
        console.error('Ошибка при добавлении слайда:', error);
        res.status(500).send('Error adding slider');
    }
});

app.get('/admin/slider/delete/:id', isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const deletedSlider = await Slider.findByIdAndDelete(id);

        if (!deletedSlider) {
            return res.status(404).send('Slider not found');
        }

        res.redirect('/admin/slider');
    } catch (error) {
        console.error('Ошибка при удалении слайда:', error);
        res.status(500).send('Error deleting slider');
    }
});

app.get('/admin/wither', isAdmin, async (req, res) => {
    try {
        const withers = await Wither.find();
        res.render('wither', { withers, session: req.session });
    } catch (error) {
        console.error('Ошибка при получении блока Wither:', error);
        res.status(500).send('Error fetching wither cards');
    }
});

app.post('/admin/wither/add', isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { title,image, description, buyUrl } = req.body;

        if (!title.trim() || !description.trim() || !buyUrl.trim() || !image.trim()) {
            return res.status(400).send('Заполните все поля');
        }

        await Wither.create({ title, description, image, buyUrl });
        res.redirect('/admin/wither');
    } catch (error) {
        console.error('Ошибка при добавлении карточки Wither:', error);
        res.status(500).send('Error adding wither card');
    }
});

app.get('/admin/wither/delete/:id', isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const deletedWither = await Wither.findByIdAndDelete(id);

        if (!deletedWither) {
            return res.status(404).send('Wither card not found');
        }

        res.redirect('/admin/wither');
    } catch (error) {
        console.error('Ошибка при удалении карточки Wither:', error);
        res.status(500).send('Error deleting wither card');
    }
});

// --------------  администрирование игр ------------
app.get('/admin/admingame', isAdmin, (req, res) => {
    res.render('admingame', { session: req.session }); // Передаем session в шаблон
});

app.get('/admin/adminred', isAdmin, async (req, res) => {
    try {
        const games = await Game.find(); // Получаем все игры из базы данных
        res.render('admin-edit-list', { games, session: req.session }); // Передаем игры и сессию в шаблон
    } catch (error) {
        console.error('Ошибка при получении списка игр для редактирования:', error);
        res.status(500).send('Error fetching games for editing');
    }
});

app.post('/admin/create-game', isAdmin, async (req, res) => {
    const { title, description, img, playUrl } = req.body;
    try {
        // Валидация данных
        if (!title.trim() || !description.trim() || !img.trim() || !playUrl.trim()) {
            return res.status(400).send('Заполните все поля');
        }

        // Создание новой игры
        const newGame = new Game({
            title,
            description,
            img,
            playUrl
        });
        await newGame.save();

        // Создание форума для игры
        const newForum = new Forum({
            gameId: newGame._id,
            title: `Форум игры ${title}`,
            description: `Обсуждение игры ${title}`
        });
        await newForum.save();

        // Связываем форум с игрой
        newGame.forumId = newForum._id;
        await newGame.save();

        console.log('Игра и форум успешно созданы:', newGame, newForum);
        res.redirect('/admin/admingame'); // Перенаправление на страницу управления играми
    } catch (error) {
        console.error('Ошибка при создании игры или форума:', error);
        res.status(500).send('Error during game or forum creation');
    }
});

app.get('/adminred/:id', isAdmin, async (req, res) => {
    const gameId = req.params.id;

    try {
        const game = await Game.findById(gameId);

        if (!game) {
            return res.status(404).send('Игра не найдена');
        }

        res.render('adminred', { game, session: req.session }); // Передаем игру в шаблон
    } catch (error) {
        console.error('Ошибка при получении игры:', error);
        res.status(500).send('Error fetching game');
    }
});

app.post('/adminred/update/:id', isAdmin, async (req, res) => {
    const gameId = req.params.id;
    const { title, description, img, playUrl } = req.body;

    try {
        // Валидация данных
        if (!title.trim() || !description.trim() || !img.trim() || !playUrl.trim()) {
            return res.status(400).send('Заполните все поля');
        }

        // Обновление игры
        const updatedGame = await Game.findByIdAndUpdate(
            gameId,
            { title, description, img, playUrl },
            { new: true } // Возвращаем обновленную игру
        );

        if (!updatedGame) {
            return res.status(404).send('Игра не найдена');
        }

        console.log('Игра успешно обновлена:', updatedGame);
        res.redirect('/admin/admingame'); // Перенаправление на страницу управления играми
    } catch (error) {
        console.error('Ошибка при обновлении игры:', error);
        res.status(500).send('Error updating game');
    }
});

app.post('/admin/delete-game/:id', isAdmin, async (req, res) => {
    const gameId = req.params.id;
    try {
        await Game.findByIdAndDelete(gameId);
        console.log(`Игра с ID ${gameId} успешно удалена`);
        res.status(200).send('Game deleted successfully');
    } catch (error) {
        console.error('Ошибка при удалении игры:', error);
        res.status(500).send('Error deleting game');
    }
});

app.get('/admin/users', isAdmin, async (req, res) => {
    try {
        // Получаем всех пользователей из базы данных, исключая пароль
        const users = await User.find().select('-password');
        res.render('admin-users', { users, session: req.session }); // Передаем список пользователей в шаблон
    } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        res.status(500).send('Error fetching users');
    }
});

app.post('/admin/users/delete/:id', isAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        // Находим и удаляем пользователя
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).send('Пользователь не найден');
        }
        res.redirect('/admin/users'); // Возвращаемся к списку пользователей
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        res.status(500).send('Error deleting user');
    }
});

app.post('/admin/users/toggle-admin/:id', isAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        // Находим пользователя
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('Пользователь не найден');
        }

        // Переключаем роль администратора
        user.isAdmin = !user.isAdmin;
        await user.save();

        res.redirect('/admin/users'); // Возвращаемся к списку пользователей
    } catch (error) {
        console.error('Ошибка при изменении роли пользователя:', error);
        res.status(500).send('Error toggling admin role');
    }
});

// Запуск сервера и проверки
app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
