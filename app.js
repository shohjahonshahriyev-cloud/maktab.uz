// API Configuration
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3005/api' 
    : '/api';
const socket = io(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3005' : undefined);

// PWA Install Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.classList.remove('hidden');
});

async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.classList.add('hidden');
}

let notifCount = 0;
const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// iOS Audio Unlocker
let audioUnlocked = false;
function unlockAudio() {
    if (audioUnlocked) return;
    
    // Play silent sound to unlock Audio context
    notifSound.volume = 0;
    notifSound.play().then(() => {
        notifSound.pause();
        notifSound.currentTime = 0;
        notifSound.volume = 1;
    }).catch(() => {});

    // Speak empty string to unlock SpeechSynthesis context
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance("");
        msg.volume = 0;
        window.speechSynthesis.speak(msg);
    }
    
    audioUnlocked = true;
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
}
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function initPushNotifications(showFeedback = false) {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');

            // Request permission explicitly first if showFeedback is true
            if (showFeedback) {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    showCustomAlert("Bildirishnomalarga ruxsat berilmadi.");
                    return;
                }
            }

            const publicVapidKey = 'BJiXkGpzXU8RIM4Ca9AU2XqIiu2WFYGPVGUyY_Aw3yYLMCzJGPF0ZDCnO47fA1S8Uu5yBx4EUgvkVz3g889OUIg';
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });

            await fetch(`${API_BASE}/subscribe`, {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('Push Subscribed');
            if (showFeedback) {
                showCustomAlert("Bildirishnomalar muvaffaqiyatli yoqildi! Endi ilova yopiq bo'lganda ham xabarlar keladi.");
            }
        } catch (error) {
            console.error('Push notification registration failed:', error);
            if (showFeedback) {
                showCustomAlert("Bildirishnomalarni yoqishda xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
            }
        }
    } else {
        if (showFeedback) {
            showCustomAlert("Sizning brauzeringiz bu funksiyani qo'llab-quvvatlamaydi.");
        }
    }
}

function checkNotifPermission() {
    // Only prompt if permission is 'default' (not yet asked)
    if (window.Notification && Notification.permission === 'default') {
        setTimeout(() => {
            const prompt = document.getElementById('notif-prompt');
            if (prompt) prompt.classList.remove('hidden');
        }, 1500);
    }
}

function closeNotifPrompt() {
    const prompt = document.getElementById('notif-prompt');
    if (prompt) prompt.classList.add('hidden');
}

async function enableNotificationsUI() {
    closeNotifPrompt();
    unlockAudio(); // Unlock audio on this user gesture
    await initPushNotifications(true);
}

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
let MEMBER_STATE = {
    activeTab: 'teachers', // 'teachers' or 'students'
    searchQuery: ''
};

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
        APP_DATA.notifications.forEach(n => n.read = true);
        updateNotifBadge();
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
            <div class="nav-item ${currentSection === 'members' ? 'active' : ''}" onclick="navigateTo('members')" id="nav-members">
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

// // Login Logic
window.showLoginScreenV2 = () => {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('login-screen-v2').classList.remove('hidden');
};

window.showWelcomeScreen = () => {
    document.getElementById('login-screen-v2').classList.add('hidden');
    document.getElementById('welcome-screen').classList.remove('hidden');
};

window.togglePasswordV2 = () => {
    const passInput = document.getElementById('password-v2');
    const icon = document.querySelector('.toggle-pass-v2');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    } else {
        passInput.type = 'password';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    }
};

window.showForgotPassMessage = (event) => {
    if (event) event.preventDefault();
    showCustomAlert("Parolni tiklash uchun maktab maslahatchisiga uchrashing.");
};

async function handleLoginV2() {
    const userVal = document.getElementById('username-v2').value;
    const passVal = document.getElementById('password-v2').value;

    if (!userVal || !passVal) {
        showCustomAlert("Iltimos, login va parolni kiriting");
        return;
    }

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

            APP_DATA.user = {
                name: foundUser.name,
                class: foundUser.class,
                score: foundUser.score || 0,
                testsTaken: foundUser.testsTaken || 0,
                username: foundUser.user,
                role: foundUser.role,
                subject: foundUser.subject || '',
                completedTests: foundUser.completedTests || {},
                avatar: foundUser.avatar || ''
            };

            // Save to session instead of localStorage if "Remember me" is not checked?
            // Actually user said "always ask when site opens", so I won't auto-login anyway.
            if (document.getElementById('remember-me-v2').checked) {
                localStorage.setItem('userSession', JSON.stringify(foundUser));
            }

            document.getElementById('login-screen-v2').classList.add('hidden');
            document.querySelectorAll('.top-navbar, #bottom-navbar').forEach(el => {
                el.classList.remove('hidden');
            });

            await fetchData();
            initSocketListeners();
            updateHeaderScore();
            updateNotifBadge();
            renderBottomNav();
            
            if (isAdmin) currentSection = 'admin';
            else currentSection = 'home';

            renderSection();
            checkNotifPermission();
            
            // UI adjustments
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
            showCustomAlert("Login yoki parol xato!");
        }
    } catch (error) {
        console.error("Login xatosi:", error);
        showCustomAlert("Server bilan bog'lanishda xato!");
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
        updateNotifBadge();
        
        // Play notification sound
        if (notifSound) {
            notifSound.play().catch(err => console.log("Sound play blocked:", err));
        }

        // Optional: Voice (Text-to-Speech)
        if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance("Maktabdan yangi xabar keldi");
            msg.lang = 'uz-UZ'; // Attempting Uzbek, will fallback to default if not available
            window.speechSynthesis.speak(msg);
        }

        if (currentSection === 'notifications') {
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
    const badges = document.querySelectorAll('.notif-badge');
    const user = APP_DATA.user;
    if (!user) return;
    
    const currentUser = user.user || user.username;
    
    const count = APP_DATA.notifications.filter(n => {
        if (n.read) return false;
        // Count if it's an announcement OR if it's for this specific user
        return !n.to || n.to === currentUser;
    }).length;

    badges.forEach(badge => {
        if (count > 0) {
            badge.innerText = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
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
                APP_DATA.user.avatar = currentServerUser.avatar || '';
                updateHeaderScore();
            }
        }

        // Sync ranking from users list (backup)
        if (fetchedUsers && Array.isArray(fetchedUsers)) {
            APP_DATA.ranking = fetchedUsers
                .filter(u => u.role === 'student')
                .map(u => ({ name: u.name, score: u.score || 0, avatar: u.avatar || null, username: u.user }))
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
        isTeacher = false;
        
        // Clear session
        localStorage.removeItem('userSession');

        // Clear inputs
        const u1 = document.getElementById('username');
        const p1 = document.getElementById('password');
        const u2 = document.getElementById('username-v2');
        const p2 = document.getElementById('password-v2');
        if (u1) u1.value = '';
        if (p1) p1.value = '';
        if (u2) u2.value = '';
        if (p2) p2.value = '';

        // Show Welcome Screen, hide everything else
        document.getElementById('welcome-screen').classList.remove('hidden');
        document.getElementById('login-screen-v2').classList.add('hidden');
        document.querySelectorAll('.top-navbar, #bottom-navbar, .bottom-navbar').forEach(el => {
            el.classList.add('hidden');
        });

        // Reset app content
        const appContent = document.getElementById('app-content');
        if (appContent) appContent.innerHTML = '';
        
        currentSection = 'home';
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
            case 'home':
                renderHome(content);
                content.style.overflowY = 'hidden';
                content.style.maxHeight = 'calc(100vh - 140px)';
                break;
            case 'teacher':
                renderTeacher(content);
                content.style.overflowY = 'hidden';
                content.style.maxHeight = 'calc(100vh - 140px)';
                break;
            case 'test':
                renderTest(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'gift':
                renderGift(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'ranking':
                renderRanking(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'profile':
                renderProfile(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'admin':
                renderAdmin(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'messages':
                renderAdminMessages(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'notifications':
                renderNotifications(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'members':
                renderMembers(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'news-detail':
                renderNewsDetail(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'schedule':
                renderSchedule(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            case 'diary':
                renderDiary(content);
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
                break;
            default:
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'none';
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

function getTeacherAnalyticsHTML() {
    const teacherSubjectId = APP_DATA.user.subject;
    const subject = APP_DATA.subjects.find(s => s.id === teacherSubjectId);
    if (!subject) return "";

    const questionsCount = subject.questions ? subject.questions.length : 0;
    const students = APP_DATA.users.filter(u => u.role === 'student');
    const avgScore = students.length > 0 ? (students.reduce((acc, u) => acc + (u.score || 0), 0) / students.length).toFixed(1) : 0;
    
    const topStudents = [...students].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);

    return `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="glass-card" style="padding: 15px; text-align: center; border-left: 4px solid var(--primary); background: rgba(99,102,241,0.05);">
                <i class="fa-solid fa-file-circle-question" style="font-size: 1.2rem; color: var(--primary); margin-bottom: 8px; display: block;"></i>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Jami savollar</span>
                <span style="font-size: 1.2rem; font-weight: 800; color: white;">${questionsCount} ta</span>
            </div>
            <div class="glass-card" style="padding: 15px; text-align: center; border-left: 4px solid #22c55e; background: rgba(34,197,94,0.05);">
                <i class="fa-solid fa-chart-line" style="font-size: 1.2rem; color: #22c55e; margin-bottom: 8px; display: block;"></i>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">O'rtacha ball</span>
                <span style="font-size: 1.2rem; font-weight: 800; color: white;">${avgScore}</span>
            </div>
        </div>

        <div class="glass-card" style="padding: 15px; margin-bottom: 20px;">
            <h3 style="font-size: 0.95rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-trophy" style="color: #ffd700;"></i> Eng faol o'quvchilar
            </h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${topStudents.length > 0 ? topStudents.map((u, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="width: 24px; height: 24px; background: ${idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.1)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; color: ${idx < 3 ? '#000' : '#fff'}">${idx + 1}</span>
                            <span style="font-size: 0.85rem; font-weight: 500;">${u.name}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="display: block; font-weight: 800; color: var(--primary); font-size: 0.9rem;">${u.score || 0}</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted);">${u.class}</span>
                        </div>
                    </div>
                `).join('') : '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem;">Ma\'lumotlar mavjud emas</p>'}
            </div>
        </div>
        
        <button class="buy-btn" onclick="renderAnalyticsView()" style="width: 100%; font-size: 0.85rem; padding: 12px; border-radius: 12px; background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);">
            <i class="fa-solid fa-chart-pie"></i> Batafsil grafiklar
        </button>
    `;
}

function renderTeacher(container) {
    const teacherSubjectId = APP_DATA.user.subject;
    const subject = APP_DATA.subjects.find(s => s.id === teacherSubjectId);
    
    if (!subject) {
        container.innerHTML = `<div class="glass-card" style="padding:20px; text-align:center;">
            <p>Sizga fan biriktirilmagan. Iltimos admin bilan bog'laning.</p>
            <button class="buy-btn" onclick="renderSection()">Qayta yuklash</button>
        </div>`;
        return;
    }

    const classes = [...new Set(APP_DATA.users
        .filter(u => u.role === 'student' && u.class)
        .map(u => u.class)
    )].sort();

    const teacherQuestions = (subject.questions || []).filter(q => q.author === APP_DATA.user.username || q.author === APP_DATA.user.user);

    container.innerHTML = `
        <div id="teacher-view-container" class="fade-in" style="display: flex; flex-direction: column; gap: 15px;">
            <!-- Header Greeting -->
            <div class="glass-card" style="padding: 15px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h2 style="font-size: 1.1rem; margin: 0;">Salom, ${APP_DATA.user.name.split(' ')[0]}! 👋</h2>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">${subject.name} fani o'qituvchisi</p>
                </div>
                <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                    <i class="fa-solid ${subject.icon}"></i>
                </div>
            </div>

            <!-- Main Tabs -->
            <div style="display: flex; gap: 10px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 12px;">
                <button id="main-tab-test" onclick="switchMainTeacherTab('test')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: var(--primary); color: white; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.3s;">
                    <i class="fa-solid fa-list-check"></i> Testlar
                </button>
                <button id="main-tab-classes" onclick="switchMainTeacherTab('classes')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: transparent; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.3s;">
                    <i class="fa-solid fa-users"></i> Sinflar
                </button>
                <button id="main-tab-analytics" onclick="switchMainTeacherTab('analytics')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: transparent; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.3s;">
                    <i class="fa-solid fa-chart-line"></i> Analitika
                </button>
            </div>

            <!-- Content Area -->
            <div id="teacher-main-content">
                <!-- Test Section (Default) -->
                <div id="section-test" class="fade-in">
                    <div class="glass-card custom-scrollbar" style="padding: 15px; max-height: 65vh; overflow-y: auto;">
                        <div style="display: flex; gap: 8px; margin-bottom: 15px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 10px;">
                            <button id="t-subtab-add" onclick="switchTestSubTab('add')" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: var(--primary); color: white; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Qo'shish</button>
                            <button id="t-subtab-list" onclick="switchTestSubTab('list')" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: transparent; color: var(--text-muted); font-size: 0.75rem; font-weight: 600; cursor: pointer;">Mening testlarim</button>
                        </div>

                        <div id="t-form-area">
                            <div style="display: grid; gap: 12px;">
                                <select id="t-q-class" style="width:100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 10px; border-radius: 10px; font-size: 0.85rem;">
                                    <option value="" style="background:#1a1a2e;">Sinfni tanlang...</option>
                                    <option value="all" style="background:#1a1a2e;">Barcha sinflar</option>
                                    ${classes.map(cls => `<option value="${cls}" style="background:#1a1a2e;">${cls}-sinf</option>`).join('')}
                                </select>
                                <textarea id="t-q-text" placeholder="Savol matni..." style="width:100%; height:80px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 10px; border-radius: 10px; font-size: 0.85rem; resize: none;"></textarea>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    ${[1, 2, 3, 4].map(num => `<input type="text" id="t-q-opt${num}" placeholder="${String.fromCharCode(64+num)}-variant" style="width:100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 8px; border-radius: 8px; font-size: 0.8rem;">`).join('')}
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                                    ${[0, 1, 2, 3].map(val => `<button onclick="selectCorrectVariant(${val})" id="variant-btn-${val}" class="variant-select-btn ${val === 0 ? 'active' : ''}" style="padding: 8px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.05); color: white; cursor: pointer; font-weight: 700;">${String.fromCharCode(65 + val)}</button>`).join('')}
                                    <input type="hidden" id="t-q-correct" value="0">
                                </div>
                                <button class="buy-btn" onclick="addNewQuestionByTeacher('${teacherSubjectId}')" style="width: 100%; padding: 12px; border-radius: 12px; font-weight: 700;">Saqlash</button>
                            </div>
                        </div>

                        <div id="t-list-area" class="hidden">
                             <div style="display: grid; gap: 10px;">
                                ${teacherQuestions.length > 0 ? teacherQuestions.map((q, idx) => `
                                    <div class="glass-card" style="padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); position: relative; border-radius: 12px;">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                            <span style="background: var(--primary); color: white; font-size: 0.6rem; padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                                                ${q.targetClass === 'all' ? 'Hamma' : q.targetClass}
                                            </span>
                                            <button onclick="deleteTeacherQuestion('${teacherSubjectId}', ${subject.questions.indexOf(q)})" style="border: none; background: none; color: #ef4444; cursor: pointer;"><i class="fa-solid fa-trash-can" style="font-size: 0.75rem;"></i></button>
                                        </div>
                                        <p style="font-size: 0.8rem; margin: 0 0 5px 0;">${q.q}</p>
                                    </div>
                                `).join('') : '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:20px;">Hozircha testlar yo\'q.</p>'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Classes Section (Hidden) -->
                <div id="section-classes" class="fade-in hidden">
                    <div class="glass-card" style="padding: 15px;">
                        <h3 style="margin-bottom: 12px; font-size: 0.95rem; text-align: center;">O'quvchilar ro'yxati</h3>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
                            ${classes.map(cls => `
                                <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid var(--primary); cursor: pointer; background: rgba(var(--primary-rgb), 0.1); margin-bottom: 0;" onclick="renderTeacherView('class-students', '${cls}')">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 35px; height: 35px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; color: white;">${cls.split('-')[0]}</div>
                                        <span style="font-size: 0.9rem; font-weight: 600;">${cls}-sinf</span>
                                    </div>
                                    <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem;"></i>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Analytics Section (Hidden) -->
                <div id="section-analytics" class="fade-in hidden">
                    ${getTeacherAnalyticsHTML()}
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
        const classes = [...new Set(APP_DATA.users
            .filter(u => u.role === 'student' && u.class)
            .map(u => u.class)
        )].sort();

        container.innerHTML = `
            <div class="glass-card fade-in" style="padding: 20px;">
                <h3 style="margin-bottom: 15px; font-size: 1.1rem; text-align: center;">Sinflarni tanlang</h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                    ${classes.length > 0 ? classes.map(cls => `
                        <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 1px solid var(--primary-glow); cursor: pointer; background: rgba(var(--primary-rgb), 0.1);" onclick="renderTeacherView('class-students', '${cls}')">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="width: 50px; height: 50px; background: var(--primary-glow); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800;">${cls.split('-')[0]}</div>
                                <span style="font-size: 1.1rem; font-weight: 600;">${cls}-sinf</span>
                            </div>
                            <i class="fa-solid fa-chevron-right"></i>
                        </div>
                    `).join('') : '<p style="text-align:center; padding:20px; color:var(--text-muted);">Sinflar topilmadi</p>'}
                </div>
            </div>
        `;
    } else if (view === 'test-manager') {
        const teacherSubjectId = APP_DATA.user.subject;
        const subject = APP_DATA.subjects.find(s => s.id === teacherSubjectId);
        const classes = [...new Set(APP_DATA.users
            .filter(u => u.role === 'student' && u.class)
            .map(u => u.class)
        )].sort();

        if (!subject) {
            container.innerHTML = `<div class="glass-card" style="padding:20px; text-align:center;">
                <p>Sizga fan biriktirilmagan. Iltimos admin bilan bog'laning.</p>
                <button class="buy-btn" onclick="renderSection()">Orqaga</button>
            </div>`;
            return;
        }

        const teacherQuestions = (subject.questions || []).filter(q => q.author === APP_DATA.user.username || q.author === APP_DATA.user.user);

        container.innerHTML = `
            <div class="glass-card fade-in custom-scrollbar" style="padding: 20px; max-height: 85vh; overflow-y: auto;">
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div onclick="renderSection()" style="width: 35px; height: 35px; border-radius: 10px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <i class="fa-solid fa-arrow-left" style="font-size: 0.9rem;"></i>
                        </div>
                        <div>
                            <h3 style="font-size: 1.1rem; margin: 0;">Test Boshqaruvi</h3>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">${subject.name} fani</p>
                        </div>
                    </div>
                    <div style="width: 45px; height: 45px; border-radius: 12px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; box-shadow: var(--primary-glow);">
                        <i class="fa-solid ${subject.icon}"></i>
                    </div>
                </div>

                <!-- Tabs -->
                <div style="display: flex; gap: 10px; margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 12px;">
                    <button id="tab-add" onclick="switchTestTab('add')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: var(--primary); color: white; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.3s;">
                        <i class="fa-solid fa-plus-circle"></i> Yangi qo'shish
                    </button>
                    <button id="tab-list" onclick="switchTestTab('list')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: transparent; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.3s;">
                        <i class="fa-solid fa-list"></i> Mening testlarim
                    </button>
                </div>

                <!-- Add Form -->
                <div id="test-form-section" class="fade-in">
                    <div style="display: grid; gap: 15px;">
                        <div class="input-group-v2">
                            <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px; display: block;">Maqsadli sinf</label>
                            <select id="t-q-class" style="width:100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 12px; border-radius: 12px; font-size: 0.9rem;">
                                <option value="" style="background:#1a1a2e;">Sinfni tanlang...</option>
                                <option value="all" style="background:#1a1a2e;">Barcha sinflar</option>
                                ${classes.map(cls => `<option value="${cls}" style="background:#1a1a2e;">${cls}-sinf</option>`).join('')}
                            </select>
                        </div>

                        <div class="input-group-v2">
                            <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px; display: block;">Savol matni</label>
                            <textarea id="t-q-text" placeholder="Savol matnini kiriting..." style="width:100%; height:100px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 12px; border-radius: 12px; font-size: 0.9rem; resize: none;"></textarea>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            ${[1, 2, 3, 4].map(num => `
                                <div class="input-group-v2">
                                    <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px; display: block;">${String.fromCharCode(64 + num)}-variant</label>
                                    <input type="text" id="t-q-opt${num}" placeholder="..." style="width:100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 10px; border-radius: 10px; font-size: 0.85rem;">
                                </div>
                            `).join('')}
                        </div>

                        <div class="input-group-v2">
                            <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px; display: block;">To'g'ri javob</label>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                                ${[0, 1, 2, 3].map(val => `
                                    <button onclick="selectCorrectVariant(${val})" id="variant-btn-${val}" class="variant-select-btn ${val === 0 ? 'active' : ''}" style="padding: 10px; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.05); color: white; cursor: pointer; font-weight: 700; transition: 0.3s;">
                                        ${String.fromCharCode(65 + val)}
                                    </button>
                                `).join('')}
                                <input type="hidden" id="t-q-correct" value="0">
                            </div>
                        </div>

                        <button class="buy-btn" onclick="addNewQuestionByTeacher('${teacherSubjectId}')" style="width: 100%; padding: 15px; border-radius: 15px; font-weight: 700; margin-top: 10px; font-size: 1rem; box-shadow: var(--primary-glow);">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Testni Saqlash
                        </button>
                    </div>
                </div>

                <!-- List Section -->
                <div id="test-list-section" class="fade-in hidden">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">Mavjud savollar: ${teacherQuestions.length} ta</h4>
                    </div>
                    <div style="display: grid; gap: 12px;">
                        ${teacherQuestions.length > 0 ? teacherQuestions.map((q, idx) => `
                            <div class="glass-card" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); position: relative; border-radius: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                    <span style="background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 8px; border-radius: 6px; font-weight: 700;">
                                        ${q.targetClass === 'all' ? 'Barcha sinflar' : q.targetClass + '-sinf'}
                                    </span>
                                    <button onclick="deleteTeacherQuestion('${teacherSubjectId}', ${subject.questions.indexOf(q)})" 
                                            style="width: 30px; height: 30px; border-radius: 8px; border: none; background: rgba(239, 68, 68, 0.1); color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s;">
                                        <i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i>
                                    </button>
                                </div>
                                <p style="font-size: 0.9rem; font-weight: 500; margin: 0 0 10px 0; line-height: 1.4;">${q.q}</p>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    ${q.options.map((opt, i) => `
                                        <div style="font-size: 0.75rem; padding: 6px 10px; border-radius: 8px; background: ${i === q.correct ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${i === q.correct ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.05)'}; color: ${i === q.correct ? '#22c55e' : 'var(--text-muted)'};">
                                            <span style="font-weight: 700; margin-right: 5px;">${String.fromCharCode(65 + i)}:</span> ${opt}
                                            ${i === q.correct ? '<i class="fa-solid fa-check" style="float: right; margin-top: 2px;"></i>' : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('') : `
                            <div style="text-align: center; padding: 50px 20px;">
                                <i class="fa-solid fa-clipboard-question" style="font-size: 3rem; color: var(--text-muted); opacity: 0.2; margin-bottom: 15px;"></i>
                                <p style="color: var(--text-muted); font-size: 0.9rem;">Hozircha hech qanday test qo'shmagansiz.</p>
                            </div>
                        `}
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

        // Exact filtering for specific classes (e.g., '11-A')
        const classStudents = allUsers.filter(u => {
            const isStudent = u.role && u.role.toString().toLowerCase() === 'student';
            const isExactClass = u.class && u.class.toString() === param;
            return isStudent && isExactClass;
        });

        console.log(`Filtered students for class ${param}:`, classStudents.length);

        container.innerHTML = `
            <div class="glass-card fade-in" style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-arrow-left" style="cursor: pointer;" onclick="renderSection()"></i>
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
                            <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 12px;">
                                <div style="margin-bottom: 8px;">
                                    <select id="subj-${s.user}" style="width:100%; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: white; padding: 8px; border-radius: 8px; font-size: 0.8rem;">
                                        <option value="" style="background:#1a1a2e;">Fan tanlang...</option>
                                        ${(APP_DATA.subjects||[]).map(sub => `<option value="${sub.id}" style="background:#1a1a2e;">${sub.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 0.8rem; color: var(--text-muted); flex-shrink: 0;">Ball:</span>
                                    <input type="number" id="pts-${s.user}" min="1" max="5" value="5" 
                                        style="width: 50px; background: transparent; border: 1px solid var(--glass-border); color: white; padding: 5px; border-radius: 8px; text-align: center;">
                                    <button class="buy-btn" style="padding: 8px 15px; font-size: 0.8rem; flex-grow: 1;" onclick="addPointsToStudent('${s.user}')">
                                        <i class="fa-solid fa-plus"></i> Qo'shish
                                    </button>
                                </div>
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
    const subjectSelect = document.getElementById(`subj-${studentUsername}`);
    const points = parseInt(pointsInput.value);
    const subjectId = subjectSelect ? subjectSelect.value : '';

    if (!subjectId) {
        showCustomAlert("Iltimos, fanni tanlang!");
        return;
    }

    if (isNaN(points) || points < 1 || points > 5) {
        showCustomAlert("Maksimal 5 ball qo'shish mumkin!");
        return;
    }

    const subjName = subjectSelect.options[subjectSelect.selectedIndex].text;
    const confirm = await showCustomConfirm("Ball qo'shish", `${studentUsername}ga ${subjName} fanidan ${points} ball qo'shmoqchimisiz?`);
    if (!confirm) return;

    try {
        const teacherU = APP_DATA.user.username || APP_DATA.user.user;
        const response = await fetch(`${API_BASE}/teacher/add-points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacherUsername: teacherU,
                studentUsername: studentUsername,
                points: points,
                subjectId: subjectId
            })
        });

        if (response.ok) {
            await fetchData();
            showCustomAlert("Ball muvaffaqiyatli qo'shildi!");
            // Use full class name to maintain the correct view (e.g., "11-A" instead of just "11")
            const student = APP_DATA.users.find(u => (u.username || u.user) === studentUsername);
            const className = student ? student.class : '';
            renderTeacherView('class-students', className);
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
                <button onclick="navigateTo('members')" style="background: none; border: none; color: var(--primary); font-size: 0.8rem; cursor: pointer;">Hammasini ko'rish <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>

        <!-- Danger Zone -->
        <div class="section-title" style="margin-top: 30px;">
            <span style="color: #ef4444;">⚠️ Xavfli zona</span>
        </div>
        <div class="glass-card" style="border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.05); padding: 20px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 50px; height: 50px; border-radius: 15px; background: rgba(239,68,68,0.2); display: flex; align-items: center; justify-content: center; color: #ef4444; font-size: 1.4rem; flex-shrink: 0;">
                    <i class="fa-solid fa-user-slash"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px;">Barcha o'quvchilarni o'chirish</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Faqat admin va o'qituvchilar qoladi. Bu amalni bekor qilib bo'lmaydi!</div>
                </div>
                <button onclick="clearAllStudents()" style="background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #ef4444; padding: 10px 16px; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 0.8rem; flex-shrink: 0;">
                    O'chirish
                </button>
            </div>
        </div>
    `;
}

async function clearAllStudents() {
    const confirmed = await showCustomConfirm(
        "⚠️ Barcha o'quvchilarni o'chirish",
        "Haqiqatan ham barcha test o'quvchilarni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi!"
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_BASE}/admin/clear-students`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            await fetchData();
            renderAdmin(document.getElementById('app-content'));
            showCustomAlert(`✅ ${data.removed} ta o'quvchi o'chirildi!`);
        } else {
            showCustomAlert("Xatolik yuz berdi.");
        }
    } catch (err) {
        showCustomAlert("Server bilan bog'lanishda xato.");
    }
}

function renderMembers(container) {
    const teachers = APP_DATA.users.filter(u => u.role === 'teacher');
    const students = APP_DATA.users.filter(u => u.role === 'student');

    container.innerHTML = `
        <div class="notif-premium-container fade-in">
            <div class="profile-top-bar" style="margin-bottom: 25px;">
                <i class="fa-solid fa-chevron-left" style="font-size: 1.2rem; cursor: pointer;" onclick="navigateTo('admin')"></i>
                <span class="profile-title-new" style="font-size: 1.1rem;">A'zolar boshqaruvi</span>
                <div style="width: 24px;"></div>
            </div>

            <div class="premium-tabs" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div class="tab-item ${MEMBER_STATE.activeTab === 'teachers' ? 'active' : ''}" onclick="switchMemberTab('teachers')" 
                    style="padding: 12px; text-align: center; border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.3s; ${MEMBER_STATE.activeTab === 'teachers' ? 'background: var(--primary); color: white;' : 'background: rgba(255,255,255,0.05); color: var(--text-muted);'}">
                    <i class="fa-solid fa-chalkboard-user"></i> O'qituvchilar (${teachers.length})
                </div>
                <div class="tab-item ${MEMBER_STATE.activeTab === 'students' ? 'active' : ''}" onclick="switchMemberTab('students')"
                    style="padding: 12px; text-align: center; border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.3s; ${MEMBER_STATE.activeTab === 'students' ? 'background: var(--primary); color: white;' : 'background: rgba(255,255,255,0.05); color: var(--text-muted);'}">
                    <i class="fa-solid fa-user-graduate"></i> O'quvchilar (${students.length})
                </div>
            </div>

            <div class="notif-search-box" style="margin-bottom: 20px;">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" placeholder="Ism yoki login bo'yicha qidirish..." value="${MEMBER_STATE.searchQuery}" oninput="filterMembers(this.value)">
            </div>

            <div id="members-list-container" class="fade-in">
                ${renderMembersList(APP_DATA.users)}
            </div>
        </div>
    `;
}

window.switchMemberTab = (tab) => {
    MEMBER_STATE.activeTab = tab;
    renderSection();
};

function renderMembersList(usersList) {
    const q = MEMBER_STATE.searchQuery.toLowerCase();
    
    let filtered = usersList.filter(u => 
        (u.name.toLowerCase().includes(q) || u.user.toLowerCase().includes(q))
    );

    if (MEMBER_STATE.activeTab === 'teachers') {
        filtered = filtered.filter(u => u.role === 'teacher' || u.role === 'admin');
        return renderSimpleUsersList(filtered);
    } else {
        filtered = filtered.filter(u => u.role === 'student');
        
        // Group students by class
        const groups = {};
        filtered.forEach(u => {
            const cls = u.class || 'Sinf belgilanmagan';
            if (!groups[cls]) groups[cls] = [];
            groups[cls].push(u);
        });

        const sortedClasses = Object.keys(groups).sort();
        
        if (sortedClasses.length === 0) return '<p style="text-align:center; padding: 40px; color: var(--text-muted);">O\'quvchilar topilmadi</p>';

        return sortedClasses.map(cls => `
            <div class="class-group" style="margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 0 5px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(99,102,241,0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem;">
                        ${cls.includes('-') ? cls.split('-')[0] : 'S'}
                    </div>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 700;">${cls}-sinf</h3>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">(${groups[cls].length} ta)</span>
                </div>
                ${renderSimpleUsersList(groups[cls])}
            </div>
        `).join('');
    }
}

function renderSimpleUsersList(list) {
    if (!list || list.length === 0) return '<p style="text-align:center; padding: 20px; color: var(--text-muted);">A\'zolar topilmadi</p>';

    return list.map(u => `
        <div class="glass-card" style="padding: 15px; margin-bottom: 12px; border-radius: 20px; display: flex; flex-direction: column; gap: 8px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 12px; background: ${u.role === 'teacher' ? 'rgba(249,115,22,0.1)' : 'rgba(99,102,241,0.1)'}; color: ${u.role === 'teacher' ? '#f97316' : '#6366f1'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                        <i class="fa-solid ${u.role === 'teacher' ? 'fa-chalkboard-user' : 'fa-user-graduate'}"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 0.95rem; color: var(--text-main); font-weight: 700;">${u.name}</h3>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">${u.role === 'teacher' ? (u.subject || 'O\'qituvchi') : u.class}</span>
                    </div>
                </div>
                ${u.user !== 'admin' ? `
                    <button onclick="deleteMember('${u.user}')" style="background: rgba(239,68,68,0.05); color: #ef4444; border: none; padding: 8px; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                ` : '<span style="font-size: 0.65rem; color: #22c55e; background: rgba(34,197,94,0.1); padding: 2px 6px; border-radius: 5px;">Tizim Admini</span>'}
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.03);">
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 10px;">
                    <span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Login:</span>
                    <span style="font-size: 0.85rem; font-family: monospace; font-weight: 600; color: #cbd5e1;">${u.user}</span>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 10px;">
                    <span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Parol:</span>
                    <span style="font-size: 0.85rem; font-family: monospace; font-weight: 600; color: #cbd5e1;">${u.pass}</span>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; padding: 0 5px;">
                <div style="display: flex; gap: 12px; font-size: 0.75rem;">
                    <span style="color: #22c55e;"><i class="fa-solid fa-star"></i> ${u.score || 0} ball</span>
                    <span style="color: #6366f1;"><i class="fa-solid fa-list-check"></i> ${u.testsTaken || 0} test</span>
                </div>
                <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem; color: rgba(255,255,255,0.1);"></i>
            </div>
        </div>
    `).join('');
}

window.filterMembers = (query) => {
    MEMBER_STATE.searchQuery = query;
    document.getElementById('members-list-container').innerHTML = renderMembersList(APP_DATA.users);
};

window.deleteMember = async (username) => {
    const confirm = await showCustomConfirm("A'zoni o'chirish", `${username} logindagi a'zoni o'chirib tashlamoqchimisiz? Barcha natijalar yo'qoladi.`);
    if (!confirm) return;

    try {
        const response = await fetch(`${API_BASE}/users/${username}`, { method: 'DELETE' });
        if (response.ok) {
            await fetchData();
            renderSection();
            showCustomAlert("A'zo o'chirildi");
        }
    } catch (err) {
        console.error("Failed to delete user", err);
        showCustomAlert("O'chirishda xatolik yuz berdi");
    }
};

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

let NOTIF_STATE = {
    activeTab: 'admin',
    currentView: 'list' // 'list' or notification ID
};

function renderNotifications(container) {
    const user = APP_DATA.user;

    // Handle Detail View
    if (NOTIF_STATE.currentView !== 'list') {
        const notif = APP_DATA.notifications.find(n => n.id === NOTIF_STATE.currentView);
        if (notif) {
            renderNotificationDetail(container, notif);
            return;
        }
        NOTIF_STATE.currentView = 'list';
    }
    
    // Filter logic
    const currentUser = user.user || user.username;
    console.log("Current user for filtering:", currentUser);
    
    let filtered = APP_DATA.notifications.filter(n => {
        const isAdminNotif = !n.to && (!n.role || n.role !== 'student');
        const isPrivateNotif = n.to === currentUser;
        // Admin broadcast notifications visible to everyone in 'admin' tab
        if (NOTIF_STATE.activeTab === 'admin' && isAdminNotif) return true;
        // Private notifications (ball, test results) in 'private' tab
        if (NOTIF_STATE.activeTab === 'private' && isPrivateNotif) return true;
        
        return false;
    });

    console.log(`Filtered notifications for tab ${NOTIF_STATE.activeTab}:`, filtered.length);

    const getIcon = (text) => {
        const t = text.toLowerCase();
        if (t.includes('ball')) return { icon: 'fa-star', cat: 'cat-star' };
        if (t.includes('test')) return { icon: 'fa-book-open', cat: 'cat-book' };
        if (t.includes('maktab') || t.includes('tizim')) return { icon: 'fa-bullhorn', cat: 'cat-megaphone' };
        if (t.includes('murojaat')) return { icon: 'fa-circle-info', cat: 'cat-info' };
        return { icon: 'fa-message', cat: 'cat-megaphone' };
    };

    container.innerHTML = `
        <div class="notif-premium-container fade-in">
            <div class="section-title" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <span>Xabarlar</span>
                <i class="fa-solid fa-filter" style="color: var(--primary); font-size: 1.1rem;"></i>
            </div>

            <div class="notif-tabs-container">
                <button class="notif-tab-btn ${NOTIF_STATE.activeTab === 'admin' ? 'active' : ''}" onclick="switchNotifTab('admin')">
                    <i class="fa-solid fa-bullhorn"></i> Maktab xabarlari
                </button>
                <button class="notif-tab-btn ${NOTIF_STATE.activeTab === 'private' ? 'active' : ''}" onclick="switchNotifTab('private')">
                    <i class="fa-solid fa-comment-dots"></i> Mening xabarlarim
                </button>
            </div>

            <div class="notif-list-new" style="margin-top: 10px;">
                ${filtered.length > 0 ? filtered.map(n => {
        const iconData = getIcon(n.text);
        return `
                        <div class="notif-item-premium fade-in" onclick="openNotification(${n.id})">
                            <div class="notif-icon-box ${iconData.cat}">
                                <i class="fa-solid ${iconData.icon}"></i>
                            </div>
                            <div class="notif-info">
                                <span class="notif-sender">${NOTIF_STATE.activeTab === 'admin' ? 'Maktab Ma\'muriyati' : 'Tizim Bildirishi'}</span>
                                <span class="notif-text-snippet">${n.text}</span>
                            </div>
                            <div class="notif-meta">
                                ${isAdmin ? `<i class="fa-solid fa-trash" style="color: #ef4444; font-size: 0.9rem; cursor: pointer; margin-bottom: 5px;" onclick="deleteNotif(event, ${n.id})"></i>` : ''}
                                <span class="notif-time">${n.time.split(' ')[0]}</span>
                                ${!n.read ? '<div class="notif-unread-dot"></div>' : '<i class="fa-solid fa-chevron-right" style="font-size: 0.7rem; color: #cbd5e1;"></i>'}
                            </div>
                        </div>
                    `;
    }).join('') : `
                    <div style="text-align:center; padding: 60px 20px; color: var(--text-muted);">
                        <i class="fa-solid fa-comment-slash" style="font-size: 3.5rem; margin-bottom: 20px; opacity: 0.3;"></i>
                        <p style="font-size: 1.1rem; font-weight: 500;">Xabarlar topilmadi</p>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Boshqa bo'limni tekshirib ko'ring</p>
                    </div>
                `}
            </div>
            
            ${filtered.length > 0 ? `
                <div style="text-align: center; margin-top: 20px;">
                    <span style="font-size: 0.85rem; color: var(--text-muted); cursor: pointer;" onclick="markAllNotifsRead()">
                        <i class="fa-solid fa-check-double"></i> Barchasini o'qilgan deb belgilash
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

// Helper functions for Notifications
window.switchNotifTab = (tab) => {
    NOTIF_STATE.activeTab = tab;
    renderSection();
};

window.handleNotifSearch = (query) => {
    NOTIF_STATE.searchQuery = query;
    const content = document.getElementById('app-content');
    renderNotifications(content);
};

window.setNotifFilter = (filter) => {
    NOTIF_STATE.activeFilter = filter;
    renderSection();
};

function renderNotificationDetail(container, notif) {
    const sender = NOTIF_STATE.activeTab === 'admin' ? 'Maktab Ma\'muriyati' : 'Tizim Bildirishi';
    
    container.innerHTML = `
        <div class="notif-premium-container fade-in">
            <div class="profile-top-bar" style="margin-bottom: 25px;">
                <i class="fa-solid fa-chevron-left" style="font-size: 1.2rem; cursor: pointer;" onclick="closeNotification()"></i>
                <span class="profile-title-new" style="font-size: 1.1rem;">Xabar ma'lumoti</span>
                <div style="width: 24px;"></div>
            </div>

            <div class="glass-card" style="padding: 25px; border-radius: 28px; background: white; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div class="notif-icon-box cat-megaphone" style="width: 45px; height: 45px; border-radius: 14px;">
                        <i class="fa-solid fa-bullhorn"></i>
                    </div>
                    <div>
                        <span style="display: block; font-weight: 700; color: #1e293b; font-size: 1rem;">${sender}</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${notif.time}</span>
                    </div>
                </div>

                <div style="font-size: 1.1rem; line-height: 1.7; color: #334155; margin-bottom: 30px;">
                    ${notif.text.replace(/\n/g, '<br>')}
                </div>

                <button class="login-btn" style="width: 100%; padding: 15px; border-radius: 18px;" onclick="closeNotification()">
                    <i class="fa-solid fa-arrow-left"></i> Orqaga qaytish
                </button>
            </div>
        </div>
    `;

    // Dark mode adjustments
    if (document.body.getAttribute('data-theme') === 'dark') {
        const card = container.querySelector('.glass-card');
        if (card) {
            card.style.background = 'rgba(255,255,255,0.03)';
            const textDiv = container.querySelector('div[style*="color: #334155"]');
            if (textDiv) textDiv.style.color = '#cbd5e1';
            const senderSpan = container.querySelector('span[style*="color: #1e293b"]');
            if (senderSpan) senderSpan.style.color = 'white';
        }
    }
}

window.openNotification = async (id) => {
    const notif = APP_DATA.notifications.find(n => n.id === id);
    if (!notif) return;

    // Mark as read
    if (!notif.read) {
        notif.read = true;
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
        } catch (e) {}
        updateNotifBadge();
    }

    NOTIF_STATE.currentView = id;
    renderSection();
};

window.closeNotification = () => {
    NOTIF_STATE.currentView = 'list';
    renderSection();
};

window.deleteNotif = async (e, id) => {
    e.stopPropagation(); 
    console.log("Delete button clicked for ID:", id);
    
    const confirm = await showCustomConfirm("Xabarni o'chirish", "Ushbu xabarni o'chirib tashlamoqchimisiz?");
    if (!confirm) {
        console.log("Deletion cancelled by user");
        return;
    }

    try {
        console.log("Sending DELETE request to:", `${API_BASE}/notifications/${id}`);
        const response = await fetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE' });
        console.log("Response status:", response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log("Delete result:", result);
            await fetchData();
            renderSection();
            showCustomAlert("Xabar o'chirildi");
        } else {
            const errorText = await response.text();
            console.error("Delete failed:", errorText);
            showCustomAlert("O'chirishda xatolik yuz berdi");
        }
    } catch (err) {
        console.error("Failed to delete notification:", err);
        showCustomAlert("Xatolik yuz berdi: " + err.message);
    }
};

async function markAllNotifsRead() {
    APP_DATA.notifications.forEach(n => {
        if (n.to === APP_DATA.user.user || n.role === 'admin') n.read = true;
    });
    showCustomAlert("Barcha xabarlar o'qildi");
    renderSection();
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

async function addNewQuestionByTeacher(subjectId) {
    const targetClass = document.getElementById('t-q-class').value;
    const text = document.getElementById('t-q-text').value;
    const options = [
        document.getElementById('t-q-opt1').value,
        document.getElementById('t-q-opt2').value,
        document.getElementById('t-q-opt3').value,
        document.getElementById('t-q-opt4').value
    ];
    const correct = parseInt(document.getElementById('t-q-correct').value);

    if (!targetClass || !text || options.some(o => !o)) {
        showCustomAlert("Iltimos, barcha maydonlarni to'ldiring!");
        return;
    }

    const question = { 
        q: text, 
        options, 
        correct, 
        targetClass, 
        author: APP_DATA.user.username || APP_DATA.user.user,
        timestamp: Date.now()
    };

    try {
        const response = await fetch(`${API_BASE}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectId, question })
        });

        if (response.ok) {
            await fetchData();
            showCustomAlert("Savol muvaffaqiyatli qo'shildi!");
            renderTeacherView('test-manager');
        } else {
            showCustomAlert("Xatolik yuz berdi!");
        }
    } catch (error) {
        showCustomAlert("Server bilan bog'lanishda xato!");
    }
}

window.switchMainTeacherTab = (tab) => {
    const tabs = ['test', 'classes', 'analytics'];
    tabs.forEach(t => {
        const btn = document.getElementById(`main-tab-${t}`);
        const section = document.getElementById(`section-${t}`);
        if (t === tab) {
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
            section.classList.remove('hidden');
        } else {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-muted)';
            section.classList.add('hidden');
        }
    });
};

window.switchTestSubTab = (tab) => {
    const addBtn = document.getElementById('t-subtab-add');
    const listBtn = document.getElementById('t-subtab-list');
    const formArea = document.getElementById('t-form-area');
    const listArea = document.getElementById('t-list-area');

    if (tab === 'add') {
        listBtnActual.style.color = 'var(--text-muted)';
        formArea.classList.remove('hidden');
        listArea.classList.add('hidden');
    } else {
        listBtnActual.style.background = 'var(--primary)';
        listBtnActual.style.color = 'white';
        addBtnActual.style.background = 'transparent';
        addBtnActual.style.color = 'var(--text-muted)';
        listArea.classList.remove('hidden');
        formArea.classList.add('hidden');
    }
};

window.switchTestTab = (tab) => {
    const addTab = document.getElementById('tab-add');
    const listTab = document.getElementById('tab-list');
    const addSection = document.getElementById('test-form-section');
    const listSection = document.getElementById('test-list-section');

    if (tab === 'add') {
        addTab.style.background = 'var(--primary)';
        addTab.style.color = 'white';
        listTab.style.background = 'transparent';
        listTab.style.color = 'var(--text-muted)';
        addSection.classList.remove('hidden');
        listSection.classList.add('hidden');
    } else {
        listTab.style.background = 'var(--primary)';
        listTab.style.color = 'white';
        addTab.style.background = 'transparent';
        addTab.style.color = 'var(--text-muted)';
        listSection.classList.remove('hidden');
        addSection.classList.add('hidden');
    }
};

window.selectCorrectVariant = (val) => {
    document.querySelectorAll('#t-q-correct').forEach(el => el.value = val);
    document.querySelectorAll('.variant-select-btn').forEach((btn) => {
        const btnVal = parseInt(btn.id.replace('variant-btn-', ''));
        if (btnVal === val) btn.classList.add('active');
        else btn.classList.remove('active');
    });
};

async function deleteTeacherQuestion(subjectId, index) {
    const confirm = await showCustomConfirm("O'chirish", "Haqiqatan ham bu savolni o'chirmoqchimisiz?");
    if (!confirm) return;

    try {
        const response = await fetch(`${API_BASE}/questions/${subjectId}/${index}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await fetchData();
            renderTeacherView('test-manager');
        } else {
            showCustomAlert("Xatolik yuz berdi!");
        }
    } catch (error) {
        showCustomAlert("Server bilan bog'lanishda xato!");
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
    'news-detail': 'news-detail',
    'members': 'members'
};

function renderHome(container) {
    container.innerHTML = `
        <div class="news-slider">
            ${APP_DATA.news.map(n => `
                <div class="news-card" onclick="openNewsDetail(${n.id})" style="height: 150px;">
                    ${n.type === 'video' ? `
                        <video src="${n.image}" autoplay muted loop playsinline></video>
                    ` : `
                        <img src="${n.image}" alt="${n.title}" onerror="this.src='news.png'">
                    `}
                    <div class="news-content" style="padding: 15px;">
                        <div style="display: flex; justify-content: flex-end; align-items: flex-start; margin-bottom: 5px; width: 100%;">
                            <div style="display: flex; gap: 8px; font-size: 0.65rem; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 8px; backdrop-filter: blur(5px);">
                                <span><i class="fa-regular fa-calendar"></i> ${n.date || 'Bugun'}</span>
                                <span><i class="fa-regular fa-eye"></i> ${n.views || 0}</span>
                            </div>
                        </div>
                        <h3 class="news-title" style="font-size: 1rem; line-height: 1.2;">${n.title}</h3>
                    </div>
                </div>
            `).join('')}
        </div>

        ${!isTeacher ? `
        <div class="glass-card" onclick="navigateTo('schedule')" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-top: 5px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 42px; height: 42px; border-radius: 12px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem;">
                    <i class="fa-regular fa-calendar-days"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 700;">Dars jadvali</h3>
                    <p id="live-schedule-status" style="margin: 0; font-size: 0.75rem; color: var(--text-muted); transition: all 0.3s;">${getLiveScheduleStatus()}</p>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
        </div>` : ''}

        ${!isAdmin && !isTeacher ? `
        <div class="glass-card" onclick="navigateTo('diary')" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-top: 5px; padding: 12px; background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(234,179,8,0.05) 100%); border: 1px solid rgba(245,158,11,0.25);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #eab308); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; box-shadow: 0 4px 12px rgba(245,158,11,0.35);">
                    <i class="fa-solid fa-book-open"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 700;">Mening Kundaligim</h3>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">Baholar va natijalar tarixi</p>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
        </div>` : ''}

        <div class="glass-card fade-in" style="margin-top: 5px; padding: 12px; background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.05) 100%); border: 1px solid rgba(99,102,241,0.2); border-radius: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <div style="position: relative;">
                    <div style="width: 45px; height: 45px; border-radius: 12px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem;">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background: #22c55e; border: 2px solid var(--bg-dark); border-radius: 50%;"></div>
                </div>
                <div class="director-info">
                    <h3 style="margin:0; font-size: 0.95rem; font-weight: 700;">Akbar Tohirov</h3>
                    <p style="margin:0; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Maslahatchi</p>
                </div>
            </div>
            <a href="tel:+998910049600" style="text-decoration:none; display: flex; align-items: center; justify-content: center; gap: 8px; background: #22c55e; color: white; padding: 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;">
                <i class="fa-solid fa-phone-volume"></i> Qo'ng'iroq qilish
            </a>
        </div>

        <div class="social-buttons" style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <a href="https://t.me/Maktabimhayoti" target="_blank" class="social-btn tg-btn" style="padding: 10px; font-size: 0.8rem; height: 40px;"><i class="fa-brands fa-telegram"></i> Telegram</a>
            <a href="https://www.instagram.com/maktabimhayoti/?__pwa=1#" target="_blank" class="social-btn ig-btn" style="padding: 10px; font-size: 0.8rem; height: 40px;"><i class="fa-brands fa-instagram"></i> Instagram</a>
        </div>
    `;
}

function renderDiary(container) {
    // ── helpers ──────────────────────────────────────────────
    const MONTHS   = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
    const DAY_SHORT = ['Ya','Du','Se','Ch','Pa','Ju','Sh'];
    const DAY_FULL  = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    const DAY_KEYS  = ['yakshanba','dushanba','seshanba','chorshanba','payshanba','juma','shanba'];
    const TIMES     = ['08:00 – 08:45','08:55 – 09:40','09:45 – 10:30','10:40 – 11:25','11:35 – 12:20','12:25 – 13:10','13:15 – 14:00'];
    const ICONS     = {
        'matematika':'#6366f1','ona tili':'#f59e0b','ingliz tili':'#22c55e',
        'rus tili':'#ef4444','tarix':'#8b5cf6','informatika':'#3b82f6',
        'fizika':'#a855f7','kimyo':'#ef4444','biologiya':'#84cc16',
        'geografiya':'#06b6d4','adabiyot':'#f97316','jismoniy':'#10b981',
        'musiqa':'#ec4899','huquq':'#78716c','texnologiya':'#64748b','tarbiya':'#ec4899'
    };
    function iconColor(name){ const k=Object.keys(ICONS).find(k=>name.toLowerCase().includes(k)); return k?ICONS[k]:'#6366f1'; }
    function iconLetter(name){ return name.trim().slice(0,2).toUpperCase(); }
    function gradeInfo(p){ if(p>=5)return{c:'#22c55e',bg:'rgba(34,197,94,0.15)',t:"A'lo"};if(p>=4)return{c:'#f59e0b',bg:'rgba(245,158,11,0.15)',t:'Yaxshi'};if(p>=3)return{c:'#f97316',bg:'rgba(249,115,22,0.15)',t:'Qoniqarli'};return{c:'#ef4444',bg:'rgba(239,68,68,0.15)',t:'Past'}; }
    function weekMonday(d){ const x=new Date(d); const day=x.getDay(); x.setDate(x.getDate()-(day===0?6:day-1)); return x; }
    function sameDay(a,b){ return a.toDateString()===b.toDateString(); }
    function fmtDate(d){ return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`; }

    // ── state ─────────────────────────────────────────────────
    const user = APP_DATA.user;
    const uname = user.username||user.user;
    const su = (APP_DATA.users||[]).find(u=>u.user===uname);
    const grades = su&&su.grades ? su.grades : [];
    window._dD = new Date();

    function getSubjects(dayKey){
        if(!APP_DATA.schedules) return [];
        const sch = APP_DATA.schedules.find(s=>s.class===user.class);
        if(!sch||!sch.days[dayKey]) return [];
        return sch.days[dayKey].split('\n').filter(s=>s.trim());
    }
    function getTeacher(subj){
        const teachers = (APP_DATA.users||[]).filter(u=>u.role==='teacher');
        const t = teachers.find(u=>{
            if(u.class&&u.class.toLowerCase().includes(subj.toLowerCase().split(' ')[0])) return true;
            if(u.subject){
                const s=(APP_DATA.subjects||[]).find(x=>x.id===u.subject);
                if(s&&s.name&&s.name.toLowerCase()===subj.toLowerCase()) return true;
            }
            return false;
        });
        if(t){ const p=t.name.split(' '); return p[0][0]+'. '+p.slice(1).join(' '); }
        return '—';
    }
    function getGradeForSubjDate(subj, dateStr){
        const name = subj.trim().toLowerCase();
        if(name.length < 3) return null;
        return grades.find(g=>{
            if(g.date !== dateStr) return false;
            // First try exact subjectName match
            if(g.subjectName && g.subjectName.toLowerCase() === name) return true;
            // Fallback: match by label
            if(g.label){
                const label = g.label.toLowerCase();
                return label === name || label.includes(name);
            }
            return false;
        });
    }

    // ── render week content ───────────────────────────────────
    function renderContent(){
        const sel = window._dD;
        const mon = weekMonday(sel);
        const days = Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
        const sun = days[6];
        const weekLabel = `${mon.getDate()} — ${sun.getDate()} ${MONTHS[sun.getMonth()].toLowerCase()} ${sun.getFullYear()}`;

        const pillsHtml = days.map(d=>{
            const dw = d.getDay();
            const active = sameDay(d,sel);
            return `<div onclick="window._dD=new Date(${d.getFullYear()},${d.getMonth()},${d.getDate()});renderDiaryContent()"
                style="flex:1;display:flex;flex-direction:column;align-items:center;padding:8px 2px;border-radius:14px;cursor:pointer;
                       background:${active?'linear-gradient(135deg,#2563eb,#1d4ed8)':'rgba(255,255,255,0.06)'};
                       color:${active?'white':'var(--text-muted)'};
                       box-shadow:${active?'0 4px 14px rgba(37,99,235,0.4)':'none'};transition:all 0.2s;">
                <span style="font-size:0.6rem;font-weight:600;margin-bottom:3px;">${DAY_SHORT[dw]}</span>
                <span style="font-size:0.95rem;font-weight:800;">${d.getDate()}</span>
                <span style="font-size:0.55rem;margin-top:2px;opacity:0.7;">${MONTHS[d.getMonth()].slice(0,3)}</span>
            </div>`;
        }).join('');

        const dw = sel.getDay();
        const dayKey = DAY_KEYS[dw];
        const dateStr = fmtDate(sel);
        const subjects = getSubjects(dayKey);

        let tableHtml = '';
        // Summer vacation: May 25 – September 4
        const selMonth = sel.getMonth(); // 0-indexed (4=May, 8=Sep)
        const selDate = sel.getDate();
        const isVacation = (selMonth === 4 && selDate >= 25) || (selMonth >= 5 && selMonth <= 7) || (selMonth === 8 && selDate <= 4);
        if(isVacation){
            tableHtml = `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                <i class="fa-solid fa-umbrella-beach" style="font-size:2.5rem;color:#fbbf24;display:block;margin-bottom:12px;"></i>
                <p style="font-weight:700;font-size:1.05rem;color:#fbbf24;">☀️ Yozgi ta'til!</p>
                <p style="font-size:0.82rem;margin-top:6px;">25-Maydan 4-Sentyabrgacha darslar bo'lmaydi.</p>
                <p style="font-size:0.75rem;margin-top:4px;">Yaxshi dam oling! 🏖️</p></div>`;
        } else if(dw===0){
            tableHtml = `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                <i class="fa-solid fa-sun" style="font-size:2.5rem;color:#fbbf24;display:block;margin-bottom:12px;"></i>
                <p style="font-weight:600;">Dam olish kuni</p><p style="font-size:0.8rem;">Yakshanba kuni darslar yo'q</p></div>`;
        } else if(!subjects.length){
            tableHtml = `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                <i class="fa-solid fa-calendar-xmark" style="font-size:2.5rem;display:block;margin-bottom:12px;"></i>
                <p style="font-weight:600;">Jadval kiritilmagan</p></div>`;
        } else {
            const rows = subjects.map((subj,i)=>{
                const ic=iconColor(subj); const il=iconLetter(subj);
                const teacher=getTeacher(subj);
                const time=TIMES[i]||'';
                const ge=getGradeForSubjDate(subj,dateStr);
                let gradeCell='';
                if(ge){ const gi=gradeInfo(ge.points);
                    gradeCell=`<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <div style="width:34px;height:34px;border-radius:9px;background:${gi.bg};border:1.5px solid ${gi.c}40;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:800;color:${gi.c};">${ge.points}</div>
                        <span style="font-size:0.55rem;color:${gi.c};font-weight:700;">${gi.t}</span></div>`;
                } else {
                    gradeCell=`<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                        <div style="width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:0.9rem;color:var(--text-muted);">—</div>
                        <span style="font-size:0.5rem;color:var(--text-muted);">Baholanmagan</span></div>`;
                }
                return `<tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                    <td style="padding:11px 6px;">
                        <div style="display:flex;align-items:center;gap:9px;">
                            <div style="width:36px;height:36px;border-radius:10px;background:${ic};display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:white;flex-shrink:0;">${il}</div>
                            <div style="font-size:0.82rem;font-weight:700;">${subj.trim()}</div>
                        </div>
                    </td>
                    <td style="padding:11px 4px;font-size:0.7rem;color:var(--text-muted);white-space:nowrap;">${time}</td>
                    <td style="padding:11px 4px;font-size:0.7rem;color:var(--text-muted);white-space:nowrap;">${teacher}</td>
                    <td style="padding:11px 4px;text-align:center;">${gradeCell}</td>
                </tr>`;
            }).join('');

            tableHtml = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <i class="fa-regular fa-calendar-days" style="color:#2563eb;"></i>
                        <span style="font-size:0.88rem;font-weight:700;">${sel.getDate()}-${MONTHS[dw<=0?0:dw-1]?'':''} ${MONTHS[sel.getMonth()].slice(0,3).toLowerCase()}, ${DAY_FULL[dw]}</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.08);padding:5px 11px;border-radius:10px;font-size:0.72rem;color:var(--text-muted);cursor:pointer;">
                        Barcha fanlar <i class="fa-solid fa-chevron-down" style="font-size:0.55rem;"></i>
                    </div>
                </div>
                <div style="border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08);">
                                <th style="padding:9px 6px;text-align:left;font-size:0.68rem;color:var(--text-muted);font-weight:600;">Fan</th>
                                <th style="padding:9px 4px;text-align:left;font-size:0.68rem;color:var(--text-muted);font-weight:600;">Vaqti</th>
                                <th style="padding:9px 4px;text-align:left;font-size:0.68rem;color:var(--text-muted);font-weight:600;">O'qituvchi</th>
                                <th style="padding:9px 4px;text-align:center;font-size:0.68rem;color:var(--text-muted);font-weight:600;">Baho</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        }

        document.getElementById('diary-body').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <button onclick="window._dD.setDate(window._dD.getDate()-7);renderDiaryContent()"
                    style="border:none;background:rgba(255,255,255,0.08);color:var(--text-main);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:0.8rem;">
                    <i class="fa-solid fa-chevron-left"></i></button>
                <span style="font-size:0.82rem;font-weight:600;color:var(--text-main);">${weekLabel}</span>
                <button onclick="window._dD.setDate(window._dD.getDate()+7);renderDiaryContent()"
                    style="border:none;background:rgba(255,255,255,0.08);color:var(--text-main);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:0.8rem;">
                    <i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div style="display:flex;gap:5px;margin-bottom:16px;">${pillsHtml}</div>
            <div>${tableHtml}</div>`;
    }

    window.renderDiaryContent = renderContent;

    // ── skeleton HTML ─────────────────────────────────────────
    container.innerHTML = `
        <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);margin:-10px -15px 0;padding:18px 18px 20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <button onclick="navigateTo('home')" style="border:none;background:rgba(255,255,255,0.2);color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.9rem;">
                    <i class="fa-solid fa-chevron-left"></i></button>
                <span style="color:white;font-size:1.1rem;font-weight:700;">Kundalik</span>
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:white;">
                    <i class="fa-regular fa-calendar"></i></div>
            </div>
            <div style="display:flex;background:rgba(255,255,255,0.15);border-radius:12px;padding:4px;backdrop-filter:blur(10px);">
                <button id="tab-h" onclick="this.style.background='white';this.style.color='#2563eb';document.getElementById('tab-k').style.background='transparent';document.getElementById('tab-k').style.color='rgba(255,255,255,0.8)';"
                    style="flex:1;border:none;padding:9px;border-radius:9px;font-size:0.85rem;font-weight:600;cursor:pointer;background:white;color:#2563eb;">Haftalik</button>
                <button id="tab-k" onclick="this.style.background='white';this.style.color='#2563eb';document.getElementById('tab-h').style.background='transparent';document.getElementById('tab-h').style.color='rgba(255,255,255,0.8)';"
                    style="flex:1;border:none;padding:9px;border-radius:9px;font-size:0.85rem;font-weight:600;cursor:pointer;background:transparent;color:rgba(255,255,255,0.8);">Kunlik</button>
            </div>
        </div>
        <div id="diary-body" style="padding:16px 4px 30px;"></div>`;

    renderContent();
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

    const numLessons = subjects.length;
    const lastLessonEnd = lessonTimes[numLessons - 1] ? lessonTimes[numLessons - 1].end : 0;

    // 1. Before first lesson
    if (currentTimeMinutes < lessonTimes[0].start) {
        return `<span style="color: var(--text-muted);"><i class="fa-solid fa-clock"></i> Darslar hali boshlanmadi</span>`;
    }

    // 2. After last lesson of the day
    if (currentTimeMinutes > lastLessonEnd) {
        return `<span style="color: #94a3b8;"><i class="fa-solid fa-check-double"></i> Bugungi darslar yakunlandi</span>`;
    }

    // 3. During lessons or breaks
    for (let i = 0; i < numLessons; i++) {
        const lesson = lessonTimes[i];

        // During lesson i
        if (currentTimeMinutes >= lesson.start && currentTimeMinutes <= lesson.end) {
            const subject = subjects[i];
            const startTimeStr = `${Math.floor(lesson.start / 60).toString().padStart(2, '0')}:${(lesson.start % 60).toString().padStart(2, '0')}`;
            return `<span style="color: #22c55e;"><i class="fa-solid fa-circle-play"></i> ${startTimeStr} ${subject} boshlandi</span>`;
        }

        // During break after lesson i
        if (i < numLessons - 1) {
            const nextLesson = lessonTimes[i + 1];
            if (currentTimeMinutes > lesson.end && currentTimeMinutes < nextLesson.start) {
                return `<span style="color: #eab308;"><i class="fa-solid fa-mug-hot"></i> Hozir tanaffus</span>`;
            }
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

    const availableSubjects = (APP_DATA.subjects || []).filter(s => {
        // Only show subjects that have questions for this student's class (or 'all')
        return s.questions && s.questions.some(q => !q.targetClass || q.targetClass === 'all' || q.targetClass === APP_DATA.user.class);
    });

    container.innerHTML = `
        <div class="section-title">
            <span>Fanlar bo'yicha testlar</span>
        </div>
        <div class="test-grid" style="grid-template-columns: 1fr; gap: 15px;">
            ${availableSubjects.length > 0 ? availableSubjects.map(s => {
                const classQuestions = s.questions.filter(q => !q.targetClass || q.targetClass === 'all' || q.targetClass === APP_DATA.user.class);
                const qCount = classQuestions.length;
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
            }).join('') : `<p style="text-align:center; color:var(--text-muted); padding:20px;">Sizning sinfingiz uchun testlar mavjud emas.</p>`}
        </div>
    `;
}

async function startTest(subjectId) {
    const subject = APP_DATA.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    // Filter questions for the student's class
    const filteredQuestions = subject.questions.filter(q => !q.targetClass || q.targetClass === 'all' || q.targetClass === APP_DATA.user.class);
    
    if (filteredQuestions.length === 0) return;

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
        questions: [...filteredQuestions].sort(() => Math.random() - 0.5),
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
                <div class="glass-card" style="display: flex; align-items: center; gap: 15px; padding: 12px 18px; background: ${theme.bg}; border: 1px solid ${theme.border}; position: relative; overflow: hidden; margin-bottom: 5px;">
                    <div style="position: absolute; top: -10px; right: -10px; font-size: 4rem; color: rgba(255,255,255,0.03); font-weight: 900; z-index: 0;">${i + 1}</div>
                    <div style="position: relative; z-index: 1;">
                        <div style="width: 50px; height: 50px; border-radius: 15px; border: 2px solid ${theme.color}; padding: 2px; background: rgba(0,0,0,0.2);">
                            <img src="${r.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=${theme.color.replace('#', '')}&color=fff`}" style="width: 100%; height: 100%; border-radius: 10px; object-fit: cover;">
                        </div>
                        <i class="fa-solid ${theme.icon}" style="position: absolute; top: -8px; left: -8px; color: ${theme.color}; font-size: 1rem; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));"></i>
                    </div>
                    <div style="flex: 1; z-index: 1;">
                        <div style="font-size: 1rem; font-weight: 700; color: white;">${r.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${i + 1}-o'rin</div>
                    </div>
                    <div style="text-align: right; z-index: 1;">
                        <div style="font-size: 1.2rem; font-weight: 800; color: ${theme.color};">${r.score}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">ball</div>
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
                <div class="glass-card" style="display: flex; align-items: center; gap: 12px; padding: 10px 15px; background: rgba(255,255,255,0.03); margin-bottom: 5px;">
                    <div style="width: 20px; font-weight: 700; color: var(--text-muted); font-size: 0.8rem; text-align: center;">${i + 4}</div>
                    <img src="${r.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random&color=fff`}" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.85rem;">${r.name}</div>
                    </div>
                    <div style="font-weight: 700; color: var(--text-muted); font-size: 0.9rem;">${r.score} <span style="font-size: 0.6rem; font-weight: 400;">ball</span></div>
                </div>
            `).join('')}
        </div>
        ` : ''}
    `;
}

function renderProfile(container) {
    const isUserAdmin = isAdmin;
    const user = APP_DATA.user;

    // Calculate actual rank from all students
    let actualRank = '-';
    if (APP_DATA.users) {
        const sortedStudents = APP_DATA.users
            .filter(u => u.role === 'student')
            .sort((a, b) => (b.score || 0) - (a.score || 0));
        const rankIndex = sortedStudents.findIndex(u => u.user === user.username);
        if (rankIndex !== -1) actualRank = rankIndex + 1;
    }

    if (isUserAdmin || isTeacher) {
        container.innerHTML = `
            <div class="profile-header fade-in" style="padding: 30px 20px; text-align: center; background: linear-gradient(to bottom, rgba(99,102,241,0.1), transparent); border-radius: 30px; margin-bottom: 20px;">
                <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 20px;">
                    <div id="p-avatar-box" style="width: 100%; height: 100%; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; box-shadow: 0 10px 25px rgba(99,102,241,0.3); overflow: hidden; border: 4px solid var(--glass-border);">
                        ${user.avatar ? `<img src="${user.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fa-solid ${isUserAdmin ? 'fa-user-shield' : 'fa-chalkboard-user'}"></i>`}
                    </div>
                    <button onclick="document.getElementById('avatar-input').click()" style="position: absolute; bottom: 0; right: 0; width: 32px; height: 32px; border-radius: 50%; background: var(--primary); border: 2px solid var(--bg-dark); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-camera" style="font-size: 0.8rem;"></i>
                    </button>
                    <input type="file" id="avatar-input" hidden accept="image/*" onchange="handleAvatarUpload(this)">
                </div>
                <h2 style="margin: 0; font-size: 1.4rem; font-weight: 700;">${user.name}</h2>
                <p style="margin: 5px 0 0; color: var(--text-muted); font-size: 0.9rem;">${isUserAdmin ? 'Tizim Administratori' : 'O\'qituvchi'}</p>
            </div>

            ${isUserAdmin ? `
            <div class="section-title" style="margin-bottom: 10px;">
                <span>Platforma Statistikasi</span>
            </div>
            <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div class="glass-card" style="padding: 15px; text-align: center; border: 1px solid rgba(99,102,241,0.2);">
                    <i class="fa-solid fa-users" style="font-size: 1.2rem; color: #6366f1; margin-bottom: 8px; display: block;"></i>
                    <div style="font-size: 1.2rem; font-weight: 800;">${APP_DATA.users ? APP_DATA.users.length : 0}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">A'zolar</div>
                </div>
                <div class="stats-grid-item glass-card" style="padding: 15px; text-align: center; border: 1px solid rgba(249,115,22,0.2);">
                    <i class="fa-solid fa-newspaper" style="font-size: 1.2rem; color: #f97316; margin-bottom: 8px; display: block;"></i>
                    <div style="font-size: 1.2rem; font-weight: 800;">${APP_DATA.news.length}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Yangiliklar</div>
                </div>
            </div>
            ` : ''}

            <div style="padding: 0 10px;">
                <div class="glass-card" style="padding: 15px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <h3 style="font-size: 0.9rem; margin-bottom: 10px;"><i class="fa-solid fa-lock" style="color: var(--primary);"></i> Parolni o'zgartirish</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <input type="password" id="p-old-pass" placeholder="Eski parol" style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; padding: 10px; border-radius: 10px; font-size: 0.85rem;">
                        <input type="password" id="p-new-pass" placeholder="Yangi parol" style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; padding: 10px; border-radius: 10px; font-size: 0.85rem;">
                        <button class="buy-btn" onclick="changePassword()" style="font-size: 0.8rem; padding: 10px;">O'zgartirish</button>
                    </div>
                </div>
                
                <button id="install-pwa-btn" class="hidden" onclick="installPWA()" style="width: 100%; background: #22c55e; color: white; border: none; padding: 15px; border-radius: 15px; font-weight: 700; font-size: 1rem; cursor: pointer; margin-top: 10px; display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-download"></i> Ilovani o'rnatish
                </button>
                <button onclick="initPushNotifications(true)" style="width: 100%; background: var(--accent-gradient); color: white; border: none; padding: 15px; border-radius: 15px; font-weight: 700; font-size: 1rem; cursor: pointer; margin-top: 10px; display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-bell"></i> Bildirishnomalarni yoqish
                </button>
                <button class="logout-btn-new" onclick="handleLogout()" style="margin-top: 10px;">
                    <i class="fa-solid fa-right-from-bracket"></i> Tizimdan chiqish
                </button>
            </div>
        `;
        return;
    }

    // Student Profile View - Optimized for space
    container.innerHTML = `
        <div class="profile-premium-container fade-in">
            <div class="profile-header-new">
                <div class="profile-top-bar">
                    <i class="fa-solid fa-chevron-left" style="font-size: 1.1rem; cursor: pointer;" onclick="navigateTo('home')"></i>
                    <span class="profile-title-new">Profil</span>
                    <div style="width: 24px;"></div>
                </div>
            </div>

            <div class="profile-card-overlap">
                <div style="position: relative; width: 90px; height: 90px; margin: 0 auto 15px;">
                    <div id="p-avatar-box" style="width: 100%; height: 100%; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #94a3b8; border: 4px solid white; box-shadow: 0 10px 20px rgba(0,0,0,0.05); overflow: hidden;">
                        ${user.avatar ? `<img src="${user.avatar}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <button onclick="document.getElementById('avatar-input').click()" style="position: absolute; bottom: 0; right: 0; width: 28px; height: 28px; border-radius: 50%; background: #4f46e5; border: 2px solid white; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-camera" style="font-size: 0.7rem;"></i>
                    </button>
                    <input type="file" id="avatar-input" hidden accept="image/*" onchange="handleAvatarUpload(this)">
                </div>
                <h2 class="profile-name-new" style="font-size: 1.2rem;">${user.name}</h2>
                <span class="profile-badge-new">${user.class} sinf</span>
                
                <div style="display: flex; justify-content: center; gap: 20px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
                    <div style="text-align: center;">
                        <div style="font-weight: 800; color: #1e293b; font-size: 1.1rem;">${user.testsTaken || 0}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase;">Testlar</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: 800; color: #1e293b; font-size: 1.1rem;">#${actualRank}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase;">Reyting</div>
                    </div>
                </div>
            </div>

            <div class="score-stats-card">
                <div class="score-header-new">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="info-icon-circle" style="background: #eef2ff; width: 36px; height: 36px; font-size: 0.9rem;">
                            <i class="fa-solid fa-chart-line" style="color: #4f46e5;"></i>
                        </div>
                        <span class="score-label-new" style="font-size: 1rem;">Umumiy Ball</span>
                    </div>
                    <div class="score-main-value">
                        <div class="score-number-new" style="font-size: 1.5rem;">${user.score}</div>
                    </div>
                </div>

                <div class="progress-container-new">
                    <div class="progress-bar-new" style="width: ${Math.min(user.score, 100)}%;"></div>
                </div>
                
                <p style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin: 0;">Sovg'alar uchun yana ball to'plang!</p>
            </div>

            <div style="padding: 15px 25px;">
                <div class="glass-card" style="padding: 15px; margin-bottom: 15px; border: 1px solid #f1f5f9; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <h3 style="font-size: 0.9rem; margin-bottom: 12px; color: #1e293b;"><i class="fa-solid fa-lock" style="color: #4f46e5;"></i> Parolni o'zgartirish</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <input type="password" id="p-old-pass" placeholder="Eski parol" style="background: #f8fafc; border: 1px solid #e2e8f0; color: #1e293b; padding: 12px; border-radius: 12px; font-size: 0.85rem; outline: none;">
                        <input type="password" id="p-new-pass" placeholder="Yangi parol" style="background: #f8fafc; border: 1px solid #e2e8f0; color: #1e293b; padding: 12px; border-radius: 12px; font-size: 0.85rem; outline: none;">
                        <button onclick="changePassword()" style="background: #4f46e5; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;">O'zgartirish</button>
                    </div>
                </div>

                <button id="install-pwa-btn" class="hidden" onclick="installPWA()" style="width: 100%; background: #22c55e; color: white; border: none; padding: 15px; border-radius: 15px; font-weight: 700; font-size: 1rem; cursor: pointer; margin-bottom: 15px; display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-download"></i> Ilovani o'rnatish
                </button>
                <button onclick="initPushNotifications(true)" style="width: 100%; background: var(--accent-gradient); color: white; border: none; padding: 15px; border-radius: 15px; font-weight: 700; font-size: 1rem; cursor: pointer; margin-bottom: 15px; display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-bell"></i> Bildirishnomalarni yoqish
                </button>
                <button class="logout-btn-new" onclick="handleLogout()" style="margin: 0;">
                    <i class="fa-solid fa-right-from-bracket"></i> Tizimdan chiqish
                </button>
                <p style="text-align: center; font-size: 0.7rem; color: #94a3b8; margin-top: 10px;">Versiya 2.4.0 • 24-Maktab Platformasi</p>
            </div>
        </div>
    `;
}

async function changePassword() {
    const oldPassword = document.getElementById('p-old-pass').value;
    const newPassword = document.getElementById('p-new-pass').value;
    
    if (!oldPassword || !newPassword) {
        showCustomAlert("Iltimos, ikkala parolni ham kiriting!");
        return;
    }
    
    if (newPassword.length < 4) {
        showCustomAlert("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak!");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/update-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: APP_DATA.user.username,
                oldPassword,
                newPassword
            })
        });

        const result = await response.json();
        if (result.success) {
            showCustomAlert(result.message);
            document.getElementById('p-old-pass').value = '';
            document.getElementById('p-new-pass').value = '';
            
            // Update local user data
            APP_DATA.user.pass = newPassword;
            
            // Update session
            const session = localStorage.getItem('userSession');
            if (session) {
                const sessionData = JSON.parse(session);
                sessionData.pass = newPassword;
                localStorage.setItem('userSession', JSON.stringify(sessionData));
            }
        } else {
            showCustomAlert(result.message || "Xatolik yuz berdi!");
        }
    } catch (error) {
        console.error("Password change error:", error);
        showCustomAlert("Server bilan bog'lanishda xato!");
    }
}

async function handleAvatarUpload(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
        showCustomAlert("Rasm hajmi 2MB dan oshmasligi kerak!");
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('username', APP_DATA.user.username);

    try {
        const response = await fetch(`${API_BASE}/upload-avatar`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            APP_DATA.user.avatar = result.avatarUrl;
            // Update session if remembered
            const session = localStorage.getItem('userSession');
            if (session) {
                const sessionData = JSON.parse(session);
                sessionData.avatar = result.avatarUrl;
                localStorage.setItem('userSession', JSON.stringify(sessionData));
            }
            showCustomAlert("Rasm muvaffaqiyatli yuklandi!");
            renderProfile(document.getElementById('app-content'));
        } else {
            showCustomAlert("Yuklashda xatolik yuz berdi!");
        }
    } catch (error) {
        console.error("Avatar upload error:", error);
        showCustomAlert("Server bilan bog'lanishda xato: " + error.message);
    }
}

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

// Initial Load & Session Persistence
window.onload = async () => {
    initTheme();

    const loadingScreen = document.getElementById('loading-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    const loginScreenV2 = document.getElementById('login-screen-v2');
    const navbars = document.querySelectorAll('.top-navbar, #bottom-navbar');

    // Force data fetch early to have updated stats if auto-logging in
    await fetchData();

    // Check for existing session
    const savedSession = localStorage.getItem('userSession');
    if (savedSession) {
        try {
            const foundUser = JSON.parse(savedSession);
            
            // Re-sync user data with latest from server (fetchData already called)
            const serverUser = APP_DATA.users.find(u => u.user === (foundUser.user || foundUser.username));
            const userToUse = serverUser || foundUser;

            isAdmin = userToUse.role === 'admin';
            isTeacher = userToUse.role === 'teacher';

            APP_DATA.user = {
                name: userToUse.name,
                class: userToUse.class,
                score: userToUse.score || 0,
                testsTaken: userToUse.testsTaken || 0,
                username: userToUse.user || userToUse.username,
                role: userToUse.role,
                completedTests: userToUse.completedTests || {},
                avatar: userToUse.avatar || '',
                subject: userToUse.subject || ''
            };

            // Show app, hide screens
            if (welcomeScreen) welcomeScreen.classList.add('hidden');
            if (loginScreenV2) loginScreenV2.classList.add('hidden');
            navbars.forEach(el => el.classList.remove('hidden'));

            initSocketListeners();
            updateHeaderScore();
            updateNotifBadge();
            renderBottomNav();
            
            if (isAdmin) currentSection = 'admin';
            else currentSection = 'home';
            renderSection();

            // UI adjustments (profile button)
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
        } catch (e) {
            console.error("Session restore error:", e);
            localStorage.removeItem('userSession');
            if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        }
    } else {
        // No session, show Welcome screen
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (loginScreenV2) loginScreenV2.classList.add('hidden');
        navbars.forEach(nav => nav.classList.add('hidden'));
    }

    // Loading Screen Progress Logic
    const startLoading = () => {
        return new Promise((resolve) => {
            const loadingScreen = document.getElementById('loading-screen');
            const percentText = document.getElementById('loading-percent');
            const progressCircle = document.querySelector('.progress-ring__circle');
            if (!loadingScreen || !percentText || !progressCircle) {
                resolve();
                return;
            }

            const circumference = 2 * Math.PI * 54;
            let progress = 0;
            
            const interval = setInterval(() => {
                // Slower at the end
                const inc = progress > 80 ? 1 : Math.floor(Math.random() * 4) + 2;
                progress += inc;
                
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    
                    percentText.innerText = progress;
                    progressCircle.style.strokeDashoffset = 0;
                    
                    setTimeout(() => {
                        loadingScreen.style.opacity = '0';
                        setTimeout(() => {
                            loadingScreen.style.display = 'none';
                            resolve();
                        }, 800);
                    }, 500);
                } else {
                    percentText.innerText = progress;
                    const offset = circumference - (progress / 100) * circumference;
                    progressCircle.style.strokeDashoffset = offset;
                }
            }, 30);
        });
    };

    // Wait for simulated progress
    await startLoading();

    // Increment visitor count only once per browser session
    if (!sessionStorage.getItem('site_visited')) {
        fetch(`${API_BASE}/visitor`, { method: 'POST' });
        sessionStorage.setItem('site_visited', 'true');
    }

    // Register Service Worker for PWA / offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW registered:', reg.scope);
        }).catch(err => {
            console.warn('SW registration failed:', err);
        });
    }

    // Hide loading screen with fade
    setTimeout(() => {
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 1000);
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