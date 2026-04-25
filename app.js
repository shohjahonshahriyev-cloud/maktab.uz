// API Configuration
const API_BASE = '/api';
const socket = io();

let notifCount = 0;

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', '');
}

function showCustomModal(title, text, isConfirm = true) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const textEl = document.getElementById('modal-text');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        if (!modal || !titleEl || !textEl || !confirmBtn || !cancelBtn) {
            if (isConfirm) resolve(confirm(text));
            else { alert(text); resolve(true); }
            return;
        }

        titleEl.innerText = title;
        textEl.innerText = text;

        if (isConfirm) {
            cancelBtn.classList.remove('hidden');
            confirmBtn.innerText = "Ha, albatta";
        } else {
            cancelBtn.classList.add('hidden');
            confirmBtn.innerText = "OK";
        }

        modal.classList.remove('hidden');

        const handleConfirm = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

function showCustomAlert(text) {
    return showCustomModal("Xabar", text, false);
}

function showCustomConfirm(title, text) {
    return showCustomModal(title, text, true);
}

// App Data (Will be synced with Backend)
let APP_DATA = {
    user: {
        name: "Abbos Aliev",
        class: "11-B sinf",
        score: 0,
        testsTaken: 0,
        rank: 0
    },
    news: [],
    subjects: [
        { id: 'ona-tili', name: "Ona tili", icon: "fa-book", questions: [] },
        { id: 'adabiyot', name: "Adabiyot", icon: "fa-book-open", questions: [] },
        { id: 'math', name: "Matematika", icon: "fa-calculator", questions: [] },
        { id: 'physics', name: "Fizika", icon: "fa-atom", questions: [] },
        { id: 'kimyo', name: "Kimyo", icon: "fa-flask", questions: [] },
        { id: 'biologiya', name: "Biologiya", icon: "fa-dna", questions: [] },
        { id: 'history', name: "Tarix", icon: "fa-landmark", questions: [] },
        { id: 'english', name: "Ingliz tili", icon: "fa-language", questions: [] },
        { id: 'rus-tili', name: "Rus tili", icon: "fa-language", questions: [] },
        { id: 'geografiya', name: "Geografiya", icon: "fa-earth-americas", questions: [] },
        { id: 'huquq', name: "Huquq", icon: "fa-gavel", questions: [] },
        { id: 'informatika', name: "Informatika", icon: "fa-laptop-code", questions: [] },
        { id: 'texnologiya', name: "Texnologiya", icon: "fa-gears", questions: [] },
        { id: 'tarbiya', name: "Tarbiya", icon: "fa-heart", questions: [] },
        { id: 'jismoniy-tarbiya', name: "Jismoniy tarbiya", icon: "fa-person-running", questions: [] },
        { id: 'musiqa', name: "Musiqa", icon: "fa-music", questions: [] }
    ],
    gifts: [],
    ranking: [],
    director: {
        name: "Akbar Tohirov",
        role: "Maktab maslahatchisi",
        phone: "+998 91 004 96 00",
        msg: "Assalomu alaykum, aziz o'quvchilar! Bilim olishdan aslo to'xtamang. Bizning platforma sizga yordam beradi.",
        image: "school_director_1776859699524.png"
    },
    notifications: []
};

// State
let currentSection = 'home';
let isAdmin = false;
let isTeacher = false;
let users = [
    { user: 'admin', pass: '2024', role: 'admin', name: "Tizim Adminstratori", class: "Boshqaruv" },
    { user: 'student', pass: '123', role: 'student', name: "Abbos Aliev", class: "11-B sinf" }
];
let testState = {
    active: false,
    subject: null,
    currentQuestion: 0,
    score: 0,
    timer: 30,
    timerInterval: null
};
let currentNewsId = null;

// Navigation
function navigateTo(section) {
    // Prevent navigation during active test
    if (testState.active) {
        showCustomConfirm("Diqqat", "Test jarayoni to'xtatilsinmi?").then(quit => {
            if (quit) {
                if (testState.active) clearInterval(testState.timerInterval);
                testState.active = false;
                proceedNav(section);
            }
        });
        return;
    }

    // Security check for admin section
    if (section === 'admin' && !isAdmin) {
        showCustomAlert("Sizda ushbu bo'limga kirish huquqi yo'q!");
        return;
    }

    proceedNav(section);
}

function proceedNav(section) {
    currentSection = section;

    // Hide badge if opening notifications
    if (section === 'notifications') {
        notifCount = 0;
        updateNotifBadge();
        APP_DATA.notifications.forEach(n => n.read = true);
    }

    renderSection();
    updateNavUI();
    window.scrollTo(0, 0);
}

function updateNavUI() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.id === `nav-${currentSection}`) {
            item.classList.add('active');
        }
    });
}

function renderBottomNav() {
    const nav = document.getElementById('bottom-navbar');
    if (!nav) return;

    let html = '';
    if (isAdmin) {
        html = `
            <div class="nav-item ${currentSection === 'admin' ? 'active' : ''}" onclick="navigateTo('admin')" id="nav-admin">
                <i class="fa-solid fa-gauge-high"></i>
                <span>Asosiy</span>
            </div>
            <div class="nav-item ${currentSection === 'messages' ? 'active' : ''}" onclick="navigateTo('messages')" id="nav-messages">
                <i class="fa-solid fa-paper-plane"></i>
                <span>Xabarlar</span>
            </div>
            <div class="nav-item ${currentSection === 'profile' ? 'active' : ''}" onclick="navigateTo('profile')" id="nav-profile">
                <i class="fa-solid fa-users"></i>
                <span>Azolar</span>
            </div>
        `;
    } else if (isTeacher) {
        html = `
            <div class="nav-item ${currentSection === 'home' ? 'active' : ''}" onclick="navigateTo('home')" id="nav-home">
                <i class="fa-solid fa-house"></i>
                <span>Asosiy</span>
            </div>
            <div class="nav-item ${currentSection === 'teacher' ? 'active' : ''}" onclick="navigateTo('teacher')" id="nav-teacher">
                <i class="fa-solid fa-chalkboard-user"></i>
                <span>Sinflar</span>
            </div>
            <div class="nav-item ${currentSection === 'notifications' ? 'active' : ''}" onclick="navigateTo('notifications')" id="nav-notifications">
                <i class="fa-solid fa-bell"></i>
                <span id="notif-badge" class="notif-badge hidden">0</span>
                <span>Xabarlar</span>
            </div>
        `;
    } else {
        html = `
            <div class="nav-item ${currentSection === 'home' ? 'active' : ''}" onclick="navigateTo('home')" id="nav-home">
                <i class="fa-solid fa-house"></i>
                <span>Asosiy</span>
            </div>
            <div class="nav-item ${currentSection === 'test' ? 'active' : ''}" onclick="navigateTo('test')" id="nav-test">
                <i class="fa-solid fa-list-check"></i>
                <span>Test</span>
            </div>
            <div class="nav-item ${currentSection === 'gift' ? 'active' : ''}" onclick="navigateTo('gift')" id="nav-gift">
                <i class="fa-solid fa-gift"></i>
                <span>Sovg'a</span>
            </div>
            <div class="nav-item ${currentSection === 'ranking' ? 'active' : ''}" onclick="navigateTo('ranking')" id="nav-ranking">
                <i class="fa-solid fa-trophy"></i>
                <span>Reyting</span>
            </div>
            <div class="nav-item ${currentSection === 'profile' ? 'active' : ''}" onclick="navigateTo('profile')" id="nav-profile">
                <i class="fa-solid fa-user"></i>
                <span>Profil</span>
            </div>
        `;
    }
    nav.innerHTML = html;
}

// Login Logic
async function handleLogin() {
    const userVal = document.getElementById('username').value;
    const passVal = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal, password: passVal })
        });

        const result = await response.json();

        if (result.success) {
            const foundUser = result.user;
            isAdmin = foundUser.role === 'admin';
            isTeacher = foundUser.role === 'teacher';

            // Map user data
            APP_DATA.user = {
                name: foundUser.name,
                class: foundUser.class,
                score: foundUser.score || 0,
                testsTaken: foundUser.testsTaken || 0,
                username: foundUser.user,
                role: foundUser.role,
                completedTests: foundUser.completedTests || {}
            };

            localStorage.setItem('userSession', JSON.stringify(foundUser));

            document.getElementById('login-screen').classList.add('hidden');
            document.querySelectorAll('.top-navbar, #bottom-navbar').forEach(el => {
                el.classList.remove('hidden');
            });

            await fetchData();
            initSocketListeners();
            updateHeaderScore();

            renderBottomNav();
            if (isAdmin) currentSection = 'admin';
            else currentSection = 'home';

            renderSection();

            const topProfileBtn = document.getElementById('profile-btn');
            if (topProfileBtn) {
                if (isAdmin || isTeacher) {
                    topProfileBtn.innerHTML = '<i class="fa-solid fa-user-circle"></i>';
                    topProfileBtn.setAttribute('onclick', "navigateTo('profile')");
                } else {
                    topProfileBtn.innerHTML = '<i class="fa-solid fa-chart-pie"></i>';
                    topProfileBtn.setAttribute('onclick', "renderAnalyticsView()");
                }
            }
        } else {
            showCustomAlert(result.message);
        }
    } catch (error) {
        console.error("Login hatosi:", error);
        showCustomAlert("Serverga ulanishda xatolik yuz berdi!");
    }
}

function initSocketListeners() {
    socket.on('dataUpdate', async (data) => {
        const { users: fetchedUsers = [], schedules = [], ...appData } = data;
        APP_DATA = { ...APP_DATA, ...appData, users: fetchedUsers, schedules: schedules };

        // Sync current user's stats from server in real-time
        if (APP_DATA.user && APP_DATA.user.username) {
            const currentServerUser = fetchedUsers.find(u => u.user === APP_DATA.user.username);
            if (currentServerUser) {
                APP_DATA.user.score = currentServerUser.score || 0;
                APP_DATA.user.testsTaken = currentServerUser.testsTaken || 0;
                APP_DATA.user.completedTests = currentServerUser.completedTests || {};
                updateHeaderScore();
            }
        }

        // Re-render if not in a form or test or showing results
        if (!testState.active && !testState.showingResults && !currentSection.includes('Form')) {
            renderSection();
        }
    });

    const handleNewNotif = (notif) => {
        // Double check filter
        if (notif.role === 'admin' && !isAdmin) return;

        APP_DATA.notifications.unshift(notif);
        if (currentSection !== 'notifications') {
            notifCount++;
            updateNotifBadge();
        } else {
            renderSection();
        }
    };

    socket.on('newNotification', handleNewNotif);

    // Only admins listen to admin-specific notifications
    if (isAdmin) {
        socket.on('adminNotification', handleNewNotif);
    }
}

function updateHeaderScore() {
    const el = document.getElementById('header-score');
    const balanceBox = document.getElementById('user-balance');
    if (isAdmin || isTeacher) {
        balanceBox.classList.add('hidden');
    } else {
        balanceBox.classList.remove('hidden');
        if (el && APP_DATA.user) {
            el.innerText = APP_DATA.user.score || 0;
        }
    }
}

function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (notifCount > 0) {
        badge.innerText = notifCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function fetchData() {
    try {
        const response = await fetch(`${API_BASE}/data`);
        if (!response.ok) {
            console.error(`Server xatosi: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        // Separate users from appData
        const { users: fetchedUsers = [], ...appData } = data;
        APP_DATA = { ...APP_DATA, ...appData, users: fetchedUsers };

        // Sync current user's stats from server
        if (APP_DATA.user && (APP_DATA.user.username || APP_DATA.user.user)) {
            const currentU = APP_DATA.user.username || APP_DATA.user.user;
            const currentServerUser = fetchedUsers.find(u => u.user === currentU);
            if (currentServerUser) {
                APP_DATA.user.score = currentServerUser.score || 0;
                APP_DATA.user.testsTaken = currentServerUser.testsTaken || 0;
                APP_DATA.user.completedTests = currentServerUser.completedTests || {};
                updateHeaderScore();
            }
        }

        // Sync ranking from users list (backup)
        if (fetchedUsers && Array.isArray(fetchedUsers)) {
            APP_DATA.ranking = fetchedUsers
                .filter(u => u.role === 'student')
                .map(u => ({ name: u.name, score: u.score || 0 }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
        }

    } catch (error) {
        console.error("Ma'lumotlarni yuklashda xato:", error);
    }
}

async function handleLogout() {
    const quit = await showCustomConfirm("Chiqish", "Tizimdan chiqmoqchimisiz?");
    if (quit) {
        isAdmin = false;
        // Clear inputs
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';

        // Show login, hide app
        document.getElementById('login-screen').classList.remove('hidden');
        document.querySelectorAll('.top-navbar, .bottom-navbar').forEach(el => {
            el.classList.add('hidden');
        });

        // Reset state
        currentSection = 'home';
        const content = document.getElementById('app-content');
        content.innerHTML = '';
    }
}

// // Section Rendering
function renderSection() {
    const content = document.getElementById('app-content');
    if (!content) return;

    content.innerHTML = '';
    content.className = 'fade-in';

    try {
        const section = sectionMap[currentSection] || currentSection;
        console.log("Rendering section:", section);

        switch (section) {
            case 'home': renderHome(content); break;
            case 'test': renderTest(content); break;
            case 'gift': renderGift(content); break;
            case 'ranking': renderRanking(content); break;
            case 'profile': renderProfile(content); break;
            case 'admin': renderAdmin(content); break;
            case 'teacher': renderTeacher(content); break;
            case 'messages': renderAdminMessages(content); break;
            case 'notifications': renderNotifications(content); break;
            case 'news-detail': renderNewsDetail(content); break;
            case 'schedule': renderSchedule(content); break;
            default:
                content.innerHTML = `<div style="text-align:center; padding:50px;">
                    <h3>Sahifa topilmadi: ${section}</h3>
                    <button class="buy-btn" onclick="navigateTo('home')">Bosh sahifaga qaytish</button>
                </div>`;
        }
    } catch (err) {
        console.error("Rendering error:", err);
        content.innerHTML = `<div style="text-align:center; padding:50px; color:var(--text-muted);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; margin-bottom:15px; color:var(--secondary);"></i>
            <h3>Yuklashda xatolik yuz berdi</h3>
            <p style="font-size:0.9rem; margin-bottom:20px;">Iltimos, sahifani yangilang yoki birozdan so'ng urinib ko'ring.</p>
            <button class="buy-btn" onclick="location.reload()">Sahifani yangilash</button>
        </div>`;
    }
}

function renderTeacher(container) {
    container.innerHTML = `
        <div class="section-title">
            <span>O'qituvchi Paneli</span>
        </div>

        <div id="teacher-view-container" class="fade-in">
            <div class="glass-card fade-in" style="padding: 20px; margin-bottom: 20px; text-align: center; cursor: pointer; border: 1px solid var(--secondary);" onclick="renderAnalyticsView()">
                <i class="fa-solid fa-chart-bar" style="font-size: 2rem; color: var(--secondary); margin-bottom: 10px;"></i>
                <h3>Sinflar Analitikasi</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted);">O'zlashtirish grafiklarini ko'rish</p>
            </div>
            <div class="glass-card fade-in" style="padding: 20px;">
                <h3 style="margin-bottom: 15px; font-size: 1.1rem; text-align: center;">Sinflarni tanlang</h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                    <!-- 11-sinf -->
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '11')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white;">11</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">11-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <!-- 10-sinf -->
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '10')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white;">10</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">10-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <!-- 9-sinf -->
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '9')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white;">9</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">9-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <!-- 8-sinf -->
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '8')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white;">8</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">8-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <!-- 7-sinf -->
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '7')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white;">7</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">7-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <!-- 6-sinf -->
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '6')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white;">6</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">6-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <!-- 5-sinf -->
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '5')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white;">5</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">5-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTeacherDashboardHome() {
    return `
        <div class="glass-card" style="padding: 20px; text-align: center;">
            <h3 style="margin-bottom: 10px;">Xush kelibsiz, ${APP_DATA.user.name}!</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
                Bugungi yangiliklar va o'quvchilar ko'rsatkichlarini kuzatib boring.
            </p>
        </div>
    `;
}

async function renderTeacherView(view, param) {
    const container = document.getElementById('teacher-view-container');
    if (!container) return;

    if (view === 'classes') {
        container.innerHTML = `
            <div class="glass-card fade-in" style="padding: 20px;">
                <h3 style="margin-bottom: 15px; font-size: 1.1rem; text-align: center;">Sinflarni tanlang</h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary-glow); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '11')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary-glow); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800;">11</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">11-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary-glow); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '10')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary-glow); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800;">10</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">10-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary-glow); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '9')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; background: var(--primary-glow); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800;">9</div>
                            <span style="font-size: 1.1rem; font-weight: 600;">9-sinflar</span>
                        </div>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            </div>
        `;
    } else if (view === 'class-students') {
        container.innerHTML = `
            <div class="glass-card fade-in" style="padding: 20px; text-align: center;">
                <div class="loading-spinner" style="margin: 0 auto 10px;"></div>
                <p>O'quvchilar ro'yxati tekshirilmoqda...</p>
            </div>
        `;

        await fetchData();
        const allUsers = APP_DATA.users || [];

        // Robust filtering
        const classStudents = allUsers.filter(u => {
            const isStudent = u.role && u.role.toString().toLowerCase() === 'student';
            const belongsToGrade = u.class && u.class.toString().startsWith(param);
            return isStudent && belongsToGrade;
        });

        console.log(`Filtered students for grade ${param}:`, classStudents.length);

        container.innerHTML = `
            <div class="glass-card fade-in" style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-arrow-left" style="cursor: pointer;" onclick="renderTeacherView('classes')"></i>
                        <h3 style="font-size: 1.1rem;">${param}-sinf o'quvchilari</h3>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${classStudents.length} ta o'quvchi</span>
                </div>
                <div style="display: grid; gap: 15px;">
                    ${classStudents.length > 0 ? classStudents.map(s => `
                        <div class="glass-card" style="padding: 15px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div>
                                    <div style="font-weight: 600; font-size: 1rem;">${s.name}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">Sinfi: ${s.class}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; color: var(--secondary);">${s.score || 0} ball</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 12px;">
                                <span style="font-size: 0.8rem; color: var(--text-muted); flex-shrink: 0;">Ball qo'shish:</span>
                                <input type="number" id="pts-${s.user}" min="1" max="5" value="1" 
                                    style="width: 50px; background: transparent; border: 1px solid var(--glass-border); color: white; padding: 5px; border-radius: 8px; text-align: center;">
                                <button class="buy-btn" style="padding: 8px 15px; font-size: 0.8rem; flex-grow: 1;" onclick="addPointsToStudent('${s.user}')">
                                    <i class="fa-solid fa-plus"></i> Qo'shish
                                </button>
                            </div>
                        </div>
                    `).join('') : `
                        <div style="text-align: center; padding: 40px 20px; border: 2px dashed var(--glass-border); border-radius: 20px;">
                            <i class="fa-solid fa-user-slash" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 15px; display: block;"></i>
                            <p style="color: var(--text-main); font-weight: 600; margin-bottom: 5px;">O'quvchilar topilmadi</p>
                            <p style="color: var(--text-muted); font-size: 0.85rem;">Bu bo'limda hali ${param}-sinf o'quvchilari mavjud emas.</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
}

async function addPointsToStudent(studentUsername) {
    const pointsInput = document.getElementById(`pts-${studentUsername}`);
    const points = parseInt(pointsInput.value);

    if (isNaN(points) || points < 1 || points > 5) {
        showCustomAlert("Maksimal 5 ball qo'shish mumkin!");
        return;
    }

    const confirm = await showCustomConfirm("Ball qo'shish", `${studentUsername}ga ${points} ball qo'shmoqchimisiz?`);
    if (!confirm) return;

    try {
        const teacherU = APP_DATA.user.username || APP_DATA.user.user;
        const response = await fetch(`${API_BASE}/teacher/add-points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacherUsername: teacherU,
                studentUsername: studentUsername,
                points: points
            })
        });

        if (response.ok) {
            await fetchData();
            showCustomAlert("Ball muvaffaqiyatli qo'shildi!");
            // Extract grade number (e.g., "11" from "11-A") to maintain same view
            const student = APP_DATA.users.find(u => u.user === studentUsername);
            const grade = student.class ? student.class.match(/^\d+/)[0] : '';
            renderTeacherView('class-students', grade);
        } else {
            const data = await response.json();
            showCustomAlert(data.message || "Xatolik yuz berdi!");
        }
    } catch (error) {
        console.error("Ball qo'shishda xato:", error);
    }
}

function renderAdmin(container) {
    container.innerHTML = `
        <div class="section-title">
            <span>Boshqaruv Paneli</span>
        </div>

        <div class="test-grid" style="grid-template-columns: 1fr; gap: 12px;">
            <div class="glass-card" onclick="renderAnalyticsView()" style="display: flex; align-items: center; gap: 20px; padding: 20px; cursor: pointer; background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%); border: 1px solid rgba(99,102,241,0.2);">
                <div style="width: 55px; height: 55px; border-radius: 18px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px rgba(99,102,241,0.3);">
                    <i class="fa-solid fa-chart-pie"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Analitika</h3>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-muted);">Platforma statistikasini ko'rish</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2);"></i>
            </div>

            <div class="glass-card" onclick="renderAdminForm('news')" style="display: flex; align-items: center; gap: 20px; padding: 20px; cursor: pointer; background: linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(234,179,8,0.1) 100%); border: 1px solid rgba(249,115,22,0.2);">
                <div style="width: 55px; height: 55px; border-radius: 18px; background: linear-gradient(135deg, #f97316 0%, #eab308 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px rgba(249,115,22,0.3);">
                    <i class="fa-solid fa-newspaper"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Yangilik qo'shish</h3>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-muted);">Yangi xabarlar va e'lonlar</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2);"></i>
            </div>

            <div class="glass-card" onclick="renderAdminForm('gift')" style="display: flex; align-items: center; gap: 20px; padding: 20px; cursor: pointer; background: linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(217,70,239,0.1) 100%); border: 1px solid rgba(236,72,153,0.2);">
                <div style="width: 55px; height: 55px; border-radius: 18px; background: linear-gradient(135deg, #ec4899 0%, #d946ef 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px rgba(236,72,153,0.3);">
                    <i class="fa-solid fa-gift"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Sovg'a qo'shish</h3>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-muted);">Do'kon uchun yangi mahsulotlar</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2);"></i>
            </div>

            <div class="glass-card" onclick="renderAdminForm('quiz')" style="display: flex; align-items: center; gap: 20px; padding: 20px; cursor: pointer; background: linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(20,184,166,0.1) 100%); border: 1px solid rgba(34,197,94,0.2);">
                <div style="width: 55px; height: 55px; border-radius: 18px; background: linear-gradient(135deg, #22c55e 0%, #14b8a6 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px rgba(34,197,94,0.3);">
                    <i class="fa-solid fa-list-check"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Savol qo'shish</h3>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-muted);">Testlar uchun yangi savollar</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2);"></i>
            </div>

            <div class="glass-card" onclick="renderAdminForm('schedule')" style="display: flex; align-items: center; gap: 20px; padding: 20px; cursor: pointer; background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(6,182,212,0.1) 100%); border: 1px solid rgba(59,130,246,0.2);">
                <div style="width: 55px; height: 55px; border-radius: 18px; background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px rgba(59,130,246,0.3);">
                    <i class="fa-solid fa-calendar-days"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Dars jadvali</h3>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-muted);">Sinf jadvallarini tahrirlash</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2);"></i>
            </div>

            <div class="glass-card" onclick="renderAdminForm('user')" style="display: flex; align-items: center; gap: 20px; padding: 20px; cursor: pointer; background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(79,70,229,0.1) 100%); border: 1px solid rgba(99,102,241,0.2);">
                <div style="width: 55px; height: 55px; border-radius: 18px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px rgba(99,102,241,0.3);">
                    <i class="fa-solid fa-user-plus"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Foydalanuvchi yaratish</h3>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-muted);">Yangi o'quvchi yoki o'qituvchi</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2);"></i>
            </div>
        </div>

        <div class="section-title" style="margin-top: 30px;">
            <span>Yaqinda qo'shilganlar</span>
        </div>
        <div class="glass-card" style="padding: 10px;">
            ${APP_DATA.users ? APP_DATA.users.slice(-3).reverse().map(u => `
                <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.9rem;">${u.name}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${u.class}</span>
                </div>
            `).join('') : '<p>Hozircha a\'zolar yo\'q</p>'}
            <div style="text-align: center; padding-top: 10px;">
                <button onclick="navigateTo('profile')" style="background: none; border: none; color: var(--primary); font-size: 0.8rem; cursor: pointer;">Hammasini ko'rish <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>
    `;
}

function renderAdminForm(type, selectedSubId = null) {
    const container = document.getElementById('app-content');
    let formHTML = `
        <div class="section-title">
            <button class="back-btn-premium" onclick="renderAdmin(document.getElementById('app-content'))">
                <i class="fa-solid fa-chevron-left"></i> Orqaga
            </button>
        </div>
    `; if (type === 'news') {
        formHTML += `
            <div class="glass-card fade-in" style="margin-bottom: 20px;">
                <h3 style="margin-bottom:15px;"><i class="fa-solid fa-pen-to-square"></i> Yangilik qo'shish</h3>
                <div class="login-form">
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                        <input type="text" id="new-news-title" placeholder="Yangilik sarlavhasi" style="color:white; padding: 10px;" oninput="updateNewsPreview()">
                    </div>
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                        <textarea id="new-news-text" placeholder="Yangilik matni" style="width:100%; height: 100px; background:transparent; border:none; color:white; padding: 10px; outline:none; font-family: inherit;" oninput="updateNewsPreview()"></textarea>
                    </div>
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 15px;">
                        <input type="file" id="new-news-img-file" accept="image/*,video/mp4" style="color:white; padding: 10px;" onchange="updateNewsPreview()">
                    </div>
                    <button class="buy-btn" onclick="addNewNews()">Saqlash</button>
                </div>
            </div>

            <div class="glass-card fade-in" style="margin-bottom: 20px; border: 1px solid var(--primary);">
                <h3 style="margin-bottom:10px; font-size: 0.9rem; color: var(--primary);">Real Ko'rinish (Preview)</h3>
                <div id="news-preview-container" class="news-card" style="width: 100%; margin: 0; position: relative; height: 180px; overflow: hidden; border-radius: 20px; background: #000;">
                    <img id="preview-img" src="https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&q=80" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    <video id="preview-video" style="display: none; width: 100%; height: 100%; object-fit: cover;" autoplay muted loop></video>
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 15px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); display: flex; justify-content: space-between; align-items: flex-end;">
                        <span class="news-tag" style="margin:0;">Yangilik</span>
                        <button style="border:none; background: var(--primary); color: white; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">Batafsil</button>
                    </div>
                </div>
            </div>

            <div class="glass-card fade-in">
                <h3 style="margin-bottom:15px;">Mavjud yangiliklar</h3>
                ${APP_DATA.news.map(n => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:10px; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-size:0.9rem; font-weight: 600;">${n.title}</span>
                            <span style="font-size:0.75rem; color: var(--text-muted);">
                                <i class="fa-regular fa-eye"></i> ${n.views || 0} marta ko'rildi
                            </span>
                        </div>
                        <button onclick="deleteNews(${n.id})" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:8px 12px; border-radius:10px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (type === 'gift') {
        formHTML += `
            <div class="glass-card fade-in" style="margin-bottom: 20px;">
                <h3 style="margin-bottom:15px;"><i class="fa-solid fa-gift"></i> Sovg'a qo'shish</h3>
                <div class="login-form">
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                        <input type="text" id="new-gift-name" placeholder="Sovg'a nomi" style="color:white; padding: 10px;">
                    </div>
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                        <input type="number" id="new-gift-points" placeholder="Ball" style="color:white; padding: 10px;">
                    </div>
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 15px;">
                        <input type="file" id="new-gift-img-file" accept="image/*" style="color:white; padding: 10px;">
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px; margin-left: 10px;">Ixtiyoriy: Sovg'a uchun rasm yuklang</p>
                    </div>
                    <button class="buy-btn" onclick="addNewGift()">Saqlash</button>
                </div>
            </div>

            <div class="glass-card fade-in">
                <h3 style="margin-bottom:15px;">Mavjud sovg'alar</h3>
                ${APP_DATA.gifts.map(g => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:10px;">
                        <span style="font-size:0.9rem;">${g.name} (${g.points} ball)</span>
                        <button onclick="deleteGift(${g.id})" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:5px 10px; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (type === 'schedule') {
        const classList = Array.from(new Set(APP_DATA.users.filter(u => u.class).map(u => u.class)));
        formHTML += `
            <div class="glass-card fade-in" style="margin-bottom: 20px;">
                <h3 style="margin-bottom:15px;"><i class="fa-solid fa-calendar-days"></i> Dars jadvali qo'shish</h3>
                <div class="login-form">
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">Sinfni tanlang (yoki yozing):</p>
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 15px;">
                        <input type="text" id="sch-class" list="class-options" placeholder="Sinf nomi (Masalan: 11-A sinf)" style="color:white; padding: 10px; width: 100%;">
                        <datalist id="class-options">
                            ${classList.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </datalist>
                    </div>
                    
                    ${['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'].map(day => `
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px; margin-left: 5px;">${day}:</p>
                        <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                            <textarea id="sch-${day.toLowerCase()}" placeholder="Darslarni yozing..." style="width:100%; height: 60px; background:transparent; border:none; color:white; padding: 10px; outline:none; font-family: inherit; resize: vertical;"></textarea>
                        </div>
                    `).join('')}
                    
                    <button class="buy-btn" onclick="saveSchedule()">Saqlash</button>
                </div>
            </div>
            
            <div class="glass-card fade-in">
                <h3 style="margin-bottom:15px;">Mavjud jadvallar</h3>
                ${(APP_DATA.schedules || []).map(s => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:10px;">
                        <span style="font-size:0.9rem;">${s.class} jadvali</span>
                        <button onclick="deleteSchedule('${s.class}')" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:5px 10px; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-trash"></i> O'chirish</button>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (type === 'quiz') {
        formHTML += `
            <div class="glass-card fade-in" style="margin-bottom: 20px;">
                <h3 style="margin-bottom:15px;"><i class="fa-solid fa-circle-question"></i> Test savoli qo'shish</h3>
                <div class="login-form">
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">Fanni tanlang:</p>
                    <select id="q-subject" onchange="renderAdminForm('quiz', this.value)" style="background: var(--bg-dark); color: white; padding: 12px; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 15px;">
                        ${APP_DATA.subjects.map(s => `<option value="${s.id}" ${s.id === selectedSubId ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                    
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                        <input type="text" id="q-text" placeholder="Savol matni" style="color:white; padding: 10px;">
                    </div>

                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                        <input type="file" id="q-img-file" accept="image/*" style="color:white; padding: 10px;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                            <input type="text" id="q-opt1" placeholder="A javob" style="color:white; padding: 10px;">
                        </div>
                        <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                            <input type="text" id="q-opt2" placeholder="B javob" style="color:white; padding: 10px;">
                        </div>
                        <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                            <input type="text" id="q-opt3" placeholder="C javob" style="color:white; padding: 10px;">
                        </div>
                        <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                            <input type="text" id="q-opt4" placeholder="D javob" style="color:white; padding: 10px;">
                        </div>
                    </div>

                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">To'g'ri javobni tanlang:</p>
                    <select id="q-correct" style="background: var(--bg-dark); color: white; padding: 12px; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 15px;">
                        <option value="0">A varianti</option>
                        <option value="1">B varianti</option>
                        <option value="2">C varianti</option>
                        <option value="3">D varianti</option>
                    </select>

                    <button class="buy-btn" onclick="addNewQuestion()">Saqlash</button>
                </div>
            </div>

            <div class="glass-card fade-in">
                <h3 style="margin-bottom:15px;">Mavjud savollar</h3>
                <div id="questions-list-container">
                    ${(() => {
                const subId = selectedSubId || document.getElementById('q-subject')?.value || 'math';
                const subject = APP_DATA.subjects.find(s => s.id === subId);
                return subject.questions.map((q, idx) => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:10px;">
                                <span style="font-size:0.8rem; flex:1;">${q.q}</span>
                                <button onclick="deleteQuestion('${subId}', ${idx})" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:5px 10px; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        `).join('') || '<p style="font-size:0.8rem; color:var(--text-muted);">Hozircha savollar yo\'q</p>';
            })()}
                </div>
            </div>
        `;
    } else if (type === 'user') {
        formHTML += `
            <div class="glass-card fade-in">
                <h3 style="margin-bottom:15px;"><i class="fa-solid fa-user-plus"></i> Foydalanuvchi yaratish</h3>
                <div class="login-form">
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                        <input type="text" id="new-user-fullname" placeholder="Ism va Familiya" style="color:white; padding: 10px;">
                    </div>
                    
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">Roli:</p>
                    <select id="new-user-role" onchange="toggleUserRoleFields(this.value)" style="background: var(--bg-dark); color: white; padding: 12px; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 15px; width: 100%;">
                        <option value="student">O'quvchi</option>
                        <option value="teacher">O'qituvchi</option>
                    </select>

                    <div id="student-class-fields">
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">Sinfi:</p>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <input type="number" id="new-user-grade" placeholder="Sinf (1-11)" min="1" max="11" style="width: 50%; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; padding: 10px; border-radius: 12px;">
                            <select id="new-user-letter" style="width: 50%; background: var(--bg-dark); color: white; padding: 10px; border-radius: 12px; border: 1px solid var(--glass-border);">
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="V">V</option>
                                <option value="G">G</option>
                                <option value="D">D</option>
                                <option value="E">E</option>
                            </select>
                        </div>
                    </div>

                    <div id="teacher-subject-fields" class="hidden">
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">Fani:</p>
                        <select id="new-user-subject" style="background: var(--bg-dark); color: white; padding: 12px; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 15px; width: 100%;">
                            ${APP_DATA.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                        <input type="text" id="new-user-login" placeholder="Login (username)" style="color:white; padding: 10px;">
                    </div>
                    <div class="input-group" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); margin-bottom: 10px;">
                        <input type="text" id="new-user-pass" placeholder="Parol" style="color:white; padding: 10px;">
                    </div>
                    
                    <button class="buy-btn" onclick="addNewUser()">Yaratish</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = formHTML;
}

function renderAdminMessages(container) {
    container.innerHTML = `
        <div class="section-title">
            <span>Xabar yuborish</span>
        </div>
        <div class="glass-card">
            <p style="color: var(--text-muted); margin-bottom: 20px;">Barcha o'quvchilarga bildirishnoma yuborish</p>
            <textarea id="admin-msg" style="width: 100%; height: 150px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 16px; color: white; padding: 15px; margin-bottom: 15px; outline: none; font-family: inherit;"></textarea>
            <button class="buy-btn" onclick="sendAdminMsg()">Yuborish <i class="fa-solid fa-paper-plane"></i></button>
        </div>
    `;
}

async function sendAdminMsg() {
    const msg = document.getElementById('admin-msg').value;
    if (msg) {
        const notif = {
            id: Date.now(),
            text: msg,
            time: getCurrentTime(),
            read: false
        };

        await fetch(`${API_BASE}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notif)
        });

        await fetchData();
        document.getElementById('notif-badge').classList.remove('hidden');
        showCustomAlert("Xabar barcha o'quvchilarga yuborildi!");
        document.getElementById('admin-msg').value = '';
    }
}

function renderNotifications(container) {
    // Filter notifications based on user role
    const visibleNotifs = APP_DATA.notifications.filter(n => {
        // If it's a private message, check if it's for current user
        if (n.to && n.to !== APP_DATA.user.user) return false;
        
        if (n.role === 'admin') return isAdmin;
        return true;
    });

    container.innerHTML = `
        <div class="section-title">
            <span>Bildirishnomalar</span>
        </div>
        <div class="notif-list">
            ${visibleNotifs.length > 0 ? visibleNotifs.map(n => `
                <div class="glass-card fade-in" style="margin-bottom: 15px; border-left: 4px solid ${n.read ? 'var(--glass-border)' : 'var(--primary)'};">
                    <p style="font-size: 1rem; margin-bottom: 10px;">${n.text}</p>
                    <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${n.time}</span>
                </div>
            `).join('') : `
                <div style="text-align:center; padding: 50px 20px; color: var(--text-muted);">
                    <i class="fa-solid fa-bell-slash" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>Hozircha xabarlar yo'q</p>
                </div>
            `}
        </div>
    `;
}

async function addNewGift() {
    const name = document.getElementById('new-gift-name').value;
    const points = document.getElementById('new-gift-points').value;
    const fileInput = document.getElementById('new-gift-img-file');
    const imgFile = fileInput ? fileInput.files[0] : null;

    if (name && points) {
        let imageUrl = null;

        if (imgFile) {
            const formData = new FormData();
            formData.append('image', imgFile);
            try {
                const uploadRes = await fetch(`${API_BASE}/upload`, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success) {
                    imageUrl = uploadData.url;
                }
            } catch (error) {
                console.error("Rasm yuklashda xatolik:", error);
            }
        }

        const gift = {
            id: Date.now(),
            name: name,
            points: parseInt(points),
            icon: "fa-gift",
            image: imageUrl
        };

        await fetch(`${API_BASE}/gifts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gift)
        });

        await fetchData();
        showCustomAlert("Yangi sovg'a qo'shildi!");
        renderAdmin(document.getElementById('app-content'));
    } else {
        showCustomAlert("Iltimos, sovg'a nomi va balini kiriting!");
    }
}

async function saveSchedule() {
    const className = document.getElementById('sch-class').value.trim();
    if (!className) {
        showCustomAlert("Iltimos, sinfni kiriting!");
        return;
    }

    const scheduleData = {
        class: className,
        days: {
            dushanba: document.getElementById('sch-dushanba').value.trim(),
            seshanba: document.getElementById('sch-seshanba').value.trim(),
            chorshanba: document.getElementById('sch-chorshanba').value.trim(),
            payshanba: document.getElementById('sch-payshanba').value.trim(),
            juma: document.getElementById('sch-juma').value.trim(),
            shanba: document.getElementById('sch-shanba').value.trim()
        }
    };

    await fetch(`${API_BASE}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData)
    });

    await fetchData();
    showCustomAlert("Dars jadvali muvaffaqiyatli saqlandi!");
    renderAdmin(document.getElementById('app-content'));
}

async function addNewQuestion() {
    const subjectId = document.getElementById('q-subject').value;
    const text = document.getElementById('q-text').value;
    const imgFile = document.getElementById('q-img-file').files[0];
    const options = [
        document.getElementById('q-opt1').value,
        document.getElementById('q-opt2').value,
        document.getElementById('q-opt3').value,
        document.getElementById('q-opt4').value
    ];
    const correct = parseInt(document.getElementById('q-correct').value);

    let imageUrl = null;
    if (imgFile) {
        const formData = new FormData();
        formData.append('image', imgFile);
        const uploadRes = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const result = await uploadRes.json();
        if (result.success) imageUrl = result.url;
    }

    if (text && options.every(o => o)) {
        const question = { q: text, options, correct, image: imageUrl };

        await fetch(`${API_BASE}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectId, question })
        });

        await fetchData();
        alert("Savol muvaffaqiyatli qo'shildi!");
        renderAdmin(document.getElementById('app-content'));
    } else {
        alert("Barcha maydonlarni to'ldiring!");
    }
}

async function addNewUser() {
    const fullName = document.getElementById('new-user-fullname').value;
    const userClass = document.getElementById('new-user-class').value;
    const user = document.getElementById('new-user-login').value;
    const pass = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;

    if (fullName && user && pass) {
        const newUser = {
            user,
            pass,
            role,
            name: fullName,
            class: userClass || (role === 'teacher' ? "O'qituvchi" : "Admin")
        };

        await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });

        alert(`${fullName} muvaffaqiyatli yaratildi!`);
        renderAdmin(document.getElementById('app-content'));
    } else {
        alert("Barcha maydonlarni to'ldiring!");
    }
}

async function addNewNews() {
    const title = document.getElementById('new-news-title').value;
    const text = document.getElementById('new-news-text').value;
    const imgFile = document.getElementById('new-news-img-file').files[0];

    if (title && text) {
        let imageUrl = "news.png";

        if (imgFile) {
            const formData = new FormData();
            formData.append('image', imgFile);

            try {
                const uploadRes = await fetch(`${API_BASE}/upload`, {
                    method: 'POST',
                    body: formData
                });
                const uploadResult = await uploadRes.json();
                if (uploadResult.success) {
                    imageUrl = uploadResult.url;
                }
            } catch (error) {
                console.error("Rasm yuklashda xato:", error);
            }
        }

        const isVideo = imgFile && imgFile.type.includes('video');
        const news = {
            id: Date.now(),
            title: title,
            text: text,
            tag: "Yangilik",
            image: imageUrl,
            type: isVideo ? 'video' : 'image'
        };

        const response = await fetch(`${API_BASE}/news`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(news)
        });

        if (response.ok) {
            await fetchData();
            showCustomAlert("Yangilik muvaffaqiyatli qo'shildi!");
            renderAdminForm('news'); // Stay in news form to see the list
        } else {
            const errData = await response.json();
            showCustomAlert("Xatolik: " + (errData.message || "Yangilikni saqlab bo'lmadi"));
        }
    } else {
        showCustomAlert("Sarlavha va matnni kiriting!");
    }
}

async function deleteNews(id) {
    const quit = await showCustomConfirm("O'chirish", "Ushbu yangilikni o'chirmoqchimisiz?");
    if (quit) {
        await fetch(`${API_BASE}/news/${id}`, { method: 'DELETE' });
        await fetchData();
        renderAdminForm('news');
    }
}

async function deleteSchedule(className) {
    const quit = await showCustomConfirm("O'chirish", `${className} jadvalini butunlay o'chirmoqchimisiz?`);
    if (quit) {
        await fetch(`${API_BASE}/schedules/${encodeURIComponent(className)}`, { method: 'DELETE' });
        await fetchData();
        renderAdminForm('schedule');
    }
}

async function deleteGift(id) {
    const quit = await showCustomConfirm("O'chirish", "Ushbu sovg'ani o'chirmoqchimisiz?");
    if (quit) {
        await fetch(`${API_BASE}/gifts/${id}`, { method: 'DELETE' });
        await fetchData();
        renderAdminForm('gift');
    }
}

async function deleteQuestion(subjectId, index) {
    const quit = await showCustomConfirm("O'chirish", "Ushbu savolni o'chirmoqchimisiz?");
    if (quit) {
        await fetch(`${API_BASE}/questions/${subjectId}/${index}`, { method: 'DELETE' });
        await fetchData();
        renderAdminForm('quiz');
    }
}

const sectionMap = {
    'home': 'home',
    'test': 'test',
    'gift': 'gift',
    'ranking': 'ranking',
    'profile': 'profile',
    'admin': 'admin',
    'messages': 'messages',
    'notifications': 'notifications',
    'news-detail': 'news-detail'
};

function renderHome(container) {
    container.innerHTML = `
        <div class="section-title">
            <span>Yangiliklar</span>
        </div>
        <div class="news-slider">
            ${APP_DATA.news.map(n => `
                <div class="news-card" onclick="openNewsDetail(${n.id})">
                    ${n.type === 'video' ? `
                        <video src="${n.image}" autoplay muted loop playsinline></video>
                    ` : `
                        <img src="${n.image}" alt="${n.title}" onerror="this.src='news.png'">
                    `}
                    <div class="news-content">
                        <div style="display: flex; justify-content: flex-end; align-items: flex-start; margin-bottom: 5px; width: 100%;">
                            <div style="display: flex; gap: 10px; font-size: 0.7rem; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 10px; backdrop-filter: blur(5px);">
                                <span><i class="fa-regular fa-calendar"></i> ${n.date || 'Bugun'}</span>
                                <span><i class="fa-regular fa-eye"></i> ${n.views || 0}</span>
                            </div>
                        </div>
                        <h3 class="news-title">${n.title}</h3>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="glass-card" onclick="navigateTo('schedule')" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-top: 20px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 50px; height: 50px; border-radius: 15px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                    <i class="fa-regular fa-calendar-days"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Dars jadvali</h3>
                    <p id="live-schedule-status" style="margin: 0; font-size: 0.8rem; color: var(--text-muted); transition: all 0.3s;">${getLiveScheduleStatus()}</p>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-muted);"></i>
        </div>

        <div class="glass-card fade-in" style="margin-top: 20px; padding: 25px; background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%); border: 1px solid rgba(99,102,241,0.3); border-radius: 30px;">
            <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
                <div style="position: relative;">
                    <div style="width: 70px; height: 70px; border-radius: 22px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.8rem; box-shadow: 0 10px 20px rgba(99,102,241,0.3);">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <div style="position: absolute; bottom: -5px; right: -5px; width: 22px; height: 22px; background: #22c55e; border: 3px solid var(--bg-dark); border-radius: 50%;" title="Online"></div>
                </div>
                <div class="director-info">
                    <h3 style="margin:0; font-size: 1.2rem; font-weight: 700; letter-spacing: -0.5px;">Akbar Tohirov</h3>
                    <p style="margin:2px 0 0; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Maktab maslahatchisi</p>
                </div>
            </div>
            <a href="tel:+998910049600" onclick="showCustomAlert('Maslahatchi raqami: +998 91 004 96 00')" style="text-decoration:none; display: flex; align-items: center; justify-content: center; gap: 12px; background: #22c55e; color: white; padding: 15px; border-radius: 20px; font-weight: 700; font-size: 1rem; transition: all 0.3s; box-shadow: 0 10px 20px rgba(34,197,94,0.3);" class="call-btn">
                <i class="fa-solid fa-phone-volume"></i> Qo'ng'iroq qilish
            </a>
        </div>

        <div class="social-buttons" style="margin-top: 30px;">
            <a href="https://t.me/Maktabimhayoti" target="_blank" class="social-btn tg-btn"><i class="fa-brands fa-telegram"></i> Telegram</a>
            <a href="https://www.instagram.com/maktabimhayoti/?__pwa=1#" target="_blank" class="social-btn ig-btn"><i class="fa-brands fa-instagram"></i> Instagram</a>
        </div>
    `;
}

function renderSchedule(container) {
    container.innerHTML = `
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0;">
            <button style="border:none; background:rgba(255,255,255,0.1); color: white; padding: 8px 15px; border-radius: 10px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 5px;" onclick="navigateTo('home')">
                <i class="fa-solid fa-chevron-left"></i> Orqaga
            </button>
            <span style="font-size: 1.1rem; font-weight: 600;">Dars jadvali</span>
            <div style="width: 80px;"></div> <!-- Spacer for centering -->
        </div>
        <div id="schedule-container" class="fade-in" style="padding-bottom: 20px;">
            ${renderScheduleHtml()}
        </div>
    `;
}

function getLiveScheduleStatus() {
    if (!APP_DATA.user || !APP_DATA.user.class) return "Sinfingiz dars jadvalini ko'rish";
    
    const now = new Date();
    const dayNames = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
    const currentDay = dayNames[now.getDay()];
    
    if (currentDay === 'yakshanba') return "Bugun darslar yo'q (Dam olish kuni)";
    
    const schedule = APP_DATA.schedules ? APP_DATA.schedules.find(s => s.class === APP_DATA.user.class) : null;
    if (!schedule || !schedule.days[currentDay]) return "Sinfingiz dars jadvalini ko'rish";
    
    const subjects = schedule.days[currentDay].split('\n').filter(s => s.trim() !== '');
    if (subjects.length === 0) return "Bugun uchun darslar kiritilmagan";
    
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Lesson times in minutes from midnight
    const lessonTimes = [
        { start: 480, end: 525, name: '1-dars' }, // 08:00 - 08:45
        { start: 530, end: 575, name: '2-dars' }, // 08:50 - 09:35
        { start: 585, end: 630, name: '3-dars' }, // 09:45 - 10:30
        { start: 640, end: 685, name: '4-dars' }, // 10:40 - 11:25
        { start: 695, end: 740, name: '5-dars' }, // 11:35 - 12:20
        { start: 745, end: 790, name: '6-dars' }, // 12:25 - 13:10
        { start: 795, end: 840, name: '7-dars' }  // 13:15 - 14:00
    ];
    
    // Check if currently in a lesson
    for (let i = 0; i < lessonTimes.length; i++) {
        const lesson = lessonTimes[i];
        if (currentTimeMinutes >= lesson.start && currentTimeMinutes <= lesson.end) {
            const subject = subjects[i] || 'Dars';
            const startTimeStr = `${Math.floor(lesson.start / 60).toString().padStart(2, '0')}:${(lesson.start % 60).toString().padStart(2, '0')}`;
            return `<span style="color: #22c55e;"><i class="fa-solid fa-circle-play"></i> ${startTimeStr} ${subject} boshlandi</span>`;
        }
    }
    
    // Check if in a break (between lessons)
    for (let i = 0; i < lessonTimes.length - 1; i++) {
        if (currentTimeMinutes > lessonTimes[i].end && currentTimeMinutes < lessonTimes[i+1].start) {
            return `<span style="color: #eab308;"><i class="fa-solid fa-mug-hot"></i> Hozir tanaffus</span>`;
        }
    }
    
    return "Sinfingiz dars jadvalini ko'rish";
}

// Update live status every minute if home is rendered
setInterval(() => {
    const liveEl = document.getElementById('live-schedule-status');
    if (liveEl) {
        liveEl.innerHTML = getLiveScheduleStatus();
    }
}, 30000); // Check every 30 seconds

window.changeScheduleView = function (className) {
    const container = document.getElementById('schedule-container');
    if (container) container.innerHTML = renderScheduleHtml(className);
};

function renderScheduleHtml(selectedClass = null) {
    let targetClass = selectedClass;

    if (!isAdmin && !isTeacher && !targetClass) {
        targetClass = APP_DATA.user.class;
    }

    let html = '';

    if (isAdmin || isTeacher) {
        const classList = Array.from(new Set((APP_DATA.users || []).filter(u => u.class).map(u => u.class)));
        html += `
            <div style="margin-bottom: 15px;">
                <select onchange="changeScheduleView(this.value)" style="background: var(--bg-dark); color: white; padding: 10px; border-radius: 10px; border: 1px solid var(--glass-border); width: 100%; outline: none;">
                    <option value="">Sinfni tanlang...</option>
                    ${classList.map(c => `<option value="${c}" ${c === targetClass ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
        `;
    }

    if (!targetClass) {
        html += `<div class="glass-card" style="text-align:center; padding: 20px; color: var(--text-muted);">Sinf tanlanmagan yoki jadval mavjud emas.</div>`;
        return html;
    }

    const schedule = APP_DATA.schedules ? APP_DATA.schedules.find(s => s.class === targetClass) : null;

    if (!schedule) {
        html += `<div class="glass-card" style="text-align:center; padding: 20px; color: var(--text-muted);">${targetClass} uchun dars jadvali hali kiritilmagan.</div>`;
        return html;
    }

    const days = [
        { key: 'dushanba', label: 'Dushanba' },
        { key: 'seshanba', label: 'Seshanba' },
        { key: 'chorshanba', label: 'Chorshanba' },
        { key: 'payshanba', label: 'Payshanba' },
        { key: 'juma', label: 'Juma' },
        { key: 'shanba', label: 'Shanba' }
    ];

    const bellSchedule = [
        "08:00 - 08:45",
        "08:50 - 09:35",
        "09:40 - 10:25",
        "10:30 - 11:15",
        "11:30 - 12:15",
        "12:20 - 13:05",
        "13:10 - 13:55",
        "14:00 - 14:45"
    ];

    html += `<div style="display: grid; gap: 10px;">`;
    days.forEach(day => {
        const subjectsText = schedule.days[day.key] || '';

        let subjectsHtml = '<p style="color: var(--text-muted); font-size: 0.9rem;">Dars yo\'q</p>';
        if (subjectsText.trim() !== '') {
            const subjectList = subjectsText.split(/,|\n/).map(s => s.trim()).filter(s => s !== '');
            subjectsHtml = subjectList.map((sub, index) => {
                const time = bellSchedule[index] || '';
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: white; font-size: 0.9rem;"><span style="color: var(--primary); margin-right: 5px;">${index + 1}.</span> ${sub}</span>
                        <span style="color: var(--text-muted); font-size: 0.8rem;"><i class="fa-regular fa-clock"></i> ${time}</span>
                    </div>
                `;
            }).join('');
        }

        html += `
            <div class="glass-card" style="padding: 15px; border-left: 4px solid var(--primary);">
                <h4 style="margin-bottom: 12px; color: var(--primary); font-size: 1rem;"><i class="fa-regular fa-calendar"></i> ${day.label}</h4>
                ${subjectsHtml}
            </div>
        `;
    });
    html += `</div>`;

    return html;
}

async function openNewsDetail(id) {
    currentNewsId = id;

    // Increment view on server (only once when opening)
    fetch(`${API_BASE}/news/${id}/view`, { method: 'POST' });

    navigateTo('news-detail');
}

function renderNewsDetail(container) {
    const n = APP_DATA.news.find(item => item.id === currentNewsId);
    if (!n) {
        navigateTo('home');
        return;
    }

    container.innerHTML = `
        <div class="section-title">
            <button class="nav-logo" style="border:none; background:none; font-size: 0.9rem;" onclick="navigateTo('home')">
                <i class="fa-solid fa-chevron-left"></i> Orqaga
            </button>
        </div>
        <div class="glass-card fade-in" style="padding:0; overflow:hidden;">
            ${n.type === 'video' ? `
                <video src="${n.image}" style="width: 100%; height: 250px; object-fit: cover; display: block;" controls autoplay playsinline></video>
            ` : `
                <img src="${n.image}" style="width: 100%; height: 200px; object-fit: cover; display: block;" onerror="this.src='news.png'">
            `}
            <div style="padding:20px;">
                <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:10px;">
                    <div style="display: flex; gap: 15px; font-size: 0.8rem; color: var(--text-muted);">
                        <span><i class="fa-regular fa-calendar"></i> ${n.date || 'Bugun'}</span>
                        <span><i class="fa-regular fa-eye"></i> ${n.views || 0} marta ko'rildi</span>
                    </div>
                </div>
                <h2 style="margin-bottom:15px; font-size:1.4rem;">${n.title}</h2>
                <p style="color:var(--text-muted); line-height:1.6; font-size:1rem; white-space: pre-wrap;">${n.text || ''}</p>
            </div>
        </div>
    `;
}

function updateNewsPreview() {
    const imgFile = document.getElementById('new-news-img-file').files[0];

    const previewImg = document.getElementById('preview-img');
    const previewVideo = document.getElementById('preview-video');

    if (imgFile) {
        const isVideo = imgFile.type.includes('video');
        const reader = new FileReader();
        reader.onload = (e) => {
            if (isVideo) {
                previewImg.style.display = 'none';
                previewVideo.style.display = 'block';
                previewVideo.src = e.target.result;
            } else {
                previewImg.style.display = 'block';
                previewVideo.style.display = 'none';
                previewImg.src = e.target.result;
            }
        };
        reader.readAsDataURL(imgFile);
    } else {
        previewImg.style.display = 'block';
        previewVideo.style.display = 'none';
        previewImg.src = "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&q=80";
    }
}
function renderTest(container) {
    if (testState.active) {
        renderActiveQuiz(container);
        return;
    }

    const subjectColors = {
        'math': { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', iconBg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', shadow: 'rgba(99,102,241,0.3)' },
        'physics': { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', iconBg: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', shadow: 'rgba(59,130,246,0.3)' },
        'english': { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', iconBg: 'linear-gradient(135deg, #f97316 0%, #eab308 100%)', shadow: 'rgba(249,115,22,0.3)' },
        'history': { bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)', iconBg: 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)', shadow: 'rgba(236,72,153,0.3)' },
        'literature': { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.2)', iconBg: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', shadow: 'rgba(168,85,247,0.3)' },
        'native_lang': { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', iconBg: 'linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)', shadow: 'rgba(34,197,94,0.3)' },
        'geography': { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.2)', iconBg: 'linear-gradient(135deg, #eab308 0%, #f97316 100%)', shadow: 'rgba(234,179,8,0.3)' },
        'biology': { bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.2)', iconBg: 'linear-gradient(135deg, #14b8a6 0%, #22c55e 100%)', shadow: 'rgba(20,184,166,0.3)' }
    };

    container.innerHTML = `
        <div class="section-title">
            <span>Fanlar bo'yicha testlar</span>
        </div>
        <div class="test-grid" style="grid-template-columns: 1fr; gap: 15px;">
            ${APP_DATA.subjects.map(s => {
        const qCount = s.questions.length;
        const isLocked = qCount === 0;
        const lastTaken = (APP_DATA.user.completedTests || {})[s.id] || 0;
        const lastUpdated = s.lastUpdated || 0;
        const isCompleted = lastTaken > lastUpdated;
        const theme = subjectColors[s.id] || subjectColors['math'];

        return `
                <div class="glass-card" onclick="${!isLocked && !isCompleted ? `startTest('${s.id}')` : ''}" style="display: flex; align-items: center; gap: 20px; padding: 18px; cursor: ${isLocked || isCompleted ? 'default' : 'pointer'}; background: ${theme.bg}; border: 1px solid ${theme.border}; opacity: ${isLocked ? '0.6' : '1'}; transition: transform 0.2s;">
                    <div style="width: 55px; height: 55px; border-radius: 18px; background: ${theme.iconBg}; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; box-shadow: 0 8px 20px ${theme.shadow};">
                        <i class="fa-solid ${s.icon}"></i>
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">${s.name}</h3>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${qCount} ta savol</span>
                            ${isCompleted ? '<span style="color: #22c55e; font-size: 0.75rem; font-weight: 600; background: rgba(34,197,94,0.1); padding: 2px 8px; border-radius: 10px;">Yechilgan <i class="fa-solid fa-check"></i></span>' : ''}
                            ${isLocked ? '<span style="color: var(--text-muted); font-size: 0.75rem; font-weight: 600; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px;">Tez kunda...</span>' : ''}
                        </div>
                    </div>
                    ${!isLocked && !isCompleted ? `<i class="fa-solid fa-play" style="color: #6366f1; font-size: 1.1rem;"></i>` : ''}
                </div>
            `;
    }).join('')}
        </div>
    `;
}

async function startTest(subjectId) {
    const subject = APP_DATA.subjects.find(s => s.id === subjectId);
    if (!subject || subject.questions.length === 0) return;

    // Check if test was already completed for this version
    const lastTaken = (APP_DATA.user.completedTests || {})[subjectId] || 0;
    const lastUpdated = subject.lastUpdated || 0;

    if (lastTaken > lastUpdated) {
        showCustomAlert("Siz ushbu testni yechib bo'lgansiz! Yangi savollar qo'shilishini kuting.");
        return;
    }

    testState = {
        active: true,
        showingResults: false,
        subjectId,
        subjectName: subject.name,
        questions: [...subject.questions].sort(() => Math.random() - 0.5),
        currentIdx: 0,
        score: 0,
        timer: 100,
        timerInterval: null
    };

    renderSection();
    startTimer();
}

function startTimer() {
    if (testState.timerInterval) clearInterval(testState.timerInterval);
    testState.timer = 100;
    const timerEl = document.getElementById('test-timer');
    if (timerEl) timerEl.innerText = testState.timer;

    testState.timerInterval = setInterval(() => {
        testState.timer--;
        if (timerEl) timerEl.innerText = testState.timer;
        if (testState.timer <= 0) {
            clearInterval(testState.timerInterval);
            nextQuestion();
        }
    }, 1000);
}

function checkAnswer(idx) {
    const q = testState.questions[testState.currentIdx];
    if (idx === q.correct) testState.score++;
    nextQuestion();
}

function nextQuestion() {
    testState.currentIdx++;
    if (testState.currentIdx < testState.questions.length) {
        renderSection();
        startTimer();
    } else {
        finishTest();
    }
}

async function finishTest() {
    console.log("finishTest called. subjectId:", testState.subjectId);
    testState.active = false;
    testState.showingResults = true;
    if (testState.timerInterval) clearInterval(testState.timerInterval);

    try {
        const payload = {
            username: APP_DATA.user.username,
            scoreDelta: testState.score,
            subjectId: testState.subjectId
        };
        console.log("Sending score update payload:", payload);

        // Immediate local update for instant UI feedback
        if (!APP_DATA.user.completedTests) APP_DATA.user.completedTests = {};
        APP_DATA.user.completedTests[testState.subjectId] = Date.now();

        await fetch(`${API_BASE}/user/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        await fetchData();

        // Show result screen
        const content = document.getElementById('app-content');
        const total = testState.questions.length;
        content.innerHTML = `
            <div class="glass-card fade-in" style="text-align: center; padding: 40px 20px;">
                <i class="fa-solid fa-circle-check" style="font-size: 4rem; color: var(--primary); margin-bottom: 20px;"></i>
                <h2 style="margin-bottom: 10px;">Test yakunlandi!</h2>
                <p style="color: var(--text-muted); margin-bottom: 30px;">Sizning natijangiz:</p>
                
                <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 30px;">
                    <div>
                        <div style="font-size: 2rem; font-weight: 700; color: #22c55e;">${testState.score}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">To'g'ri</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; font-weight: 700; color: #ef4444;">${total - testState.score}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Noto'g'ri</div>
                    </div>
                </div>

                <button class="buy-btn" style="width: 100%;" onclick="testState.showingResults = false; navigateTo('test')">
                    Bosh sahifaga qaytish
                </button>
            </div>
        `;
    } catch (error) {
        console.error("Testni yakunlashda xato:", error);
    }
}

function renderActiveQuiz(container) {
    const q = testState.questions[testState.currentIdx];

    container.innerHTML = `
        <div class="test-header glass-card">
            <div class="test-info">
                <h3>${testState.subjectName}</h3>
                <p>Savol: ${testState.currentIdx + 1}/${testState.questions.length}</p>
            </div>
            <div class="test-timer" id="test-timer">${testState.timer}</div>
        </div>

        <div class="question-card glass-card">
            ${q.image ? `<img src="${q.image}" class="question-img" style="width: 100%; border-radius: 12px; margin-bottom: 15px;">` : ''}
            <h2 class="question-text">${q.q}</h2>
            <div class="options-list">
                ${q.options.map((opt, i) => `
                    <button class="option-btn" onclick="checkAnswer(${i})">${opt}</button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderGift(container) {
    container.innerHTML = `
        <div class="section-title">
            <span>Maktab sovg'alari</span>
            <div style="font-size: 0.9rem; color: var(--secondary);">
                <i class="fa-solid fa-star"></i> ${APP_DATA.user.score} ball
            </div>
        </div>
        <div class="gift-grid">
            ${APP_DATA.gifts.map(g => {
        const isLocked = APP_DATA.user.score < g.points;
        return `
                    <div class="glass-card gift-card ${isLocked ? 'locked' : ''}">
                        <div class="gift-icon-box" style="${g.image ? `background-image: url('${g.image}'); background-size: cover; background-position: center; border: none;` : ''}">
                            ${g.image ? '' : `<i class="fa-solid ${g.icon}"></i>`}
                        </div>
                        <div class="gift-info">
                            <h3>${g.name}</h3>
                            <p class="gift-cost">${g.points} ball</p>
                        </div>
                        <button class="buy-btn" 
                                ${isLocked ? 'disabled' : ''} 
                                onclick="buyGift(${g.id})">
                            ${isLocked ? 'Yopiq' : 'Sotib olish'}
                        </button>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

async function buyGift(giftId) {
    console.log("buyGift called with ID:", giftId);
    const gift = APP_DATA.gifts.find(g => g.id === giftId);
    if (!gift) {
        console.error("Gift not found with ID:", giftId);
        return;
    }

    if (APP_DATA.user.score >= gift.points) {
        const confirmed = await showCustomConfirm("Tasdiqlash", `${gift.name}ni ${gift.points} ballga almashtirmoqchimisiz?`);
        console.log("Confirmation result:", confirmed);
        if (confirmed) {
            try {
                // Deduct points on backend
                await fetch(`${API_BASE}/user/score`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: APP_DATA.user.username, scoreDelta: -gift.points })
                });

                // Send notification to admin (system-wide)
                const notif = {
                    id: Date.now(),
                    text: `🎁 SOVG'A ALMASHILDI: ${APP_DATA.user.name} o'quvchisi o'zining ${gift.points} ballini "${gift.name}" sovg'asiga almashtirdi.`,
                    time: getCurrentTime(),
                    read: false,
                    role: 'admin'
                };

                await fetch(`${API_BASE}/notifications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(notif)
                });

                await fetchData();
                showCustomAlert("Tabriklaymiz! 🎉\nSovg'a muvaffaqiyatli xarid qilindi. Uni olish uchun maktab mas'ullariga murojaat qiling.");
                renderSection();
            } catch (error) {
                console.error("Sovg'a almashtirishda xato:", error);
                showCustomAlert("Xatolik yuz berdi!");
            }
        }
    } else {
        showCustomAlert("Ballaringiz yetarli emas!");
    }
}

function renderRanking(container) {
    const top3 = APP_DATA.ranking.slice(0, 3);
    const others = APP_DATA.ranking.slice(3);

    const rankThemes = [
        { color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)', border: 'rgba(255, 215, 0, 0.3)', icon: 'fa-crown' },
        { color: '#C0C0C0', bg: 'rgba(192, 192, 192, 0.15)', border: 'rgba(192, 192, 192, 0.3)', icon: 'fa-medal' },
        { color: '#CD7F32', bg: 'rgba(205, 127, 50, 0.15)', border: 'rgba(205, 127, 50, 0.3)', icon: 'fa-award' }
    ];

    container.innerHTML = `
        <div class="section-title">
            <span>Reyting (Top o'quvchilar)</span>
        </div>
        
        <!-- Premium Horizontal Cards for Top 3 -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px;">
            ${top3.map((r, i) => {
        const theme = rankThemes[i];
        return `
                <div class="glass-card" style="display: flex; align-items: center; gap: 20px; padding: 20px; background: ${theme.bg}; border: 1px solid ${theme.border}; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: -10px; right: -10px; font-size: 5rem; color: rgba(255,255,255,0.03); font-weight: 900; z-index: 0;">${i + 1}</div>
                    <div style="position: relative; z-index: 1;">
                        <div style="width: 70px; height: 70px; border-radius: 20px; border: 3px solid ${theme.color}; padding: 3px; background: rgba(0,0,0,0.2);">
                            <img src="${r.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=${theme.color.replace('#', '')}&color=fff`}" style="width: 100%; height: 100%; border-radius: 15px; object-fit: cover;">
                        </div>
                        <i class="fa-solid ${theme.icon}" style="position: absolute; top: -10px; left: -10px; color: ${theme.color}; font-size: 1.2rem; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));"></i>
                    </div>
                    <div style="flex: 1; z-index: 1;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: white;">${r.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${i + 1}-o'rin sohibi</div>
                    </div>
                    <div style="text-align: right; z-index: 1;">
                        <div style="font-size: 1.4rem; font-weight: 800; color: ${theme.color};">${r.score}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">ball</div>
                    </div>
                </div>
            `;
    }).join('')}
        </div>

        <!-- Others List Header -->
        ${others.length > 0 ? `
        <div class="section-title" style="margin-top: 30px; margin-bottom: 15px;">
            <span style="font-size: 0.9rem; opacity: 0.7;">Boshqa o'quvchilar</span>
        </div>
        <div class="ranking-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${others.map((r, i) => `
                <div class="glass-card" style="display: flex; align-items: center; gap: 15px; padding: 12px 15px; background: rgba(255,255,255,0.03);">
                    <div style="width: 25px; font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-align: center;">${i + 4}</div>
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random&color=fff" style="width: 38px; height: 38px; border-radius: 10px; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.9rem;">${r.name}</div>
                    </div>
                    <div style="font-weight: 700; color: var(--text-muted); font-size: 1rem;">${r.score} <span style="font-size: 0.6rem; font-weight: 400;">ball</span></div>
                </div>
            `).join('')}
        </div>
        ` : ''}
    `;
}

function renderProfile(container) {
    const isUserAdmin = isAdmin;
    const user = APP_DATA.user;

    container.innerHTML = `
        <div class="profile-header fade-in" style="padding: 40px 20px; text-align: center; background: linear-gradient(to bottom, rgba(99,102,241,0.1), transparent); border-radius: 30px; margin-bottom: 25px;">
            <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 20px;">
                <div style="width: 100%; height: 100%; border-radius: 35px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; box-shadow: 0 10px 25px rgba(99,102,241,0.4);">
                    <i class="fa-solid fa-user${isUserAdmin ? '-shield' : ''}"></i>
                </div>
                ${!isUserAdmin ? `<div style="position: absolute; bottom: -5px; right: -5px; background: #22c55e; color: white; padding: 5px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; border: 3px solid var(--bg);">ACTIVE</div>` : ''}
            </div>
            <h2 style="margin: 0; font-size: 1.6rem; font-weight: 700;">${isUserAdmin ? 'Tizim Adminstratori' : user.name}</h2>
            <p style="margin: 5px 0 0; color: var(--text-muted); font-size: 1rem;">${isUserAdmin ? 'Boshqaruvchi' : user.class + ' o\'quvchisi'}</p>
        </div>

        ${isUserAdmin ? `
            <div class="section-title">
                <span>Platforma Statistikasi</span>
            </div>
            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 30px;">
                <div class="glass-card" style="padding: 20px; text-align: center; border: 1px solid rgba(99,102,241,0.2);">
                    <i class="fa-solid fa-users" style="font-size: 1.5rem; color: #6366f1; margin-bottom: 10px; display: block;"></i>
                    <div style="font-size: 1.4rem; font-weight: 800;">${APP_DATA.users ? APP_DATA.users.length : 0}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">A'zolar</div>
                </div>
                <div class="glass-card" style="padding: 20px; text-align: center; border: 1px solid rgba(249,115,22,0.2);">
                    <i class="fa-solid fa-newspaper" style="font-size: 1.5rem; color: #f97316; margin-bottom: 10px; display: block;"></i>
                    <div style="font-size: 1.4rem; font-weight: 800;">${APP_DATA.news.length}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Yangiliklar</div>
                </div>
                <div class="glass-card" style="padding: 20px; text-align: center; border: 1px solid rgba(34,197,94,0.2);">
                    <i class="fa-solid fa-eye" style="font-size: 1.5rem; color: #22c55e; margin-bottom: 10px; display: block;"></i>
                    <div style="font-size: 1.4rem; font-weight: 800;">${APP_DATA.visitors || 0}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Ko'rildi</div>
                </div>
                <div class="glass-card" style="padding: 20px; text-align: center; border: 1px solid rgba(236,72,153,0.2);">
                    <i class="fa-solid fa-gift" style="font-size: 1.5rem; color: #ec4899; margin-bottom: 10px; display: block;"></i>
                    <div style="font-size: 1.4rem; font-weight: 800;">${APP_DATA.gifts.length}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Sovg'alar</div>
                </div>
            </div>

            <div class="section-title">
                <span>Barcha A'zolar</span>
            </div>
            <div class="members-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto;">
                ${APP_DATA.users ? APP_DATA.users.map(u => `
                    <div class="glass-card" style="padding: 15px; background: rgba(255,255,255,0.03);">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&color=fff" style="width: 45px; height: 45px; border-radius: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 1rem;">${u.name}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${u.class}</div>
                                <div style="font-size: 0.75rem; color: #fbbf24; font-family: monospace;">Login: ${u.user} • Parol: ${u.pass}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 700; color: #22c55e;">${u.score || 0} ball</div>
                                <div style="font-size: 0.7rem; color: var(--text-muted);">${u.testsTaken || 0} ta test</div>
                            </div>
                            ${u.user !== 'admin' ? `
                                <button onclick="deleteUser('${u.user}')" style="background: rgba(239,68,68,0.1); color:#ef4444; border:none; padding:10px; border-radius:12px; cursor:pointer; margin-left: 5px;">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('') : '<p>Azolar yuklanmoqda...</p>'}
            </div>
        ` : `
            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <div class="glass-card" style="padding: 25px; text-align: center; border: 1px solid rgba(255,75,43,0.2); background: linear-gradient(135deg, rgba(255,75,43,0.1) 0%, transparent 100%);">
                    <i class="fa-solid fa-coins" style="font-size: 1.8rem; color: #ffb800; margin-bottom: 12px; display: block;"></i>
                    <div style="font-size: 1.8rem; font-weight: 800; color: white;">${user.score}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Sizning balingiz</div>
                </div>
                <div class="glass-card" style="padding: 25px; text-align: center; border: 1px solid rgba(99,102,241,0.2); background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, transparent 100%);">
                    <i class="fa-solid fa-graduation-cap" style="font-size: 1.8rem; color: #6366f1; margin-bottom: 12px; display: block;"></i>
                    <div style="font-size: 1.8rem; font-weight: 800; color: white;">${user.testsTaken}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Yechilgan testlar</div>
                </div>
            </div>

            <div class="glass-card" style="display: flex; align-items: center; gap: 20px; padding: 25px; background: linear-gradient(135deg, rgba(34,197,94,0.1) 0%, transparent 100%); border: 1px solid rgba(34,197,94,0.2);">
                <div style="width: 60px; height: 60px; border-radius: 20px; background: #22c55e; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.8rem; box-shadow: 0 8px 20px rgba(34,197,94,0.3);">
                    <i class="fa-solid fa-trophy"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;">Reytingdagi o'rningiz</h3>
                    <p style="margin: 4px 0 0; font-size: 0.9rem; color: var(--text-muted);">Siz hozirda <span style="color: #22c55e; font-weight: 700;">#${APP_DATA.ranking.findIndex(r => r.name === user.name) + 1 || '-'}</span> -o'rindasiz</p>
                </div>
            </div>
        `}

        <div style="margin-top: 40px; display: flex; flex-direction: column; gap: 15px;">
            <button class="logout-btn" onclick="handleLogout()" style="width: 100%; padding: 18px; border-radius: 20px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; font-weight: 700; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s;">
                <i class="fa-solid fa-right-from-bracket"></i> Tizimdan chiqish
            </button>
            <p style="text-align: center; font-size: 0.8rem; color: var(--text-muted);">Versiya 2.4.0 • 24-Maktab Platformasi</p>
        </div>
    `;
}

// Initial Load
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            // Show Login Screen instead of main content
            document.getElementById('login-screen').classList.remove('hidden');
        }, 500);
    }, 1500);
});
// Session Persistence
// Theme Logic
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    const currentTheme = body.getAttribute('data-theme');

    if (currentTheme === 'light') {
        body.removeAttribute('data-theme');
        icon.className = 'fa-solid fa-moon';
        localStorage.setItem('theme', 'dark');
    } else {
        body.setAttribute('data-theme', 'light');
        icon.className = 'fa-solid fa-sun';
        localStorage.setItem('theme', 'light');
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const icon = document.getElementById('theme-icon');
    if (savedTheme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        if (icon) icon.className = 'fa-solid fa-sun';
    }
}

window.onload = async () => {
    initTheme();

    // Increment visitor count only once per browser session
    if (!sessionStorage.getItem('site_visited')) {
        fetch(`${API_BASE}/visitor`, { method: 'POST' });
        sessionStorage.setItem('site_visited', 'true');
    }

    const session = localStorage.getItem('userSession');
    if (session) {
        const user = JSON.parse(session);
        isAdmin = user.role === 'admin';
        isTeacher = user.role === 'teacher';

        // Refresh user data from server on load
        await fetchData();

        APP_DATA.user = {
            name: user.name,
            class: user.class,
            score: user.score || 0,
            testsTaken: user.testsTaken || 0,
            username: user.user,
            role: user.role,
            completedTests: user.completedTests || {}
        };

        document.getElementById('login-screen').classList.add('hidden');
        document.querySelectorAll('.top-navbar, #bottom-navbar').forEach(el => {
            el.classList.remove('hidden');
        });

        initSocketListeners();
        initPullToRefresh();
        renderBottomNav();

        if (isAdmin) currentSection = 'admin';
        else currentSection = 'home';

        renderSection();

        // Auto-refresh data every 2 seconds in background
        setInterval(async () => {
            await fetchData();
            updateHeaderScore();
            // renderSection() removed to stop UI flickering as requested
        }, 2000);
    }
};

async function addNewUser() {
    const name = document.getElementById('new-user-fullname').value;
    const login = document.getElementById('new-user-login').value;
    const pass = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;

    let className = "";
    let teacherSubject = "";

    if (role === 'student') {
        const grade = document.getElementById('new-user-grade').value;
        const letter = document.getElementById('new-user-letter').value;
        if (!grade) {
            showCustomAlert("Sinf raqamini kiriting!");
            return;
        }
        className = `${grade}-${letter}`;
    } else {
        const subjectId = document.getElementById('new-user-subject').value;
        const subject = APP_DATA.subjects.find(s => s.id === subjectId);
        className = subject ? `${subject.name} o'qituvchisi` : "O'qituvchi";
        teacherSubject = subjectId;
    }

    if (name && login && pass) {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                class: className,
                user: login,
                pass,
                role,
                subject: teacherSubject
            })
        });

        if (response.ok) {
            await fetchData();
            showCustomAlert("Foydalanuvchi muvaffaqiyatli yaratildi!");
            renderAdmin(document.getElementById('app-content'));
        } else {
            const data = await response.json();
            showCustomAlert(data.message || "Xatolik yuz berdi!");
        }
    } else {
        showCustomAlert("Barcha maydonlarni to'ldiring!");
    }
}

function toggleUserRoleFields(role) {
    const studentFields = document.getElementById('student-class-fields');
    const teacherFields = document.getElementById('teacher-subject-fields');

    if (role === 'student') {
        studentFields.classList.remove('hidden');
        teacherFields.classList.add('hidden');
    } else {
        studentFields.classList.add('hidden');
        teacherFields.classList.remove('hidden');
    }
}

async function deleteUser(username) {
    const quit = await showCustomConfirm("O'chirish", `${username} foydalanuvchisini o'chirib tashlamoqchimisiz?`);
    if (quit) {
        const response = await fetch(`${API_BASE}/users/${username}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await fetchData();
            showCustomAlert("Foydalanuvchi o'chirildi!");
            renderSection();
        } else {
            const data = await response.json();
            showCustomAlert(data.message || "Xatolik!");
        }
    }
}

let analyticsChart = null;

function renderAnalyticsView(selectedGrade = null) {
    const container = document.getElementById('app-content');

    if (selectedGrade === null) {
        // --- OVERALL ANALYTICS (All Grades) ---
        const classStats = {};
        let totalStudents = 0;

        if (APP_DATA.users) {
            APP_DATA.users.forEach(u => {
                if (u.role === 'student' && u.class) {
                    totalStudents++;
                    const className = u.class; // Group by exact class (e.g., "11-A", "11-B")
                    if (!classStats[className]) {
                        classStats[className] = { totalScore: 0, count: 0 };
                    }
                    classStats[className].totalScore += (u.score || 0);
                    classStats[className].count += 1;
                }
            });
        }

        const labels = [];
        const averages = [];
        const classNames = Object.keys(classStats).sort();

        classNames.forEach(cn => {
            labels.push(cn);
            averages.push(classStats[cn].count > 0 ? Math.round(classStats[cn].totalScore / classStats[cn].count) : 0);
        });

        let gradeButtonsHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">`;
        classNames.forEach(cn => {
            gradeButtonsHTML += `
                <div class="glass-card" style="padding: 15px; text-align: center; cursor: pointer; border: 1px solid var(--primary-glow); background: rgba(99,102,241,0.05);" onclick="renderAnalyticsView('${cn}')">
                    <span style="font-size: 1rem; font-weight: 600;">${cn}</span>
                </div>
            `;
        });
        gradeButtonsHTML += `</div>`;

        let backAction = "navigateTo('home')";
        if (isAdmin) backAction = "renderAdmin(document.getElementById('app-content'))";
        else if (isTeacher) backAction = "renderTeacher(document.getElementById('app-content'))";

        container.innerHTML = `
            <div class="section-title">
                <button class="back-btn-premium" onclick="${backAction}">
                    <i class="fa-solid fa-chevron-left"></i> Orqaga
                </button>
            </div>

            <div class="glass-card fade-in" style="padding: 20px; text-align: center; margin-bottom: 20px;">
                <h3 style="margin-bottom: 5px;">Umumiy Analitika</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Jami o'quvchilar: ${totalStudents} ta</p>
            </div>

            <div class="glass-card fade-in" style="padding: 20px; margin-bottom: 20px; position: relative; height: 300px; background: rgba(0,0,0,0.2);">
                <canvas id="analyticsChart"></canvas>
            </div>

            <h3 style="margin-bottom: 15px; text-align: center; font-size: 1.1rem;">Sinflar bo'yicha batafsil ko'rish:</h3>
            ${gradeButtonsHTML}
        `;

        renderChart(labels, averages, "Sinfning o'rtacha bali", '#6366f1');
    } else {
        // --- SPECIFIC GRADE ANALYTICS (e.g. 11-A vs 11-B) ---
        const subClassStats = {};
        let gradeStudentsCount = 0;

        if (APP_DATA.users) {
            APP_DATA.users.forEach(u => {
                if (u.role === 'student' && u.class && u.class.startsWith(selectedGrade)) {
                    gradeStudentsCount++;
                    const exactClass = u.class; // e.g. "11-A sinf"
                    if (!subClassStats[exactClass]) {
                        subClassStats[exactClass] = { totalScore: 0, count: 0 };
                    }
                    subClassStats[exactClass].totalScore += (u.score || 0);
                    subClassStats[exactClass].count += 1;
                }
            });
        }

        const labels = [];
        const averages = [];
        const subClasses = Object.keys(subClassStats).sort();

        subClasses.forEach(sc => {
            labels.push(sc);
            averages.push(subClassStats[sc].count > 0 ? Math.round(subClassStats[sc].totalScore / subClassStats[sc].count) : 0);
        });

        container.innerHTML = `
            <div class="section-title">
                <button class="back-btn-premium" onclick="renderAnalyticsView(null)">
                    <i class="fa-solid fa-chevron-left"></i> Orqaga
                </button>
            </div>

            <div class="glass-card fade-in" style="padding: 20px; text-align: center; margin-bottom: 20px; border: 1px solid var(--secondary);">
                <h3 style="margin-bottom: 5px;">${selectedGrade}-sinflar Raqobati</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Shu sinfdagi o'quvchilar soni: ${gradeStudentsCount} ta</p>
            </div>

            <div class="glass-card fade-in" style="padding: 20px; margin-bottom: 20px; position: relative; height: 300px;">
                <canvas id="analyticsChart"></canvas>
            </div>
        `;

        renderChart(labels, averages, "Sinfning o'rtacha bali", '#22c55e');
    }
}

function renderChart(labels, averages, labelText, primaryColor = '#6366f1') {
    setTimeout(() => {
        const ctx = document.getElementById('analyticsChart');
        if (!ctx) return;

        if (analyticsChart) {
            analyticsChart.destroy();
        }

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, primaryColor + '66'); // 40% opacity
        gradient.addColorStop(1, primaryColor + '00'); // Transparent

        analyticsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: labelText,
                    data: averages,
                    backgroundColor: gradient,
                    borderColor: primaryColor,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: primaryColor,
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    datalabels: {
                        color: '#fff',
                        anchor: 'end',
                        align: 'top',
                        offset: 5,
                        font: { weight: 'bold', size: 10, family: "'Outfit', sans-serif" },
                        padding: 6,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: 6,
                        formatter: (value) => value.toFixed(1)
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: { family: "'Outfit', sans-serif", size: 14 },
                        bodyFont: { family: "'Outfit', sans-serif", size: 12 },
                        padding: 12,
                        cornerRadius: 12,
                        displayColors: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            color: 'rgba(255,255,255,0.5)',
                            font: { family: "'Outfit', sans-serif" }
                        },
                        grid: { 
                            color: 'rgba(255,255,255,0.05)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: { 
                            color: 'rgba(255,255,255,0.5)',
                            font: { family: "'Outfit', sans-serif" }
                        },
                        grid: { 
                            display: false
                        }
                    }
                }
            }
        });
    }, 100);
}

// Pull to Refresh Logic
let touchStart = 0;
let pullDistance = 0;
const refreshThreshold = 80;

function initPullToRefresh() {
    const container = document.body;
    const indicator = document.getElementById('pull-refresh');
    const app = document.getElementById('app-content');

    container.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            touchStart = e.touches[0].pageY;
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (touchStart === 0 || window.scrollY > 0) return;

        const touch = e.touches[0].pageY;
        pullDistance = (touch - touchStart) * 0.5;

        if (pullDistance > 0) {
            indicator.style.transform = `translateY(${Math.min(pullDistance, 100)}px)`;
            if (app) app.style.transform = `translateY(${Math.min(pullDistance, 100)}px)`;

            if (pullDistance > refreshThreshold) {
                indicator.classList.add('pulling');
            } else {
                indicator.classList.remove('pulling');
            }
        }
    }, { passive: true });

    container.addEventListener('touchend', async () => {
        if (pullDistance > refreshThreshold) {
            indicator.classList.remove('pulling');
            indicator.classList.add('refreshing');

            // Trigger Refresh
            await fetchData();
            renderSection();

            setTimeout(() => {
                indicator.classList.remove('refreshing');
                indicator.style.transform = 'translateY(0)';
                if (app) app.style.transform = 'translateY(0)';
            }, 500);
        } else {
            indicator.style.transform = 'translateY(0)';
            if (app) app.style.transform = 'translateY(0)';
        }

        touchStart = 0;
        pullDistance = 0;
    });
} // End initPullToRefresh