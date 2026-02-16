
// --- GLOBAL STATE ---
let courses = [];
let careerPaths = [];
let academyChallenges = [];
let academyMachines = [];
let academyCTF = [];
let userProgress = {}; // { courseId: [completedModuleIndices] }
let userChallenges = []; // [completedChallengeIds]
let userNotes = {};
let currentUser = null;
let activeMemberId = null;
let currentOpenCourse = null;
let currentModuleIdx = null;
let currentTab = 'dashboard';
let ytPlayer = null;
let playerReady = false;
let videoBookmarks = {};
let vmTimerInterval = null;
let metricInterval = null;
const E2B_KEY = "e2b_953f91272ef7ce8ff973e2396c08c8c6d628d0ef";

// --- UTILS ---
function showNotice(title, desc, type) {
    const area = document.getElementById('notification-area');
    if (!area) return;
    const id = `notif-${Date.now()}`;
    const color = type === 'success' ? 'green-500' : type === 'error' ? 'primary' : 'blue-500';
    const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'warning' : 'info';

    const notif = document.createElement('div');
    notif.id = id;
    notif.className = `glass-card p-5 rounded-2xl border-white/10 bg-black/80 backdrop-blur-xl shadow-lg flex items-start gap-4 animate-slideInRight max-w-xs`;
    notif.innerHTML = `
        <span class="material-symbols-rounded text-${color}">${icon}</span>
        <div>
            <h5 class="text-sm font-black text-white uppercase tracking-tighter">${title}</h5>
            <p class="text-[10px] text-gray-400 mt-1">${desc}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-gray-500 hover:text-white ml-auto"><span class="material-symbols-rounded text-sm">close</span></button>
    `;
    area.prepend(notif);
    setTimeout(() => { if (notif) notif.remove(); }, 5000);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// --- AUTH & SYNC ---
async function login() {
    const idInput = document.getElementById('memberId');
    if (!idInput) return;
    const id = idInput.value.trim().toUpperCase();
    if (!id) return;
    const err = document.getElementById('loginError');
    if (err) err.classList.add('hidden');

    try {
        // Wait for Firebase to be ready
        let attempts = 0;
        while (!window.firebaseAcademy && attempts < 20) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        if (!window.firebaseAcademy) throw new Error("Firebase Core Failed to Initialize");

        const { db, collection, query, where, getDocs, onSnapshot, doc } = window.firebaseAcademy;

        // Check for special Admin/Dev bypass
        if (id === 'DEV-OVERRIDE') {
            currentUser = { nickname: "Developer", status: "Approved", photos: [] };
            activeMemberId = "DEV-001";
            finalizeLogin(db, doc, activeMemberId, onSnapshot);
            return;
        }

        const q = query(collection(db, "applications"), where("id", "==", id));
        const snap = await getDocs(q);

        if (!snap.empty) {
            currentUser = snap.docs[0].data();
            if (currentUser.status !== 'Approved') {
                if (err) {
                    err.innerText = "Access Forbidden: Agent Clearance Pending";
                    err.classList.remove('hidden');
                }
                return;
            }
            activeMemberId = id;
            localStorage.setItem('academy_auth_token', id);
            finalizeLogin(db, doc, id, onSnapshot);
        } else {
            if (err) {
                err.innerText = "Unauthorized ID: Access Denied";
                err.classList.remove('hidden');
            }
        }
    } catch (e) {
        console.error(e);
        if (err) {
            err.innerText = "Network Relay Error. Check Connection.";
            err.classList.remove('hidden');
        }
    }
}

async function finalizeLogin(db, doc, id, onSnapshot) {
    // Fetch Mission Content
    await syncContent();

    // Real-time User Data Sync
    if (window.firebaseEnabled && db && doc && id) {
        onSnapshot(doc(db, "academy_data", id), (docSnap) => {
            const data = docSnap.exists() ? docSnap.data() : (JSON.parse(localStorage.getItem(`local_data_${id}`)) || {});
            userProgress = data.progress || {};
            userChallenges = data.challenges || [];
            userNotes = data.notes || {};
            updateDashboardUI();
        }, (error) => {
            console.warn("Realtime Sync Warning:", error);
        });
    } else {
        const local = JSON.parse(localStorage.getItem(`local_data_${id}`)) || {};
        userProgress = local.progress || {};
        userChallenges = local.challenges || [];
        userNotes = local.notes || {};
        updateDashboardUI();
    }

    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';

    const app = document.getElementById('academy-app');
    if (app) {
        app.classList.remove('hidden');
        app.style.display = 'flex';
        switchTab('dashboard');
        checkActiveVM();
    }

    // Auto-load other pages if we are not on index.html
    if (!document.getElementById('dashboard')) {
        // We might be on machines.html or ctf.html
        if (window.location.pathname.includes('machines')) renderMachines();
        if (window.location.pathname.includes('ctf')) renderCTF();
        if (window.location.pathname.includes('writeups')) renderWriteups();
    }
}

function logout() {
    localStorage.removeItem('academy_auth_token');
    location.reload();
}

async function syncContent() {
    const { db, collection, getDocs } = window.firebaseAcademy;
    if (!window.firebaseEnabled) return;

    try {
        console.log("Syncing Content...");

        // Parallel Fetching for Speed
        const [cSnap, pSnap, chalSnap, machSnap, ctfSnap] = await Promise.all([
            getDocs(collection(db, "academy_courses")),
            getDocs(collection(db, "career_paths")),
            getDocs(collection(db, "academy_challenges")),
            getDocs(collection(db, "htb_machines")),
            getDocs(collection(db, "ctf_challenges"))
        ]);

        courses = [];
        cSnap.forEach(d => courses.push({ id: d.id, ...d.data() }));

        careerPaths = [];
        pSnap.forEach(d => careerPaths.push({ id: d.id, ...d.data() }));

        academyChallenges = [];
        chalSnap.forEach(d => academyChallenges.push({ id: d.id, ...d.data() }));

        academyMachines = [];
        machSnap.forEach(d => academyMachines.push({ id: d.id, ...d.data() }));

        academyCTF = [];
        ctfSnap.forEach(d => academyCTF.push({ id: d.id, ...d.data() }));

        console.log(`Synced: ${courses.length} Courses, ${academyMachines.length} Machines, ${academyCTF.length} CTFs`);

    } catch (e) {
        console.warn("Content sync failed.", e);
        showNotice("Sync Warning", "Could not fetch latest intel. Using established protocols.", "error");
    }
}

async function saveAcademyData() {
    if (!activeMemberId) return;
    const { db, doc, setDoc, serverTimestamp } = window.firebaseAcademy;

    let moduleXP = 0;
    Object.values(userProgress).forEach(mods => moduleXP += mods.length * 100);
    let challengeXP = userChallenges.length * 250;
    const totalXP = moduleXP + challengeXP;
    const level = Math.floor(totalXP / 300) + 1;

    const academyData = {
        progress: userProgress,
        challenges: userChallenges,
        notes: userNotes,
        xp: totalXP,
        level: level,
        nickname: currentUser.nickname || "Unknown",
        photo: (currentUser.photos && currentUser.photos[0]) || "",
        lastUpdated: serverTimestamp ? serverTimestamp() : Date.now()
    };

    localStorage.setItem(`local_data_${activeMemberId}`, JSON.stringify(academyData));
    if (window.firebaseEnabled) {
        try {
            await setDoc(doc(db, "academy_data", activeMemberId), academyData, { merge: true });
        } catch (e) { console.warn("Save failed", e); }
    }

    if (window.currentAgentLevel && level > window.currentAgentLevel) {
        if (document.getElementById('newLevelText')) {
            document.getElementById('newLevelText').innerText = `LVL ${level}`;
            document.getElementById('levelUpModal').classList.remove('hidden');
            document.getElementById('levelUpModal').classList.add('flex');
        }
    }
    window.currentAgentLevel = level;
    updateDashboardUI();
}

// --- UI & NAVIGATION ---
window.switchTab = (tabId) => {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white/5', 'text-primary', 'shadow-glow');
        btn.classList.add('text-gray-500');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-white/5', 'text-primary', 'shadow-glow');
        activeBtn.classList.remove('text-gray-500');
    }

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.innerText = tabId.charAt(0).toUpperCase() + tabId.slice(1).replace('rdp', 'Cloud Lab').replace('paths', 'Career Paths') + " Portal";

    if (tabId === 'library') renderLibrary();
    if (tabId === 'ranking') renderRanking();
    if (tabId === 'paths') renderPaths();
    if (tabId === 'challenges') renderChallenges();
};

function updateDashboardUI() {
    if (!currentUser) return;
    // Calculation Logic
    let moduleXP = 0;
    let missionCount = 0;
    Object.keys(userProgress).forEach(cid => {
        const count = userProgress[cid].length;
        moduleXP += count * 100;
        if (count > 0) missionCount++;
    });
    let totalXP = moduleXP + (userChallenges.length * 250);
    let level = Math.floor(totalXP / 300) + 1;
    let xpPct = ((totalXP % 300) / 300) * 100;

    const ranks = ["Script Kiddie", "Tech Junkie", "System Breaker", "Elite Hacker", "Cyber God"];
    const rank = ranks[Math.min(Math.floor((level - 1) / 2), ranks.length - 1)];

    // DOM Updates (Check existence first to avoid errors on diff pages)
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.innerHTML = `Agent <span class="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] ml-2 border border-primary/20">${rank}</span>`;

    const lvlEl = document.getElementById('userLevel');
    if (lvlEl) lvlEl.innerText = `LVL ${level}`;

    const xpBar = document.getElementById('xpBar');
    if (xpBar) xpBar.style.width = xpPct + "%";

    window.currentAgentLevel = level;

    // Profile Stats (Dashboard Only)
    if (document.getElementById('profileLvl')) {
        document.getElementById('profileName').innerText = currentUser.nickname || "Agent";
        document.getElementById('profileID').innerText = activeMemberId;
        document.getElementById('profileLvl').innerText = level;
        document.getElementById('profileXP').innerText = totalXP;
        document.getElementById('profileMissions').innerText = missionCount;
        if (currentUser.photos && currentUser.photos[0]) {
            const ava = document.getElementById('profileAvatar');
            const uAva = document.getElementById('userAvatar');
            if (ava) ava.src = currentUser.photos[0];
            if (uAva) uAva.src = currentUser.photos[0];
        }
    }

    // Enrolled List
    const enrolled = courses.filter(c => userProgress[c.id] && userProgress[c.id].length > 0);
    const dashList = document.getElementById('dashboardCoursesList');
    if (dashList) {
        if (enrolled.length === 0) {
            document.getElementById('emptyDashboard')?.classList.remove('hidden');
            dashList.innerHTML = '';
            const cCourseTitle = document.getElementById('currentCourseTitle');
            if (cCourseTitle) {
                cCourseTitle.innerText = "No Active Operations";
                document.getElementById('progressSection').classList.add('hidden');
            }
        } else {
            document.getElementById('emptyDashboard')?.classList.add('hidden');
            dashList.innerHTML = enrolled.map(c => `
                <div class="glass-card overflow-hidden group border-white/5 cursor-pointer hover:border-primary/20 transition-all" onclick="openCourse('${c.id}')">
                    <div class="h-32 relative">
                        <img src="${c.img || 'logo.png'}" class="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity">
                        <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                        <div class="absolute bottom-4 left-4 right-4">
                            <h4 class="text-white text-[10px] font-black uppercase tracking-widest truncate">${c.title}</h4>
                            <div class="h-1 w-full bg-white/10 rounded-full mt-2 overflow-hidden">
                                <div class="h-full bg-primary shadow-glow" style="width: ${(userProgress[c.id].length / (c.modules ? c.modules.length : 1)) * 100}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

            // Active Track for Banner
            const latest = enrolled[0];
            const cCourseTitle = document.getElementById('currentCourseTitle');
            if (cCourseTitle) {
                cCourseTitle.innerText = latest.title;
                document.getElementById('progressSection').classList.remove('hidden');
                const pct = Math.round((userProgress[latest.id].length / (latest.modules ? latest.modules.length : 1)) * 100);
                document.getElementById('progressPctText').innerText = pct + "%";
                document.getElementById('progressBar').style.width = pct + "%";
            }
        }
    }
}

// --- RENDERERS ---
function renderLibrary() {
    const grid = document.getElementById('fullLibraryGrid');
    if (!grid) return;
    if (courses.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 text-[10px] font-black uppercase p-10">No courses in the network.</div>';
        return;
    }
    grid.innerHTML = courses.map(c => {
        const reqLvl = c.levelRequirement || 1;
        const isLocked = reqLvl > (window.currentAgentLevel || 1);
        const isStarted = userProgress[c.id] && userProgress[c.id].length > 0;
        return `
            <div class="glass-card overflow-hidden group border-white/5 transition-all hover:border-primary/30 ${isLocked ? 'opacity-40 grayscale pointer-events-none' : ''}" onclick="openCourse('${c.id}')">
                <div class="h-44 relative">
                    <img src="${c.img || 'logo.png'}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                    <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>
                    ${isLocked ? `<div class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2"><span class="material-symbols-rounded text-primary text-4xl">lock</span><span class="text-[8px] font-black text-primary uppercase">LVL ${reqLvl} REQUIRED</span></div>` : ''}
                    <div class="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[8px] font-black text-white uppercase tracking-widest">LVL ${reqLvl} REQ</div>
                </div>
                <div class="p-6">
                    <h4 class="text-white font-black text-sm uppercase tracking-tight line-clamp-1">${c.title}</h4>
                    <p class="text-gray-500 text-[10px] font-medium uppercase mt-2 line-clamp-2 leading-relaxed">${c.desc}</p>
                    <button class="mt-4 w-full py-2.5 ${isStarted ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-primary text-white shadow-glow'} rounded-xl text-[8px] font-black uppercase tracking-[0.2em] transition-all">
                        ${isStarted ? 'Resume Operation' : 'Initiate Mission'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderPaths() {
    const grid = document.getElementById('careerPathsGrid');
    if (!grid) return;
    if (careerPaths.length === 0) {
        grid.innerHTML = `<div class="col-span-2 p-20 text-center text-gray-500 uppercase text-[10px] font-black">No neural paths detected.</div>`;
        return;
    }
    grid.innerHTML = careerPaths.map(p => {
        const isLocked = (p.levelRequirement || 1) > (window.currentAgentLevel || 1);
        const pathCourses = p.courses || [];
        const completed = pathCourses.filter(cid => {
            const c = courses.find(cc => cc.id === cid);
            return c && userProgress[cid] && userProgress[cid].length === (c.modules ? c.modules.length : 0);
        }).length;
        const progress = pathCourses.length > 0 ? (completed / pathCourses.length) * 100 : 0;

        return `
            <div class="glass-card p-10 border-white/5 relative group transition-all hover:border-primary/20 ${isLocked ? 'opacity-40 grayscale pointer-events-none' : ''}">
                <div class="flex items-start gap-8">
                    <div class="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:shadow-glow transition-all">
                        <span class="material-symbols-rounded text-5xl">${p.icon || 'security'}</span>
                    </div>
                    <div class="flex-1 space-y-4">
                        <h4 class="text-2xl font-black text-white uppercase tracking-tighter">${p.title}</h4>
                        <p class="text-gray-500 text-xs font-medium uppercase leading-relaxed line-clamp-2">${p.desc}</p>
                        <div class="space-y-2">
                            <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span class="text-primary">${completed}/${pathCourses.length} Modules</span>
                                <span class="text-gray-500">${Math.round(progress)}% Complete</span>
                            </div>
                            <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full bg-primary shadow-glow transition-all duration-1000" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderChallenges() {
    const grid = document.getElementById('challengesGrid');
    if (!grid) return;
    if (academyChallenges.length === 0) {
        grid.innerHTML = `<div class="col-span-4 p-20 text-center text-gray-500 uppercase text-[10px] font-black">No active hacking nodes.</div>`;
        return;
    }
    grid.innerHTML = academyChallenges.map(c => {
        const isDone = userChallenges.includes(c.id);
        const difficultyColor = c.difficulty === 'EASY' ? 'text-green-500' : c.difficulty === 'HARD' ? 'text-primary' : 'text-yellow-500';
        return `
            <div class="glass-card p-6 border-white/5 hover:border-primary/40 transition-all cursor-pointer group ${isDone ? 'opacity-50 grayscale' : ''}" onclick="solveChallenge('${c.id}')">
                <div class="h-36 mb-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center relative overflow-hidden">
                    <span class="material-symbols-rounded text-5xl text-gray-500 group-hover:scale-125 transition-transform duration-500 group-hover:text-primary">${c.icon || 'bug_report'}</span>
                    ${isDone ? '<div class="absolute inset-0 bg-green-500/20 flex items-center justify-center text-green-500 font-black text-[8px] uppercase tracking-widest">CAPTURED</div>' : ''}
                </div>
                <h4 class="text-xs font-black text-white uppercase tracking-tight">${c.title}</h4>
                <div class="flex justify-between mt-4">
                    <span class="text-[9px] font-black text-white/70 uppercase">${c.xp || 200} XP</span>
                    <div class="px-2 py-0.5 rounded-md bg-white/5 text-[8px] font-black ${difficultyColor} uppercase">${c.difficulty || 'MEDIUM'}</div>
                </div>
            </div>
        `;
    }).join('');
}

window.renderMachines = () => {
    const grid = document.getElementById('machinesGrid');
    if (!grid) return;
    if (academyMachines.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 uppercase text-[10px] font-black">No machines deployed.</div>`;
        return;
    }
    grid.innerHTML = academyMachines.map(m => `
        <div class="glass-card p-6 border-white/5 hover:border-primary/40 transition-all cursor-pointer group">
            <div class="flex justify-between items-start mb-4">
                <div class="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl text-white">
                    <span class="material-symbols-rounded">${m.icon || 'computer'}</span>
                </div>
                <span class="px-2 py-1 rounded bg-${m.difficulty === 'Easy' ? 'green' : 'red'}-500/10 text-${m.difficulty === 'Easy' ? 'green' : 'red'}-500 text-[9px] font-black uppercase">${m.difficulty}</span>
            </div>
            <h4 class="text-sm font-black text-white uppercase">${m.name}</h4>
            <p class="text-[10px] text-gray-500 uppercase mt-1">${m.os} • ${m.points} PTS</p>
            <button onclick="createVM('${m.name}')" class="w-full mt-4 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[9px] font-black uppercase hover:bg-primary hover:text-white transition-all">Deploy Instance</button>
        </div>
    `).join('');
};

window.renderCTF = () => {
    const grid = document.getElementById('ctfGrid');
    if (!grid) return;
    if (academyCTF.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 uppercase text-[10px] font-black">No CTF challenges active.</div>`;
        return;
    }
    grid.innerHTML = academyCTF.map(c => `
        <div class="glass-card p-6 border-white/5 hover:border-primary/40 transition-all group">
            <div class="flex justify-between items-start mb-4">
                 <span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">${c.category}</span>
                 <span class="text-[9px] text-primary font-bold uppercase tracking-widest">${c.points} PTS</span>
            </div>
            <h4 class="text-sm font-black text-white uppercase mb-2">${c.name}</h4>
            <p class="text-[10px] text-gray-400 mb-4 line-clamp-2">${c.description}</p>
            <div class="relative">
                <input type="text" placeholder="ENTER FLAG DL{...}" class="w-full bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-[10px] text-white outline-none focus:border-primary transition-all">
                <button onclick="submitFlag(this, '${c.id}', '${c.flag}')" class="absolute right-1 top-1 bottom-1 px-3 bg-white/10 rounded text-[8px] font-black text-white hover:bg-white/20">SUBMIT</button>
            </div>
        </div>
    `).join('');
};

window.submitFlag = (btn, id, realFlag) => {
    const input = btn.previousElementSibling;
    const val = input.value.trim();
    if (val === realFlag) {
        showNotice("CTF CAPTURED", `Flag valid. Points awarded.`, "success");
        // Update user score logic here
        if (!userChallenges.includes(id)) {
            userChallenges.push(id);
            saveAcademyData();
        }
    } else {
        showNotice("INVALID FLAG", "Decryption failed. Try again.", "error");
        input.classList.add('border-primary');
        setTimeout(() => input.classList.remove('border-primary'), 1000);
    }
};

window.solveChallenge = async (id) => {
    if (userChallenges.includes(id)) return;
    const chal = academyChallenges.find(c => c.id === id);
    if (!chal) return;

    userChallenges.push(id);
    await saveAcademyData();
    showNotice("Flag Captured", `Neural link established. +${chal.xp || 100} XP`, "success");
    renderChallenges();
    updateDashboardUI();
};

async function renderRanking() {
    const list = document.getElementById('leaderboardList');
    if (!list) return;
    const { db, collection, getDocs, query, orderBy, limit } = window.firebaseAcademy;
    try {
        const q = query(collection(db, "academy_data"), orderBy("xp", "desc"), limit(20));
        const snap = await getDocs(q);
        let rank = 1;
        list.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            const ranks = ["Script Kiddie", "Tech Junkie", "System Breaker", "Elite Hacker", "Cyber God"];
            const rTitle = ranks[Math.min(Math.floor(((d.level || 1) - 1) / 2), 4)];
            return `
                <tr class="hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                    <td class="px-8 py-6 text-xs font-black text-gray-700">#${rank++}</td>
                    <td class="px-8 py-6">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full border border-primary/20 p-0.5">
                                <img src="${d.photo || 'logo.png'}" class="w-full h-full rounded-full object-cover bg-black">
                            </div>
                            <div>
                                <div class="text-[10px] font-black text-white uppercase">${d.nickname || 'Unknown Agent'}</div>
                                <div class="text-[8px] text-primary uppercase font-bold tracking-widest">${rTitle}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-8 py-6 text-[10px] font-black text-white uppercase tracking-widest">LVL ${d.level || 1}</td>
                    <td class="px-8 py-6 text-right text-xs font-mono text-primary font-black">${(d.xp || 0).toLocaleString()}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.warn(e);
        list.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-gray-600 uppercase text-[10px] font-black">Data fetch error...</td></tr>`;
    }
}

// --- MISSION MODULES ---
window.openCourse = (id) => {
    const c = courses.find(course => course.id === id);
    if (!c) return;
    if ((c.levelRequirement || 1) > (window.currentAgentLevel || 1)) {
        showNotice("Access Forbidden", `High clearance required (LVL ${c.levelRequirement}).`, "error");
        return;
    }

    if (!userProgress[id]) userProgress[id] = [];
    currentOpenCourse = c;
    currentModuleIdx = null;

    document.getElementById('modalCourseTitle').innerText = c.title;
    document.getElementById('modalCourseInstructor').innerText = `Instructor: ${c.instructor || 'Unknown'}`;

    renderCurriculum();
    document.getElementById('courseModal').classList.remove('hidden');
    document.getElementById('courseModal').classList.add('flex');

    // Player Init
    if (ytPlayer) ytPlayer.destroy();
    document.getElementById('customPlayerContainer')?.classList.add('hidden');
    document.getElementById('vPlaceholder')?.classList.remove('hidden');
};

function renderCurriculum() {
    const list = document.getElementById('curriculumList');
    if (!list) return;
    const completed = userProgress[currentOpenCourse.id] || [];
    if (!currentOpenCourse.modules) currentOpenCourse.modules = [];

    list.innerHTML = currentOpenCourse.modules.map((m, i) => `
        <div onclick="loadModule(${i})" class="module-item p-5 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all ${completed.includes(i) ? 'border-primary/40 bg-primary/5' : ''}" id="mod-${i}">
            <span class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-gray-500">${i + 1}</span>
            <div class="flex-1">
                <h5 class="text-[11px] font-black text-white uppercase tracking-tight line-clamp-1">${m.title}</h5>
                <p class="text-[8px] text-gray-500 uppercase mt-1">${completed.includes(i) ? 'ALREADY SYNCED' : 'AWAITING CONNECTION'}</p>
            </div>
        </div>
    `).join('');

    // Certificate Check
    const btn = document.getElementById('downloadCertBtn');
    if (btn) {
        if (completed.length === currentOpenCourse.modules.length && completed.length > 0) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
}

window.loadModule = (idx) => {
    currentModuleIdx = idx;
    const m = currentOpenCourse.modules[idx];
    if (m.vid) initYouTubePlayer(m.vid);

    document.querySelectorAll('.module-item').forEach(el => el.classList.remove('ring-2', 'ring-primary'));
    const el = document.getElementById(`mod-${idx}`);
    if (el) el.classList.add('ring-2', 'ring-primary');

    const btn = document.getElementById('toggleCompleteBtn');
    if (btn) {
        const done = (userProgress[currentOpenCourse.id] || []).includes(idx);
        btn.classList.remove('hidden');
        btn.innerHTML = done ? '<span class="material-symbols-rounded text-sm">verified</span> SYNCED' : '<span class="material-symbols-rounded text-sm">sync</span> MARK AS COMPLETED';
        btn.disabled = done;
    }
};

window.toggleModuleCompletion = async () => {
    if (currentModuleIdx === null) return;
    const cid = currentOpenCourse.id;
    if (!userProgress[cid]) userProgress[cid] = [];
    if (!userProgress[cid].includes(currentModuleIdx)) {
        userProgress[cid].push(currentModuleIdx);
        await saveAcademyData();
        renderCurriculum();
        loadModule(currentModuleIdx);
        showNotice("Data Synced", "Neural progress updated on encrypted servers.", "success");
    }
};

window.closeCourse = () => {
    document.getElementById('courseModal').classList.add('hidden');
    if (ytPlayer) ytPlayer.destroy();
};

// --- YOUTUBE CORE ---
function getYouTubeID(url) {
    if (!url) return null;
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)\??v?=?([^#\&\?]*)).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

function initYouTubePlayer(videoUrl) {
    const videoId = getYouTubeID(videoUrl);
    if (!videoId) {
        showNotice("Error", "Invalid YouTube URL", "error");
        return;
    }
    const ph = document.getElementById('vPlaceholder');
    const pc = document.getElementById('customPlayerContainer');
    if (ph) ph.classList.add('hidden');
    if (pc) pc.classList.remove('hidden');

    document.getElementById('externalLink').href = `https://www.youtube.com/watch?v=${videoId}`;
    if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();

    if (!window.YT) return;

    ytPlayer = new YT.Player('ytPlayer', {
        videoId: videoId,
        host: 'https://www.youtube.com',
        playerVars: { 'autoplay': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0, 'showinfo': 0, 'fs': 0, 'origin': window.location.origin, 'enablejsapi': 1 },
        events: {
            'onReady': () => {
                playerReady = true;
                setInterval(updateVideoTick, 1000);
            },
            'onStateChange': (e) => {
                const btn = document.getElementById('playPauseBtn');
                if (btn) {
                    if (e.data === 1) btn.querySelector('span').innerText = 'pause';
                    else btn.querySelector('span').innerText = 'play_arrow';
                }
            }
        }
    });
}

function updateVideoTick() {
    if (!ytPlayer || !playerReady || !ytPlayer.getCurrentTime) return;
    try {
        const current = ytPlayer.getCurrentTime();
        const duration = ytPlayer.getDuration();
        const pct = (current / duration) * 100;
        const pb = document.getElementById('progressBar');
        const td = document.getElementById('timeDisplay');
        if (pb) pb.style.width = pct + "%";
        if (td) td.innerText = `${formatTime(current)} / ${formatTime(duration)}`;
    } catch (e) { }
}

window.togglePlay = () => { if (ytPlayer) ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo(); };
window.videoSeek = (dir) => { if (ytPlayer) ytPlayer.seekTo(ytPlayer.getCurrentTime() + (dir * 10), true); };

// --- VM MANAGER ---
window.createVM = async (type) => {
    document.getElementById('noVMPlaceholder')?.classList.add('hidden');
    document.getElementById('activeVMDetails')?.classList.remove('hidden');
    addVMActionLog(`[INIT] Deploying ${type.toUpperCase()} node...`);

    try {
        let Sandbox = window.E2BSandbox;
        if (!Sandbox) {
            // Dynamic Import Fallback
            addVMActionLog(`[SYSTEM] Retrying SDK Injection...`);
            try {
                const module = await import("https://esm.sh/@e2b/sdk@0.17.1");
                Sandbox = module.Sandbox;
                window.E2BSandbox = Sandbox;
            } catch (e) { throw new Error("Cloud toolkit unavailable. Check Network."); }
        }

        const sb = await Sandbox.create({ id: 'base', apiKey: E2B_KEY });
        window.currentSandbox = sb;

        const ip = document.getElementById('vmIP');
        if (ip) ip.innerText = sb.id;

        const pass = document.getElementById('vmPass');
        if (pass) pass.innerText = "DL_SECURE_TOKEN";

        const streamUrl = `https://${sb.id}.e2b.dev`;
        const iframe = document.getElementById('e2bStream');
        if (iframe) iframe.src = streamUrl;

        document.getElementById('rdpDisplay')?.classList.remove('hidden');

        startVMTimer(20 * 60);
        startMetricsSim();
        addVMActionLog(`[ONLINE] Instance Live: ${sb.id}`);

    } catch (err) {
        addVMActionLog(`[ERROR] Deployment failed.`);
        showNotice("Sandbox Error", err.message, "error");
    }
};

window.terminateVM = async () => {
    clearInterval(vmTimerInterval);
    clearInterval(metricInterval);
    if (window.currentSandbox) await window.currentSandbox.close();
    document.getElementById('activeVMDetails')?.classList.add('hidden');
    document.getElementById('noVMPlaceholder')?.classList.remove('hidden');
    document.getElementById('rdpDisplay')?.classList.add('hidden');
    if (activeMemberId) {
        const { db, doc, deleteDoc } = window.firebaseAcademy;
        await deleteDoc(doc(db, "academy_vms", activeMemberId));
    }
};

function startVMTimer(sec) {
    let left = sec;
    vmTimerInterval = setInterval(() => {
        left--;
        if (left <= 0) terminateVM();
        const min = Math.floor(left / 60);
        const s = left % 60;
        const timer = document.getElementById('vmTimer');
        if (timer) timer.innerText = `${min}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

function startMetricsSim() {
    metricInterval = setInterval(() => {
        const cpu = Math.random() * 20 + 5;
        const ram = Math.random() * 30 + 10;
        const cm = document.getElementById('cpuMetric');
        const rm = document.getElementById('ramMetric');
        const cb = document.getElementById('cpuBar');
        const rb = document.getElementById('ramBar');
        if (cm) cm.innerText = `${cpu.toFixed(1)}%`;
        if (rm) rm.innerText = `${ram.toFixed(1)}%`;
        if (cb) cb.style.width = cpu + "%";
        if (rb) rb.style.width = ram + "%";
    }, 2000);
}

function addVMActionLog(msg) {
    const log = document.getElementById('vmActionLog');
    if (!log) return;
    const d = document.createElement('div');
    d.innerHTML = `<span class="text-primary">●</span> ${msg}`;
    log.prepend(d);
}

async function checkActiveVM() {
    if (!activeMemberId) return;
    const { db, doc, getDoc } = window.firebaseAcademy;
    const snap = await getDoc(doc(db, "academy_vms", activeMemberId));
    if (snap.exists() && snap.data().expiresAt > Date.now()) {
        const data = snap.data();
        document.getElementById('noVMPlaceholder')?.classList.add('hidden');
        document.getElementById('activeVMDetails')?.classList.remove('hidden');
        document.getElementById('vmIP').innerText = data.sandboxId;
        document.getElementById('e2bStream').src = `https://${data.sandboxId}.e2b.dev`;
        document.getElementById('rdpDisplay').classList.remove('hidden');
        startVMTimer(Math.floor((data.expiresAt - Date.now()) / 1000));
        startMetricsSim();
    }
}

// --- CERTIFICATES ---
window.generateCertificate = () => {
    const canvas = document.getElementById('certCanvas');
    const ctx = canvas.getContext('2d');
    const name = currentUser.nickname || "AGENT";
    const course = currentOpenCourse.title;

    ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, 1200, 800);
    ctx.strokeStyle = "#ff002b"; ctx.lineWidth = 15; ctx.strokeRect(50, 50, 1100, 700);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff002b"; ctx.font = "900 30px Outfit"; ctx.fillText("DEATHLY LEGION ACADEMY", 600, 150);
    ctx.fillStyle = "white"; ctx.font = "300 20px Outfit"; ctx.fillText("DIPLOMA OF COMPLETION", 600, 220);
    ctx.font = "900 80px Outfit"; ctx.fillText(name.toUpperCase(), 600, 380);
    ctx.font = "300 18px Outfit"; ctx.fillText("HAS DEMONSTRATED PROFICIENCY IN", 600, 480);
    ctx.fillStyle = "#ff002b"; ctx.font = "900 50px Outfit"; ctx.fillText(course.toUpperCase(), 600, 560);
    ctx.fillStyle = "#444"; ctx.font = "20px monospace"; ctx.fillText(`AGENT ID: ${activeMemberId} | VERIFIED BY ARCHITECT`, 600, 700);

    const link = document.createElement('a');
    link.download = `LEGION_CERT_${activeMemberId}.png`;
    link.href = canvas.toDataURL();
    link.click();
};

window.closeLevelUp = () => {
    const el = document.getElementById('levelUpModal');
    if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
};

window.toggleNotes = () => {
    const el = document.getElementById('notesPanel');
    if (el.classList.contains('hidden')) el.classList.remove('hidden');
    else el.classList.add('hidden');
};

window.saveNote = () => {
    const txt = document.getElementById('noteInput').value;
    if (activeMemberId && txt) {
        userNotes[currentOpenCourse.id] = txt;
        saveAcademyData();
        showNotice("Saved", "Intel stored.", "success");
        window.toggleNotes();
    }
};

window.toggleQuiz = () => {
    const el = document.getElementById('quizPanel');
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        document.getElementById('quizQuestion').innerText = "Identify the protocol used for secure shell access?";
        document.getElementById('quizOptions').innerHTML = `
            <button onclick="checkQuiz(true)" class="p-4 bg-white/5 hover:bg-white/10 text-left rounded-xl">A) SSH</button>
            <button onclick="checkQuiz(false)" class="p-4 bg-white/5 hover:bg-white/10 text-left rounded-xl">B) TELNET</button>
        `;
    } else {
        el.classList.add('hidden');
    }
};

window.checkQuiz = (correct) => {
    if (correct) {
        document.getElementById('quizContent').classList.add('hidden');
        document.getElementById('quizResult').classList.remove('hidden');
    } else {
        showNotice("Failure", "Incorrect answer.", "error");
    }
};

window.toggleTranscript = () => {
    const el = document.getElementById('transcriptPanel');
    el.classList.toggle('hidden');
};

window.togglePlayerFullscreen = () => {
    const el = document.getElementById('customPlayerContainer');
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
};

// --- INIT ---
window.addEventListener('load', async () => {
    // Enhanced E2B SDK Loading with Retry
    let sdkLoaded = false;
    let retries = 3;

    while (!sdkLoaded && retries > 0) {
        try {
            if (!window.E2BSandbox) {
                console.log('[E2B] Loading SDK...');
                // Dynamic import wrapper to catch network errors
                const module = await import("https://esm.sh/@e2b/sdk@0.17.1");
                window.E2BSandbox = module.Sandbox;
                console.log('[E2B] SDK loaded successfully!');
                sdkLoaded = true;
            } else {
                sdkLoaded = true;
            }
        } catch (e) {
            retries--;
            console.warn(`[E2B] SDK loading attempt failed. Retries left: ${retries}`, e);
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    if (!sdkLoaded) {
        console.error('[E2B] Failed to load SDK after all retries');
        showNotice("Cloud SDK Warning", "Sandbox features may be limited. Check network connection.", "error");
    }

    const token = localStorage.getItem('academy_auth_token');
    if (token) {
        const memEl = document.getElementById('memberId');
        if (memEl) memEl.value = token;
        // Wait briefly for firebase to mount
        setTimeout(() => login(), 500);
    }
});
