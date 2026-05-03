require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const multer = require('multer');
const webpush = require('web-push');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.warn("DIQQAT: JWT_SECRET topilmadi! Tizimga kirishda xatolik bo'lishi mumkin.");
} else {
    console.log("JWT_SECRET muvaffaqiyatli yuklandi.");
}

webpush.setVapidDetails('mailto:shohjahon@example.com', publicVapidKey, privateVapidKey);

const PORT = process.env.PORT || 3005;
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());

// Database Handler with Lock Queue
class DB {
    constructor(filePath) {
        this.filePath = filePath;
        this.lock = false;
        this.queue = [];
        this.data = null;
    }
    async init() {
        const content = await fsPromises.readFile(this.filePath, 'utf8');
        this.data = JSON.parse(content);
    }
    async read() {
        if (!this.data) await this.init();
        return JSON.parse(JSON.stringify(this.data));
    }
    async write(newData) {
        return new Promise((resolve, reject) => {
            this.queue.push({ newData, resolve, reject });
            this._processQueue();
        });
    }
    async _processQueue() {
        if (this.lock || this.queue.length === 0) return;
        this.lock = true;
        const { newData, resolve, reject } = this.queue.shift();
        try {
            this.data = JSON.parse(JSON.stringify(newData));
            await fsPromises.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
            resolve();
        } catch (err) {
            reject(err);
        } finally {
            this.lock = false;
            this._processQueue();
        }
    }
}
const dbHandler = new DB(DB_FILE);

// Initialize DB before handling requests
(async () => { await dbHandler.init(); })();

// Middleware: Authenticate Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ success: false, message: "Avtorizatsiya yo'q" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Token eskirgan yoki xato" });
        req.user = user;
        next();
    });
}

function requireAdminOrTeacher(req, res, next) {
    if (req.user.role === 'admin' || req.user.role === 'teacher') next();
    else res.status(403).json({ success: false, message: "Ruxsat etilmagan" });
}

function requireAdmin(req, res, next) {
    if (req.user.role === 'admin') next();
    else res.status(403).json({ success: false, message: "Faqat admin uchun" });
}

const broadcastUpdate = async () => {
    const db = await dbHandler.read();
    
    // Reytingni avtomatik yangilash (rasmlar bilan birga)
    const students = db.users.filter(u => u.role === 'student');
    db.appData.ranking = students
        .map(u => ({ 
            name: u.name, 
            score: u.score || 0, 
            avatar: u.avatar || '' 
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 15); // Top 15 talikni reytingga chiqaramiz

    io.emit('dataUpdate', { ...db.appData, users: db.users, schedules: db.schedules || [] });
};

// --- AUTH API Endpoints ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await dbHandler.read();
    const user = db.users.find(u => u.user === username);
    
    if (user && bcrypt.compareSync(password, user.pass)) {
        // Exclude password from the sent user object
        const { pass, ...userWithoutPass } = user;
        const token = jwt.sign({ username: user.user, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: userWithoutPass });
    } else {
        res.status(401).json({ success: false, message: "Login yoki parol noto'g'ri!" });
    }
});

// Remove password fields when sending data
app.get('/api/data', async (req, res) => {
    const db = await dbHandler.read();
    const safeUsers = db.users.map(u => {
        const { pass, ...safeUser } = u;
        return safeUser;
    });
    res.json({ ...db.appData, users: safeUsers, schedules: db.schedules || [] });
});

app.post('/api/update-password', authenticateToken, async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    if (req.user.username !== username && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Boshqa foydalanuvchining parolini o'zgartira olmaysiz!" });
    }

    const db = await dbHandler.read();
    const user = db.users.find(u => u.user === username);
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi!" });
    
    if (req.user.role !== 'admin') {
        if (!bcrypt.compareSync(oldPassword, user.pass)) {
            return res.status(401).json({ success: false, message: "Eski parol noto'g'ri!" });
        }
    }
    
    user.pass = bcrypt.hashSync(newPassword, 10);
    await dbHandler.write(db);
    res.json({ success: true, message: "Parol muvaffaqiyatli o'zgartirildi!" });
});

// --- PROTECTED API Endpoints ---
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (req.file) res.json({ success: true, url: `/uploads/${req.file.filename}` });
    else res.status(400).json({ success: false });
});

app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl yuklanmadi' });
    const username = req.body.username;
    if (req.user.username !== username && req.user.role !== 'admin') return res.status(403).json({ success: false });

    const avatarPath = '/uploads/' + req.file.filename;
    const db = await dbHandler.read();
    const user = db.users.find(u => u.user === username);
    if (user) {
        user.avatar = avatarPath;
        await dbHandler.write(db);
        await broadcastUpdate();
        res.json({ success: true, avatarUrl: avatarPath });
    } else {
        res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }
});

app.post('/api/visitor', async (req, res) => {
    const db = await dbHandler.read();
    db.appData.visitors = (db.appData.visitors || 0) + 1;
    await dbHandler.write(db);
    res.json({ success: true, visitors: db.appData.visitors });
});

// Admin / Teacher Endpoints
app.post('/api/schedules', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    if (!db.schedules) db.schedules = [];
    const newSchedule = req.body;
    const existingIndex = db.schedules.findIndex(s => s.class === newSchedule.class);
    if (existingIndex >= 0) db.schedules[existingIndex] = newSchedule;
    else db.schedules.push(newSchedule);
    
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true });
});

app.delete('/api/schedules/:class', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    if (db.schedules) {
        db.schedules = db.schedules.filter(s => s.class !== req.params.class);
        await dbHandler.write(db);
        await broadcastUpdate();
    }
    res.json({ success: true });
});

app.post('/api/news', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    const now = new Date();
    const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;
    db.appData.news.unshift({ ...req.body, views: 0, date: dateStr });
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true });
});

app.post('/api/news/:id/view', async (req, res) => {
    const db = await dbHandler.read();
    const newsItem = db.appData.news.find(n => n.id == req.params.id);
    if (newsItem) {
        newsItem.views = (newsItem.views || 0) + 1;
        await dbHandler.write(db);
        res.json({ success: true, views: newsItem.views });
    } else res.status(404).json({ success: false });
});

app.delete('/api/news/:id', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    db.appData.news = db.appData.news.filter(n => n.id != req.params.id);
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true });
});

app.post('/api/questions', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const { subjectId, question } = req.body;
    const db = await dbHandler.read();
    const subject = db.appData.subjects.find(s => s.id === subjectId);
    if (subject) {
        subject.questions.push(question);
        subject.lastUpdated = Date.now();
        await dbHandler.write(db);
        await broadcastUpdate();
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.delete('/api/questions/:subjectId/:index', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    const subject = db.appData.subjects.find(s => s.id === req.params.subjectId);
    if (subject && subject.questions[req.params.index]) {
        subject.questions.splice(req.params.index, 1);
        subject.lastUpdated = Date.now();
        await dbHandler.write(db);
        await broadcastUpdate();
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.post('/api/gifts', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    db.appData.gifts.unshift(req.body);
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true });
});

app.delete('/api/gifts/:id', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    db.appData.gifts = db.appData.gifts.filter(g => g.id != req.params.id);
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true });
});

app.post('/api/subscribe', async (req, res) => {
    const subscription = req.body;
    const db = await dbHandler.read();
    if (!db.subscriptions) db.subscriptions = [];
    const exists = db.subscriptions.find(s => s.endpoint === subscription.endpoint);
    if (!exists) {
        db.subscriptions.push(subscription);
        await dbHandler.write(db);
    }
    res.status(201).json({ success: true });
});

async function sendPushNotification(payload) {
    const db = await dbHandler.read();
    const subscriptions = db.subscriptions || [];
    const notificationPayload = JSON.stringify({
        title: 'Yangi Bildirishnoma',
        body: payload.text || 'Maktabdan yangi xabar keldi'
    });

    const pushPromises = subscriptions.map(sub => 
        webpush.sendNotification(sub, notificationPayload).catch(err => {
            if (err.statusCode === 404 || err.statusCode === 410) return null;
            console.error('Push error:', err);
        })
    );
    return Promise.all(pushPromises);
}

app.post('/api/notifications', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    db.appData.notifications.unshift(req.body);
    await dbHandler.write(db);
    io.emit('newNotification', req.body);
    sendPushNotification(req.body);
    res.json({ success: true });
});

app.delete('/api/notifications/:id', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const db = await dbHandler.read();
    const idToDelete = req.params.id;
    const initialCount = db.appData.notifications.length;
    db.appData.notifications = db.appData.notifications.filter(n => n.id.toString() !== idToDelete.toString());
    const finalCount = db.appData.notifications.length;
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true, deleted: initialCount - finalCount });
});

app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    const db = await dbHandler.read();
    const notif = db.appData.notifications.find(n => n.id == req.params.id);
    if (notif) {
        notif.read = true;
        await dbHandler.write(db);
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.post('/api/user/score', authenticateToken, async (req, res) => {
    const { username, scoreDelta, subjectId, reason } = req.body;
    if (req.user.username !== username && req.user.role !== 'admin') return res.status(403).json({ success: false });

    const db = await dbHandler.read();
    const user = db.users.find(u => u.user === username);
    if (user) {
        user.score = (user.score || 0) + scoreDelta;
        if (scoreDelta > 0 && subjectId) {
            const _now = new Date();
            const _months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
            const _dateStr = `${_now.getDate()} ${_months[_now.getMonth()]}, ${_now.getFullYear()}`;
            if (!user.grades) user.grades = [];
            const _subj = (db.appData.subjects.find(s => s.id === subjectId) || {}).name || subjectId;
            user.grades.unshift({
                points: scoreDelta, date: _dateStr, timestamp: Date.now(),
                source: 'test', label: `${_subj} - Test`
            });
        }

        if (subjectId) {
            if (!user.completedTests) user.completedTests = {};
            user.completedTests[subjectId] = Date.now();
        }

        if (scoreDelta > 0) user.testsTaken = (user.testsTaken || 0) + 1;

        let rankUser = db.appData.ranking.find(r => r.name === user.name);
        if (rankUser) rankUser.score = user.score;
        else db.appData.ranking.push({ name: user.name, score: user.score });

        db.appData.ranking.sort((a, b) => b.score - a.score);
        db.appData.ranking = db.appData.ranking.slice(0, 10);

        let notifText = `Sizga ${scoreDelta > 0 ? '+' : ''}${scoreDelta} ball qo'shildi. Umumiy balingiz: ${user.score}`;
        if (reason === 'gift' || scoreDelta < 0) {
            notifText = `Sovg'a xarid qilindi: -${Math.abs(scoreDelta)} ball. Umumiy balingiz: ${user.score}`;
        }

        db.appData.notifications.unshift({
            id: Date.now(),
            text: notifText,
            time: new Date().toLocaleString('uz-UZ').replace(',', ''),
            read: false,
            to: username
        });

        await dbHandler.write(db);
        await broadcastUpdate();
        res.json({ success: true, newScore: user.score, completedTests: user.completedTests });
    } else {
        res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    const db = await dbHandler.read();
    const newUser = req.body;
    if (db.users.find(u => u.user === newUser.user)) {
        return res.status(400).json({ success: false, message: "Ushbu login band!" });
    }
    
    newUser.pass = bcrypt.hashSync(newUser.pass, 10); // Hash new user password
    db.users.push({ ...newUser, score: 0, testsTaken: 0 });
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true });
});

app.delete('/api/users/:username', authenticateToken, requireAdmin, async (req, res) => {
    const db = await dbHandler.read();
    const { username } = req.params;
    if (username === 'admin') return res.status(403).json({ success: false, message: "Adminni o'chirib bo'lmaydi!" });
    db.users = db.users.filter(u => u.user !== username);
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true });
});

app.post('/api/teacher/add-points', authenticateToken, requireAdminOrTeacher, async (req, res) => {
    const { teacherUsername, studentUsername, points, subjectId } = req.body;
    if (req.user.username !== teacherUsername && req.user.role !== 'admin') return res.status(403).json({ success: false });

    const db = await dbHandler.read();
    const teacher = db.users.find(u => u.user === teacherUsername);
    const student = db.users.find(u => u.user === studentUsername);

    if (!teacher || teacher.role !== 'teacher') return res.status(403).json({ success: false, message: "Faqat o'qituvchilar ball qo'sha oladi!" });
    if (!student) return res.status(404).json({ success: false, message: "O'quvchi topilmadi!" });

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum < 1 || pointsNum > 5) return res.status(400).json({ success: false, message: "Maksimal 5 ball qo'shish mumkin!" });

    const _gNow = new Date();
    const _gMonths = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
    const _gDate = `${_gNow.getDate()} ${_gMonths[_gNow.getMonth()]}, ${_gNow.getFullYear()}`;

    // Dam olish kuni tekshiruvi (Faqat Yakshanba)
    const day = _gNow.getDay(); 
    if (day === 0 && req.user.role !== 'admin') {
        return res.status(400).json({ success: false, message: "Yakshanba kuni ball qo'shib bo'lmaydi!" });
    }

    // Fan tekshiruvi: O'qituvchi faqat o'ziga biriktirilgan fandan ball qo'shishi mumkin
    if (teacher.subject !== subjectId && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Siz faqat o'z faningizdan ball qo'sha olasiz!" });
    }

    // Kunlik cheklov: bitta fandan bir kunda faqat bir marta ball qo'shish mumkin
    if (student.grades && Array.isArray(student.grades)) {
        const alreadyGradedToday = student.grades.find(g => 
            g.source === 'teacher' && 
            g.subjectId === (subjectId || '') && 
            g.date === _gDate
        );
        if (alreadyGradedToday && req.user.role !== 'admin') {
            return res.status(400).json({ 
                success: false, 
                message: "Bugun ushbu o'quvchiga ushbu fandan ball qo'shib bo'lingan!" 
            });
        }
    }

    student.score = (student.score || 0) + pointsNum;

    if (!student.grades) student.grades = [];
    const _subjObj = subjectId ? db.appData.subjects.find(s => s.id === subjectId) : null;
    const _subjName = _subjObj ? _subjObj.name : '';
    student.grades.unshift({
        points: pointsNum, date: _gDate, timestamp: Date.now(),
        source: 'teacher', subjectId: subjectId || '', subjectName: _subjName,
        label: _subjName ? `${_subjName}` : `O'qituvchi ${teacher.name} tomonidan`
    });

    const notif = {
        id: Date.now(),
        text: `O'qituvchi ${teacher.name} sizga ${_subjName ? _subjName + ' fanidan ' : ''}${pointsNum} ball qo'shdi!`,
        time: new Date().toLocaleString('uz-UZ').replace(',', ''),
        read: false, role: 'student', to: student.user
    };
    db.appData.notifications.unshift(notif);

    await dbHandler.write(db);
    await broadcastUpdate();
    sendPushNotification(notif);
    res.json({ success: true, newScore: student.score });
});

app.post('/api/admin/reset-score/:username', authenticateToken, requireAdmin, async (req, res) => {
    const db = await dbHandler.read();
    const user = db.users.find(u => u.user === req.params.username);
    if (user) {
        user.score = 0;
        await dbHandler.write(db);
        await broadcastUpdate();
        res.json({ success: true });
    } else res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
});

app.post('/api/admin/clear-students', authenticateToken, requireAdmin, async (req, res) => {
    const db = await dbHandler.read();
    const before = db.users.length;
    db.users = db.users.filter(u => u.role === 'admin' || u.role === 'teacher');
    const removed = before - db.users.length;
    if (db.appData && db.appData.ranking) db.appData.ranking = [];
    await dbHandler.write(db);
    await broadcastUpdate();
    res.json({ success: true, removed });
});

// --- Static File Serving ---
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ success: false, message: "API route not found" });
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});