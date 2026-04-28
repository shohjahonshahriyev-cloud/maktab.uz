const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Push Notifications Config
const publicVapidKey = 'BJiXkGpzXU8RIM4Ca9AU2XqIiu2WFYGPVGUyY_Aw3yYLMCzJGPF0ZDCnO47fA1S8Uu5yBx4EUgvkVz3g889OUIg';
const privateVapidKey = 'fPKjPZ2G739dwxL7y8scTB0hQuyha5gCEdLlceJ1Qdw';

webpush.setVapidDetails(
    'mailto:shohjahon@example.com',
    publicVapidKey,
    privateVapidKey
);

const PORT = process.env.PORT || 3005;
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());

// Move API routes BEFORE static serving
const readDB = () => {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
};

const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const broadcastUpdate = () => {
    const db = readDB();
    io.emit('dataUpdate', { ...db.appData, users: db.users, schedules: db.schedules || [] });
};

// --- API Endpoints ---
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        res.json({ success: true, url: `/uploads/${req.file.filename}` });
    } else {
        res.status(400).json({ success: false });
    }
});

app.get('/api/data', (req, res) => {
    const db = readDB();
    res.json({ ...db.appData, users: db.users, schedules: db.schedules || [] });
});

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl yuklanmadi' });
    
    const username = req.body.username;
    const avatarPath = '/uploads/' + req.file.filename;
    
    const db = readDB();
    const user = db.users.find(u => u.user === username);
    if (user) {
        user.avatar = avatarPath;
        writeDB(db);
        broadcastUpdate();
        res.json({ success: true, avatarUrl: avatarPath });
    } else {
        res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.user === username && u.pass === password);
    if (user) res.json({ success: true, user });
    else res.status(401).json({ success: false, message: "Login yoki parol noto'g'ri!" });
});

app.post('/api/visitor', (req, res) => {
    const db = readDB();
    db.appData.visitors = (db.appData.visitors || 0) + 1;
    writeDB(db);
    // Removed broadcastUpdate to prevent interrupting other users' active sessions
    res.json({ success: true, visitors: db.appData.visitors });
});

// SCHEDULES
app.post('/api/schedules', (req, res) => {
    const db = readDB();
    if (!db.schedules) db.schedules = [];
    
    const newSchedule = req.body;
    const existingIndex = db.schedules.findIndex(s => s.class === newSchedule.class);
    
    if (existingIndex >= 0) {
        db.schedules[existingIndex] = newSchedule;
    } else {
        db.schedules.push(newSchedule);
    }
    
    writeDB(db);
    broadcastUpdate();
    res.json({ success: true });
});

app.delete('/api/schedules/:class', (req, res) => {
    const db = readDB();
    if (db.schedules) {
        db.schedules = db.schedules.filter(s => s.class !== req.params.class);
        writeDB(db);
        broadcastUpdate();
    }
    res.json({ success: true });
});

// NEWS
app.post('/api/news', (req, res) => {
    const db = readDB();
    const now = new Date();
    const dateStr = `${now.getDate()} ${['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'][now.getMonth()]}, ${now.getFullYear()}`;
    const newNews = { ...req.body, views: 0, date: dateStr }; // Initialize views and date
    db.appData.news.unshift(newNews);
    // Removed 3-item limit to allow more news
    writeDB(db);
    broadcastUpdate();
    res.json({ success: true });
});

app.post('/api/news/:id/view', (req, res) => {
    const db = readDB();
    const newsItem = db.appData.news.find(n => n.id == req.params.id);
    if (newsItem) {
        newsItem.views = (newsItem.views || 0) + 1;
        writeDB(db);
        // Removed broadcastUpdate to prevent interrupting other users' active sessions
        res.json({ success: true, views: newsItem.views });
    } else res.status(404).json({ success: false });
});

app.delete('/api/news/:id', (req, res) => {
    const db = readDB();
    db.appData.news = db.appData.news.filter(n => n.id != req.params.id);
    writeDB(db);
    broadcastUpdate();
    res.json({ success: true });
});

// QUESTIONS
app.post('/api/questions', (req, res) => {
    const { subjectId, question } = req.body;
    const db = readDB();
    const subject = db.appData.subjects.find(s => s.id === subjectId);
    if (subject) {
        // question should have { q, options, correct, targetClass }
        subject.questions.push(question);
        subject.lastUpdated = Date.now(); // Track version
        writeDB(db);
        broadcastUpdate();
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.delete('/api/questions/:subjectId/:index', (req, res) => {
    const db = readDB();
    const subject = db.appData.subjects.find(s => s.id === req.params.subjectId);
    if (subject && subject.questions[req.params.index]) {
        subject.questions.splice(req.params.index, 1);
        subject.lastUpdated = Date.now(); // Track version
        writeDB(db);
        broadcastUpdate();
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

// GIFTS
app.post('/api/gifts', (req, res) => {
    const db = readDB();
    db.appData.gifts.unshift(req.body);
    writeDB(db);
    broadcastUpdate();
    res.json({ success: true });
});

app.delete('/api/gifts/:id', (req, res) => {
    const db = readDB();
    db.appData.gifts = db.appData.gifts.filter(g => g.id != req.params.id);
    writeDB(db);
    broadcastUpdate();
    res.json({ success: true });
});


app.post('/api/subscribe', (req, res) => {
    const subscription = req.body;
    const db = readDB();
    if (!db.subscriptions) db.subscriptions = [];
    
    // Check if subscription already exists
    const exists = db.subscriptions.find(s => s.endpoint === subscription.endpoint);
    if (!exists) {
        db.subscriptions.push(subscription);
        writeDB(db);
    }
    
    res.status(201).json({ success: true });
});

async function sendPushNotification(payload) {
    const db = readDB();
    const subscriptions = db.subscriptions || [];
    
    const notificationPayload = JSON.stringify({
        title: 'Yangi Bildirishnoma',
        body: payload.text || 'Maktabdan yangi xabar keldi'
    });

    const pushPromises = subscriptions.map(sub => 
        webpush.sendNotification(sub, notificationPayload).catch(err => {
            if (err.statusCode === 404 || err.statusCode === 410) {
                console.log('Subscription has expired or is no longer valid');
                // Could remove expired subscriptions here
                return null;
            }
            console.error('Push error:', err);
        })
    );

    return Promise.all(pushPromises);
}

app.post('/api/notifications', (req, res) => {
    const db = readDB();
    db.appData.notifications.unshift(req.body);
    writeDB(db);
    io.emit('newNotification', req.body);
    
    // Send background push notification
    sendPushNotification(req.body);
    
    res.json({ success: true });
});

app.delete('/api/notifications/:id', (req, res) => {
    const db = readDB();
    const idToDelete = req.params.id;
    console.log(`Attempting to delete notification with ID: ${idToDelete}`);
    
    const initialCount = db.appData.notifications.length;
    db.appData.notifications = db.appData.notifications.filter(n => n.id.toString() !== idToDelete.toString());
    
    const finalCount = db.appData.notifications.length;
    console.log(`Deleted ${initialCount - finalCount} notifications.`);
    
    writeDB(db);
    broadcastUpdate();
    res.json({ success: true, deleted: initialCount - finalCount });
});

app.post('/api/notifications/:id/read', (req, res) => {
    const db = readDB();
    const notif = db.appData.notifications.find(n => n.id == req.params.id);
    if (notif) {
        notif.read = true;
        writeDB(db);
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.post('/api/user/score', (req, res) => {
    const { username, scoreDelta, subjectId } = req.body;
    const db = readDB();

    // Find the user and update their stats
    const user = db.users.find(u => u.user === username);
    if (user) {
        user.score = (user.score || 0) + scoreDelta;

        // Save grade entry for student diary
        if (scoreDelta > 0 && subjectId) {
            const _now = new Date();
            const _months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
            const _dateStr = `${_now.getDate()} ${_months[_now.getMonth()]}, ${_now.getFullYear()}`;
            if (!user.grades) user.grades = [];
            const _subj = (db.appData.subjects.find(s => s.id === subjectId) || {}).name || subjectId;
            user.grades.unshift({
                points: scoreDelta,
                date: _dateStr,
                timestamp: Date.now(),
                source: 'test',
                label: `${_subj} - Test`
            });
        }

        console.log(`Updating score for ${username}. Subject: ${subjectId}, Delta: ${scoreDelta}`);

        // Track completed test (always, regardless of score)
        if (subjectId) {
            if (!user.completedTests) user.completedTests = {};
            user.completedTests[subjectId] = Date.now();
            console.log(`Marked ${subjectId} as completed for ${username}:`, user.completedTests[subjectId]);
        } else {
            console.warn(`No subjectId provided for ${username} score update`);
        }

        if (scoreDelta > 0) {
            user.testsTaken = (user.testsTaken || 0) + 1;
        }

        // Sync with APP_DATA.ranking
        let rankUser = db.appData.ranking.find(r => r.name === user.name);
        if (rankUser) {
            rankUser.score = user.score;
        } else {
            db.appData.ranking.push({ name: user.name, score: user.score });
        }

        // Re-sort and slice ranking
        db.appData.ranking.sort((a, b) => b.score - a.score);
        db.appData.ranking = db.appData.ranking.slice(0, 10);

        // Add private notification for the student
        db.appData.notifications.unshift({
            id: Date.now(),
            text: `Sizga ${scoreDelta > 0 ? '+' : ''}${scoreDelta} ball qo'shildi. Umumiy balingiz: ${user.score}`,
            time: new Date().toLocaleString('uz-UZ').replace(',', ''),
            read: false,
            to: username // Target specific student
        });

        writeDB(db);
        broadcastUpdate();
        res.json({ success: true, newScore: user.score, completedTests: user.completedTests });
    } else {
        res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    }
});

app.post('/api/users', (req, res) => {
    const db = readDB();
    const newUser = req.body;

    // Check if user already exists
    if (db.users.find(u => u.user === newUser.user)) {
        return res.status(400).json({ success: false, message: "Ushbu login band!" });
    }

    db.users.push({
        ...newUser,
        score: 0,
        testsTaken: 0
    });

    writeDB(db);
    broadcastUpdate();
    res.json({ success: true });
});

app.delete('/api/users/:username', (req, res) => {
    const db = readDB();
    const { username } = req.params;

    if (username === 'admin') {
        return res.status(403).json({ success: false, message: "Adminni o'chirib bo'lmaydi!" });
    }

    db.users = db.users.filter(u => u.user !== username);
    writeDB(db);
    broadcastUpdate();
    res.json({ success: true });
});

app.post('/api/teacher/add-points', (req, res) => {
    const { teacherUsername, studentUsername, points, subjectId } = req.body;
    const db = readDB();

    const teacher = db.users.find(u => u.user === teacherUsername);
    const student = db.users.find(u => u.user === studentUsername);

    if (!teacher || teacher.role !== 'teacher') {
        return res.status(403).json({ success: false, message: "Faqat o'qituvchilar ball qo'sha oladi!" });
    }

    if (!student) {
        return res.status(404).json({ success: false, message: "O'quvchi topilmadi!" });
    }

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum < 1 || pointsNum > 5) {
        return res.status(400).json({ success: false, message: "Maksimal 5 ball qo'shish mumkin!" });
    }

    student.score = (student.score || 0) + pointsNum;

    // Save grade entry for student diary
    const _gNow = new Date();
    const _gMonths = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
    const _gDate = `${_gNow.getDate()} ${_gMonths[_gNow.getMonth()]}, ${_gNow.getFullYear()}`;
    if (!student.grades) student.grades = [];
    const _subjObj = subjectId ? db.appData.subjects.find(s => s.id === subjectId) : null;
    const _subjName = _subjObj ? _subjObj.name : '';
    student.grades.unshift({
        points: pointsNum,
        date: _gDate,
        timestamp: Date.now(),
        source: 'teacher',
        subjectId: subjectId || '',
        subjectName: _subjName,
        label: _subjName ? `${_subjName}` : `O'qituvchi ${teacher.name} tomonidan`
    });

    // Create a notification for the student
    const notif = {
        id: Date.now(),
        text: `O'qituvchi ${teacher.name} sizga ${_subjName ? _subjName + ' fanidan ' : ''}${pointsNum} ball qo'shdi!`,
        time: new Date().toLocaleString('uz-UZ').replace(',', ''),
        read: false,
        role: 'student',
        to: student.user
    };
    db.appData.notifications.unshift(notif);

    writeDB(db);
    broadcastUpdate();
    
    // Send background push notification
    sendPushNotification(notif);

    res.json({ success: true, newScore: student.score });
});

app.post('/api/admin/reset-score/:username', (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.user === req.params.username);
    if (user) {
        user.score = 0;
        writeDB(db);
        broadcastUpdate();
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    }
});

// --- Static File Serving (Always at the end) ---
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

// Fallback for SPA (optional but good)
app.use((req, res, next) => {
    // If it's an API request that wasn't caught, return 404 JSON
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: "API route not found" });
    }
    // Otherwise serve index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});