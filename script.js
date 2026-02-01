/* ==========================================================================
   PIXEL WAR STI2D - ULTIMATE EDITION
   Version: 3.1 (Hover Highlight & Dynamic Search)
   ========================================================================== */

const CONFIG = {
    BOARD_SIZE: 150,
    PIXEL_SCALE: 20,
    COOLDOWN_MS: 120000,
    DOUBLE_CLICK_THRESHOLD: 300,
    ADMIN_USER: "noeb",
    
    PALETTE: [
        '#6D001A', '#BE0039', '#FF4500', '#FFA800', '#FFD635', '#FFF8B8',
        '#00A368', '#00CC78', '#7EED56', '#00756F', '#009EAA', '#00CCC0',
        '#2450A4', '#3690EA', '#51E9F4', '#493AC1', '#6A5CFF', '#94B3FF',
        '#811E9F', '#B44AC0', '#E4ABFF', '#DE107F', '#FF3881', '#FF99AA',
        '#6D482F', '#9C6926', '#FFB470', '#000000', '#515252', '#898D90',
        '#D4D7D9', '#FFFFFF'
    ],
    FACTIONS: {
        1: { name: 'TSTI1', color: '#00d2ff', cssClass: 'tsti1' },
        2: { name: 'TSTI2', color: '#ff2a6d', cssClass: 'tsti2' }
    }
};

const state = {
    user: null, userProfile: null, whitelistCache: [],
    camera: { x: 0, y: 0, zoom: 1.5 },
    isDragging: false, lastMouse: { x: 0, y: 0 },
    dragStartTime: 0, dragStartPos: { x: 0, y: 0 },
    
    boardData: {}, selectedColor: CONFIG.PALETTE[2], nextPixelTime: 0,
    
    // Pour le survol (Hover)
    hoverGrid: { x: -1, y: -1 },
    
    // Mode Admin (noeb uniquement)
    adminNoCooldown: false,
    showPixelInfo: false,
    userNamesCache: {}, // Cache des noms d'utilisateurs {uid: username}
    
    // Heartbeat de présence
    presenceHeartbeatInterval: null,

    scoreUpdateTimer: null, renderLoopId: null
};

/* ================= UTILITAIRES TEXTE ================= */
function normalizeName(name) {
    if(!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function prettyName(name) {
    if(!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
}

/* ================= INIT & AUTH ================= */
document.addEventListener('DOMContentLoaded', () => {
    setupAuthUI();
    setupAdminListeners();
    auth.onAuthStateChanged(handleAuthState);
    fetchWhitelist(); // Charge le cache initial
});

async function handleAuthState(user) {
    if (user) {
        try {
            const doc = await firestore.collection('users').doc(user.uid).get();
            if (!doc.exists) { await auth.signOut(); return; }
            state.user = user; state.userProfile = doc.data();
            updateUserInterface(); initGameEngine();
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('register-modal').classList.add('hidden');
            document.getElementById('game-ui').classList.remove('hidden');
            showToast(`Bon retour, ${state.userProfile.username} !`, 'success');
        } catch (e) {
            console.error(e); showAuthError('login-error', "Erreur profil.");
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
        }
    } else {
        document.getElementById('game-ui').classList.add('hidden');
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    }
}

function setupAuthUI() {
    document.getElementById('btn-open-register').onclick = () => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('register-modal').classList.remove('hidden');
    };
    document.getElementById('btn-close-register').onclick = () => {
        document.getElementById('register-modal').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    };

    // FIX: Autocomplétion dynamique avec liste cliquable (À partir de 3 lettres)
    const handleInput = (e) => {
        const val = normalizeName(e.target.value);
        const suggestionsList = document.getElementById('username-suggestions');
        
        // Si moins de 3 lettres, cacher la liste
        if (val.length < 3) {
            suggestionsList.classList.add('hidden');
            document.getElementById('reg-faction-preview').classList.add('hidden');
            return;
        }

        // Filtrer la whitelist locale (prénoms commençant par ou contenant la saisie)
        const matches = state.whitelistCache.filter(u => 
            u.id.startsWith(val) || u.id.includes(val)
        ).sort((a, b) => {
            // Priorité à ceux commençant par
            if (a.id.startsWith(val) && !b.id.startsWith(val)) return -1;
            if (!a.id.startsWith(val) && b.id.startsWith(val)) return 1;
            return a.id.localeCompare(b.id);
        });

        // Afficher la liste de suggestions
        suggestionsList.innerHTML = '';
        if (matches.length > 0) {
            suggestionsList.classList.remove('hidden');
            matches.slice(0, 8).forEach(m => { // Max 8 suggestions
                const opt = document.createElement('div');
                opt.className = 'suggestion-item';
                opt.textContent = prettyName(m.id);
                opt.addEventListener('click', () => {
                    document.getElementById('reg-username').value = prettyName(m.id);
                    suggestionsList.classList.add('hidden');
                    // Mettre à jour le badge faction
                    updateFactionBadge(m);
                });
                suggestionsList.appendChild(opt);
            });
        } else {
            suggestionsList.classList.add('hidden');
        }

        // Détection Exacte pour Faction (affiche en temps réel)
        const user = state.whitelistCache.find(u => u.id === val);
        const badge = document.getElementById('reg-faction-badge');
        const preview = document.getElementById('reg-faction-preview');
        if (user) {
            const f = CONFIG.FACTIONS[user.faction];
            preview.classList.remove('hidden');
            badge.textContent = f.name; badge.className = `faction-tag ${f.cssClass}`;
        } else {
            preview.classList.add('hidden');
        }
    };

    // Fonction pour mettre à jour le badge faction
    window.updateFactionBadge = (user) => {
        const badge = document.getElementById('reg-faction-badge');
        const preview = document.getElementById('reg-faction-preview');
        const f = CONFIG.FACTIONS[user.faction];
        preview.classList.remove('hidden');
        badge.textContent = f.name;
        badge.className = `faction-tag ${f.cssClass}`;
    };

    // Fermer la liste de suggestions quand on clique ailleurs
    document.addEventListener('click', (e) => {
        if (e.target.id !== 'reg-username') {
            document.getElementById('username-suggestions').classList.add('hidden');
        }
    });

    document.getElementById('reg-username').addEventListener('input', handleInput);

    // Register Submit
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawName = document.getElementById('reg-username').value;
        const normName = normalizeName(rawName);
        const pass = document.getElementById('reg-password').value;
        const btn = document.getElementById('btn-register');

        const whitelistedUser = state.whitelistCache.find(u => u.id === normName);
        if (!whitelistedUser) return showAuthError('reg-error', "Prénom non autorisé.");

        setBtnLoading(btn, true);
        try {
            const email = `${normName}@sti2d.pixelwar`;
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await firestore.collection('users').doc(cred.user.uid).set({
                username: prettyName(rawName), username_norm: normName,
                faction: whitelistedUser.faction, pixels_placed: 0,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            showAuthError('reg-error', err.code === 'auth/email-already-in-use' ? "Compte existe déjà." : err.message);
            setBtnLoading(btn, false);
        }
    });

    // Login Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const normName = normalizeName(document.getElementById('login-username').value);
        const pass = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login');
        setBtnLoading(btn, true);
        try {
            await auth.signInWithEmailAndPassword(`${normName}@sti2d.pixelwar`, pass);
        } catch (err) {
            showAuthError('login-error', "Identifiants incorrects.");
            setBtnLoading(btn, false);
        }
    });

    // Suggestions pour le login aussi
    const handleLoginInput = (e) => {
        const val = normalizeName(e.target.value);
        const suggestionsList = document.getElementById('login-suggestions');
        
        // Si moins de 3 lettres, cacher la liste
        if (val.length < 3) {
            suggestionsList.classList.add('hidden');
            return;
        }

        // Filtrer la whitelist locale (prénoms commençant par ou contenant la saisie)
        const matches = state.whitelistCache.filter(u => 
            u.id.startsWith(val) || u.id.includes(val)
        ).sort((a, b) => {
            // Priorité à ceux commençant par
            if (a.id.startsWith(val) && !b.id.startsWith(val)) return -1;
            if (!a.id.startsWith(val) && b.id.startsWith(val)) return 1;
            return a.id.localeCompare(b.id);
        });

        // Afficher la liste de suggestions
        suggestionsList.innerHTML = '';
        if (matches.length > 0) {
            suggestionsList.classList.remove('hidden');
            matches.slice(0, 8).forEach(m => { // Max 8 suggestions
                const opt = document.createElement('div');
                opt.className = 'suggestion-item';
                opt.textContent = prettyName(m.id);
                opt.addEventListener('click', () => {
                    document.getElementById('login-username').value = prettyName(m.id);
                    suggestionsList.classList.add('hidden');
                });
                suggestionsList.appendChild(opt);
            });
        } else {
            suggestionsList.classList.add('hidden');
        }
    };

    // Fermer la liste de suggestions lors du login quand on clique ailleurs
    document.addEventListener('click', (e) => {
        if (e.target.id !== 'login-username') {
            document.getElementById('login-suggestions').classList.add('hidden');
        }
    });

    document.getElementById('login-username').addEventListener('input', handleLoginInput);
}

async function fetchWhitelist() {
    try {
        const snap = await firestore.collection('whitelist').get();
        state.whitelistCache = [];
        snap.forEach(doc => state.whitelistCache.push({ id: doc.id, faction: doc.data().faction }));
        if (!document.getElementById('admin-modal').classList.contains('hidden')) renderAdminUserList();
    } catch (e) { console.warn("Whitelist offline"); }
}

/* ================= ADMIN ================= */
function setupAdminListeners() {
    document.getElementById('btn-close-admin').onclick = () => document.getElementById('admin-modal').classList.add('hidden');
    
    document.getElementById('btn-admin-add').onclick = async () => {
        const nameRaw = document.getElementById('admin-new-name').value;
        const faction = parseInt(document.getElementById('admin-new-faction').value);
        if (!nameRaw) return;
        const nameNorm = normalizeName(nameRaw);
        if (state.whitelistCache.find(u => u.id === nameNorm)) return showToast("Existe déjà", "error");
        
        try {
            await firestore.collection('whitelist').doc(nameNorm).set({
                faction: faction, added_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.getElementById('admin-new-name').value = '';
            showToast(`Ajouté: ${prettyName(nameNorm)}`, "success");
            await fetchWhitelist();
        } catch (e) { showToast("Erreur ajout", "error"); }
    };
}
function openAdminPanel() {
    document.getElementById('admin-modal').classList.remove('hidden');
    // Afficher et initialiser la section admin no cooldown si c'est noeb
    if (state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER) {
        const section = document.getElementById('admin-no-cooldown-section');
        section.classList.add('shown');
        
        // Initialiser le toggle (une seule fois)
        const toggleSwitch = document.getElementById('toggle-admin-nocooldown');
        if (!toggleSwitch.hasListener) {
            toggleSwitch.addEventListener('change', (e) => {
                state.adminNoCooldown = e.target.checked;
                showToast(state.adminNoCooldown ? "Mode admin activé ✓" : "Mode admin désactivé", "success");
            });
            toggleSwitch.hasListener = true;
        }
        
        // Initialiser le toggle "Informations des cases"
        const pixelInfoSection = document.getElementById('admin-pixel-info-section');
        pixelInfoSection.classList.add('shown');
        const pixelInfoToggle = document.getElementById('toggle-pixel-info');
        if (!pixelInfoToggle.hasListener) {
            pixelInfoToggle.addEventListener('change', (e) => {
                state.showPixelInfo = e.target.checked;
                showToast(state.showPixelInfo ? "Infos des cases activées ✓" : "Infos des cases désactivées", "success");
            });
            pixelInfoToggle.hasListener = true;
        }
    }
    renderAdminUserList();
}
function renderAdminUserList() {
    const ul = document.getElementById('admin-user-list'); ul.innerHTML = '';
    [...state.whitelistCache].sort((a,b)=>a.id.localeCompare(b.id)).forEach(u => {
        const li = document.createElement('li');
        const fName = CONFIG.FACTIONS[u.faction]?.name || '?';
        const fColor = CONFIG.FACTIONS[u.faction]?.color || '#fff';
        li.innerHTML = `<span>${prettyName(u.id)} <small style="color:${fColor}">(${fName})</small></span>
            <button class="btn-delete" onclick="window.deleteWhitelistUser('${u.id}')"><i class="ph ph-trash"></i></button>`;
        ul.appendChild(li);
    });
}
window.deleteWhitelistUser = async (id) => {
    if (!confirm(`Supprimer ${prettyName(id)} ?`)) return;
    try { await firestore.collection('whitelist').doc(id).delete(); showToast("Supprimé", "success"); fetchWhitelist(); }
    catch (e) { showToast("Erreur", "error"); }
};

/* ================= MOTEUR JEU ================= */
function initGameEngine() {
    setupPalette();
    state.camera.x = (CONFIG.BOARD_SIZE * CONFIG.PIXEL_SCALE) / 2;
    state.camera.y = (CONFIG.BOARD_SIZE * CONFIG.PIXEL_SCALE) / 2;
    state.camera.zoom = 1.5;
    resizeCanvas(); window.addEventListener('resize', resizeCanvas);
    startRealtimeSync(); setupCanvasInput();
    if (state.renderLoopId) cancelAnimationFrame(state.renderLoopId);
    
    // Afficher le pop-up de bienvenue (déverrouille musique et carte)
    showWelcomePopup();
    
    renderLoop();
}

function showWelcomePopup() {
    const popup = document.getElementById('welcome-popup');
    const btn = document.getElementById('btn-welcome-start');
    
    popup.classList.remove('hidden');
    
    btn.onclick = () => {
        popup.classList.add('hidden');
        // Initialiser l'audio après interaction utilisateur
        initAudio();
        // Démarrer la musique
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (bgMusic) {
            bgMusic.play().catch(() => console.log('Background music playback failed'));
        }
    };
}

function resizeCanvas() {
    const cvs = document.getElementById('gameCanvas'); cvs.width = window.innerWidth; cvs.height = window.innerHeight;
}
function startRealtimeSync() {
    // Charger les pixels existants une seule fois au démarrage
    db.ref('board').once('value', snap => {
        try {
            if (!snap || !snap.exists()) return;
            
            const boardData = snap.val();
            if (!boardData || typeof boardData !== 'object' || Array.isArray(boardData)) return;
            
            let loadedCount = 0;
            for (let key in boardData) {
                if (!boardData.hasOwnProperty(key)) continue;
                
                try {
                    const pixelData = boardData[key];
                    
                    // Vérification stricte: doit être un objet avec les bonnes propriétés
                    if (!pixelData || typeof pixelData !== 'object' || Array.isArray(pixelData)) continue;
                    if (!pixelData.c || !pixelData.f || !pixelData.u) continue;
                    if (typeof pixelData.u !== 'string' || pixelData.u.length === 0) continue;
                    if (typeof pixelData.f !== 'number' || (pixelData.f !== 1 && pixelData.f !== 2)) continue;
                    
                    // Si tout est OK, ajouter le pixel
                    state.boardData[key] = pixelData;
                    loadedCount++;
                    
                    // Déclencher le fetch des noms d'utilisateurs
                    if (state.userNamesCache && typeof state.userNamesCache === 'object') {
                        if (!state.userNamesCache[pixelData.u]) {
                            fetchUserName(pixelData.u);
                        }
                    }
                } catch (pixelErr) {
                    console.warn(`Pixel invalide ${key}:`, pixelErr);
                    continue;
                }
            }
            
            console.log(`Board chargé: ${loadedCount} pixels valides`);
            calculateScores();
        } catch (err) {
            console.error('Erreur loading board:', err);
        }
    }).catch(err => {
        console.error('Erreur lecture board:', err);
    });
    
    // Écouter SEULEMENT les CHANGEMENTS futurs, pas les données existantes
    db.ref('board').on('child_changed', handlePixelUpdate);
    
    db.ref(`users/${state.user.uid}/last_pixel`).on('value', snap => {
        state.nextPixelTime = (snap.val() || 0) + CONFIG.COOLDOWN_MS; updateTimerDisplay();
    });
    
    // Initialiser la présence en ligne
    db.ref('.info/connected').on('value', snap => {
        if(snap.val()) {
            // Configurer le nettoyage automatique à la déconnexion
            db.ref(`status/${state.user.uid}`).onDisconnect().remove();
            // Ajouter la présence initiale avec timestamp
            db.ref(`status/${state.user.uid}`).set(firebase.database.ServerValue.TIMESTAMP);
        }
    });
    
    // Heartbeat toutes les 30 secondes pour maintenir la présence
    state.presenceHeartbeatInterval = setInterval(() => {
        if (state.user && db) {
            db.ref(`status/${state.user.uid}`).set(firebase.database.ServerValue.TIMESTAMP)
                .catch(err => console.warn('Heartbeat failed:', err));
        }
    }, 30000);
    
    // Compter et afficher les utilisateurs en ligne
    db.ref('status').on('value', snap => {
        const onlineCount = snap.numChildren();
        document.getElementById('online-count').textContent = onlineCount;
    });
}
function handlePixelUpdate(snap) {
    try {
        const pixelData = snap.val();
        
        // Vérifier que les données sont valides et bien formées
        if (!pixelData || typeof pixelData !== 'object') return;
        
        // Vérifier qu'on a bien un pixel avec les propriétés requises
        if (!pixelData.c || !pixelData.f || !pixelData.u) return;
        
        // Vérifier que l'UID est une string
        if (typeof pixelData.u !== 'string') return;
        
        // Rejeter si c'est une structure imbriquée (objet contenant plusieurs UIDs)
        if (Array.isArray(pixelData)) return;
        
        // Vérifier que state.boardData existe
        if (!state || !state.boardData || typeof state.boardData !== 'object') return;
        
        state.boardData[snap.key] = pixelData;
        
        if (state.scoreUpdateTimer) clearTimeout(state.scoreUpdateTimer);
        state.scoreUpdateTimer = setTimeout(calculateScores, 200);
        
        // Fetcher le nom de l'utilisateur si présent et pas encore en cache
        if (pixelData.u && typeof pixelData.u === 'string') {
            // Vérifier que userNamesCache existe
            if (state.userNamesCache && typeof state.userNamesCache === 'object') {
                if (!state.userNamesCache[pixelData.u]) {
                    fetchUserName(pixelData.u);
                }
            }
        }
    } catch (err) {
        console.error('Erreur dans handlePixelUpdate:', err);
    }
}

// Fonction pour récupérer et cacher le nom d'un utilisateur
async function fetchUserName(uid) {
    if (!uid || typeof uid !== 'string') return; // Validation stricte
    if (state.userNamesCache[uid]) return; // Déjà en cache
    
    // Mettre une valeur placeholder immédiatement pour déclencher le rendu
    state.userNamesCache[uid] = 'Chargement...';
    
    try {
        const doc = await firestore.collection('users').doc(uid).get();
        if (doc && doc.exists && doc.data) {
            const data = doc.data();
            if (data && data.username) {
                state.userNamesCache[uid] = data.username;
            } else {
                state.userNamesCache[uid] = 'Anonyme';
            }
        } else {
            state.userNamesCache[uid] = 'Supprimé';
        }
    } catch (err) {
        console.warn('Erreur fetch userName:', err);
        state.userNamesCache[uid] = '?';
    }
}

function calculateScores() {
    try {
        let t1 = 0, t2 = 0;
        
        // Vérifier que boardData existe
        if (!state || !state.boardData || typeof state.boardData !== 'object') return;
        
        for (let k in state.boardData) {
            const pixel = state.boardData[k];
            // Vérifier que le pixel existe ET a les propriétés requises
            if (!pixel || typeof pixel !== 'object') continue;
            if (typeof pixel.f !== 'number') continue;
            
            if (pixel.f === 1) t1++;
            else if (pixel.f === 2) t2++;
        }
        
        // Mettre à jour l'affichage
        const el1 = document.getElementById('score-tsti1');
        const el2 = document.getElementById('score-tsti2');
        if (el1) el1.textContent = t1.toLocaleString();
        if (el2) el2.textContent = t2.toLocaleString();
        
        const barEl1 = document.getElementById('bar-tsti1');
        const barEl2 = document.getElementById('bar-tsti2');
        
        const total = t1 + t2;
        if (total > 0 && barEl1 && barEl2) {
            barEl1.style.width = `${(t1/total)*100}%`;
            barEl2.style.width = `${(t2/total)*100}%`;
        }
    } catch (err) {
        console.error('Erreur calculateScores:', err);
    }
}

/* ================= RENDU CANVAS ================= */
function renderLoop() {
    drawGame(); updateTimerDisplay(); state.renderLoopId = requestAnimationFrame(renderLoop);
}
function drawGame() {
    const ctx = document.getElementById('gameCanvas').getContext('2d');
    const cw = ctx.canvas.width; const ch = ctx.canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, cw, ch);
    
    ctx.save();
    ctx.translate(cw / 2, ch / 2); ctx.scale(state.camera.zoom, state.camera.zoom); ctx.translate(-state.camera.x, -state.camera.y);
    
    // Board Background
    const boardPx = CONFIG.BOARD_SIZE * CONFIG.PIXEL_SCALE;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, boardPx, boardPx);
    
    // Pixels
    for (let k in state.boardData) {
        const [gx, gy] = k.split('_').map(Number);
        ctx.fillStyle = state.boardData[k].c;
        ctx.fillRect(gx * CONFIG.PIXEL_SCALE, gy * CONFIG.PIXEL_SCALE, CONFIG.PIXEL_SCALE+0.5, CONFIG.PIXEL_SCALE+0.5);
    }
    
    // FIX: Highlight Hover (Contour Noir Fin sur la case visée)
    if (state.hoverGrid.x >= 0 && state.hoverGrid.x < CONFIG.BOARD_SIZE && 
        state.hoverGrid.y >= 0 && state.hoverGrid.y < CONFIG.BOARD_SIZE) {
        
        ctx.lineWidth = 1; // Trait fin
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; // Noir quasi opaque
        
        // On dessine le contour
        ctx.strokeRect(
            state.hoverGrid.x * CONFIG.PIXEL_SCALE, 
            state.hoverGrid.y * CONFIG.PIXEL_SCALE, 
            CONFIG.PIXEL_SCALE, 
            CONFIG.PIXEL_SCALE
        );
        
        // Afficher les infos du pixel si activé pour noeb
        if (state.showPixelInfo && state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER) {
            try {
                const key = `${state.hoverGrid.x}_${state.hoverGrid.y}`;
                const pixelData = state.boardData[key];
                
                // Vérification stricte
                if (pixelData && typeof pixelData === 'object' && pixelData.u && typeof pixelData.u === 'string') {
                    // Vérifier que userNamesCache existe
                    if (!state.userNamesCache) {
                        state.userNamesCache = {};
                    }
                    
                    // S'assurer que le fetch est déclenché
                    if (!state.userNamesCache[pixelData.u]) {
                        fetchUserName(pixelData.u);
                    }
                    
                    // Récupérer le nom (peut être "Chargement..." ou le vrai nom)
                    const userName = state.userNamesCache[pixelData.u];
                    
                    // Afficher uniquement si le nom est défini et pas vide
                    if (userName && typeof userName === 'string' && userName.length > 0) {
                        // Préparer les informations à afficher
                        let displayLines = [userName];
                        
                        // Ajouter la date si disponible
                        if (pixelData.t && typeof pixelData.t === 'number' && pixelData.t > 0) {
                            try {
                                const date = new Date(pixelData.t);
                                const day = String(date.getDate()).padStart(2, '0');
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const year = date.getFullYear();
                                displayLines.push(`${day}/${month}/${year}`);
                                
                                // Ajouter l'heure
                                const hours = String(date.getHours()).padStart(2, '0');
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                const seconds = String(date.getSeconds()).padStart(2, '0');
                                displayLines.push(`${hours}:${minutes}:${seconds}`);
                            } catch (e) {
                                console.warn('Erreur parsing date:', e);
                            }
                        }
                        
                        ctx.fillStyle = 'rgba(200, 200, 200, 0.9)'; // Fond gris clair
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // Contour noir fin
                        ctx.lineWidth = 0.5 / state.camera.zoom;
                        
                        const fontSize = Math.max(12 / state.camera.zoom, 10);
                        ctx.font = `italic ${fontSize}px 'Inter', sans-serif`;
                        ctx.textAlign = 'center';
                        
                        // Calculer la taille de la boîte en fonction du contenu multi-ligne
                        let maxTextWidth = 0;
                        for (let line of displayLines) {
                            const w = ctx.measureText(line).width;
                            if (w > maxTextWidth) maxTextWidth = w;
                        }
                        
                        const boxPadding = 4 / state.camera.zoom;
                        const boxWidth = maxTextWidth + boxPadding * 2;
                        const lineHeight = fontSize + 2 / state.camera.zoom;
                        const boxHeight = (lineHeight * displayLines.length) + boxPadding * 2;
                        const boxX = state.hoverGrid.x * CONFIG.PIXEL_SCALE + CONFIG.PIXEL_SCALE / 2 - boxWidth / 2;
                        const boxY = state.hoverGrid.y * CONFIG.PIXEL_SCALE - boxHeight - 5 / state.camera.zoom;
                        const borderRadius = 3 / state.camera.zoom;
                        
                        // Dessiner la boîte arrondie
                        ctx.beginPath();
                        ctx.moveTo(boxX + borderRadius, boxY);
                        ctx.lineTo(boxX + boxWidth - borderRadius, boxY);
                        ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + borderRadius);
                        ctx.lineTo(boxX + boxWidth, boxY + boxHeight - borderRadius);
                        ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - borderRadius, boxY + boxHeight);
                        ctx.lineTo(boxX + borderRadius, boxY + boxHeight);
                        ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - borderRadius);
                        ctx.lineTo(boxX, boxY + borderRadius);
                        ctx.quadraticCurveTo(boxX, boxY, boxX + borderRadius, boxY);
                        ctx.closePath();
                        
                        ctx.fill();
                        ctx.stroke();
                        
                        // Texte noir multi-ligne
                        ctx.fillStyle = '#000000';
                        for (let i = 0; i < displayLines.length; i++) {
                            const y = boxY + boxPadding + fontSize + (i * lineHeight);
                            ctx.fillText(displayLines[i], state.hoverGrid.x * CONFIG.PIXEL_SCALE + CONFIG.PIXEL_SCALE / 2, y);
                        }
                    }
                }
            } catch (err) {
                console.error('Erreur lors de l\'affichage des infos du pixel:', err);
            }
        }
    }

    // Grid (Zoomé)
    if (state.camera.zoom > 0.8) {
        ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1/state.camera.zoom;
        for(let i=0; i<=CONFIG.BOARD_SIZE; i++) {
            let p=i*CONFIG.PIXEL_SCALE; ctx.moveTo(p,0); ctx.lineTo(p,boardPx); ctx.moveTo(0,p); ctx.lineTo(boardPx,p);
        }
        ctx.stroke();
    }
    ctx.restore();
}

/* ================= INPUTS ================= */
function setupCanvasInput() {
    const cvs = document.getElementById('gameCanvas');
    cvs.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    cvs.addEventListener('touchstart', e=>{if(e.touches.length===1)onDown(e.touches[0])},{passive:false});
    cvs.addEventListener('touchmove', e=>{e.preventDefault();if(e.touches.length===1)onMove(e.touches[0])},{passive:false});
    cvs.addEventListener('touchend', onUp);
    cvs.addEventListener('wheel', e=>{
        e.preventDefault(); 
        let z = state.camera.zoom - (e.deltaY * 0.001 * state.camera.zoom);
        state.camera.zoom = Math.min(Math.max(0.1, z), 10);
    }, {passive:false});
}
function onDown(e) {
    state.isDragging = true; state.dragStartTime = Date.now();
    state.lastMouse = { x: e.clientX, y: e.clientY }; state.dragStartPos = { x: e.clientX, y: e.clientY };
}
function onMove(e) {
    // FIX: Mise à jour des coordonnées Hover pour le Highlight
    const pos = screenToGrid(e.clientX, e.clientY);
    
    // On met à jour state.hoverGrid si ça change (pour redessiner le carré noir)
    if(pos.x !== state.hoverGrid.x || pos.y !== state.hoverGrid.y) {
        state.hoverGrid = pos;
    }
    
    if(pos.x>=0 && pos.x<CONFIG.BOARD_SIZE && pos.y>=0 && pos.y<CONFIG.BOARD_SIZE) {
        document.getElementById('coords-display').textContent = `X: ${pos.x} | Y: ${pos.y}`;
    }

    if (state.isDragging) {
        state.camera.x -= (e.clientX - state.lastMouse.x) / state.camera.zoom;
        state.camera.y -= (e.clientY - state.lastMouse.y) / state.camera.zoom;
        state.lastMouse = { x: e.clientX, y: e.clientY };
    }
}
function onUp(e) {
    if(!state.isDragging) return; state.isDragging = false;
    const ex = e.clientX || state.lastMouse.x; const ey = e.clientY || state.lastMouse.y;
    if ((Date.now() - state.dragStartTime < CONFIG.DOUBLE_CLICK_THRESHOLD) && Math.hypot(ex-state.dragStartPos.x, ey-state.dragStartPos.y) < 10) {
        handleBoardClick(state.dragStartPos.x, state.dragStartPos.y, e);
    }
}
function screenToGrid(sx, sy) {
    const cvs = document.getElementById('gameCanvas');
    return {
        x: Math.floor(((sx - cvs.width/2)/state.camera.zoom + state.camera.x) / CONFIG.PIXEL_SCALE),
        y: Math.floor(((sy - cvs.height/2)/state.camera.zoom + state.camera.y) / CONFIG.PIXEL_SCALE)
    };
}

/* ================= ACTIONS ================= */
function handleBoardClick(sx, sy, event) {
    // Ignorer le clic droit
    if (event && event.button === 2) return;
    
    const pos = screenToGrid(sx, sy);
    if(pos.x<0||pos.x>=CONFIG.BOARD_SIZE||pos.y<0||pos.y>=CONFIG.BOARD_SIZE) return;
    // Vérifier le cooldown sauf si c'est noeb en mode admin
    if(!state.adminNoCooldown && Date.now() < state.nextPixelTime) return showToast("Attends le cooldown !", "error");
    
    const key = `${pos.x}_${pos.y}`;
    const color = state.selectedColor;
    const fId = state.userProfile.faction;
    
    state.boardData[key] = { c: color, f: fId }; playSound('pop');
    
    const updates = {};
    updates[`board/${key}`] = { c: color, f: fId, u: state.user.uid, t: firebase.database.ServerValue.TIMESTAMP };
    updates[`users/${state.user.uid}/last_pixel`] = firebase.database.ServerValue.TIMESTAMP;
    
    db.ref().update(updates).then(() => {
        showToast(`Pixel posé (${CONFIG.FACTIONS[fId].name})`, "success");
        state.nextPixelTime = Date.now() + CONFIG.COOLDOWN_MS;
    }).catch(() => showToast("Erreur serveur", "error"));
}

/* ================= UI HELPERS ================= */
function updateUserInterface() {
    document.getElementById('display-name').textContent = state.userProfile.username;
    const f = CONFIG.FACTIONS[state.userProfile.faction];
    const b = document.getElementById('my-faction-badge'); b.textContent = f.name; b.className = `faction-mini ${f.class}`;
    if (state.userProfile.username_norm === CONFIG.ADMIN_USER) {
        document.getElementById('btn-admin-panel').classList.remove('hidden');
        document.getElementById('btn-admin-panel').onclick = openAdminPanel;
    }
}
function setupPalette() {
    const grid = document.getElementById('color-grid'); grid.innerHTML = '';
    CONFIG.PALETTE.forEach(c => {
        const d = document.createElement('div'); d.className = 'color-swatch'; d.style.backgroundColor = c;
        if(c===state.selectedColor) d.classList.add('active');
        d.onclick = () => {
            state.selectedColor = c;
            document.querySelectorAll('.color-swatch').forEach(e=>e.classList.remove('active'));
            d.classList.add('active');
            if(window.innerWidth < 768) document.getElementById('palette-container').classList.add('collapsed-mobile');
        };
        grid.appendChild(d);
    });
    document.getElementById('toggle-palette').onclick = () => document.getElementById('palette-container').classList.toggle('collapsed-mobile');
    document.getElementById('btn-logout').onclick = () => {
        // Nettoyer le heartbeat et la présence avant déconnexion
        if (state.presenceHeartbeatInterval) clearInterval(state.presenceHeartbeatInterval);
        if (state.user) db.ref(`status/${state.user.uid}`).remove();
        auth.signOut().then(() => location.reload());
    };
}
function updateTimerDisplay() {
    const diff = state.nextPixelTime - Date.now();
    const box = document.getElementById('cooldown-container');
    const txt = document.getElementById('timer-text');
    if(diff<=0) {
        if(!box.classList.contains('ready')) { box.classList.add('ready'); txt.textContent="PRÊT !"; playSound('ready'); }
    } else {
        box.classList.remove('ready');
        txt.textContent = `${Math.floor(diff/60000)}:${Math.floor((diff%60000)/1000).toString().padStart(2,'0')}`;
    }
}
function showToast(msg, type='info') {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    if(type==='error') el.style.borderLeftColor = '#ff4757'; else if(type==='success') el.style.borderLeftColor = '#2ed573';
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 3000);
}
function showAuthError(id, msg) {
    const el = document.getElementById(id); el.textContent = msg; el.classList.remove('hidden');
}
function setBtnLoading(btn, isLoading) {
    if(isLoading) { btn.dataset.text = btn.innerHTML; btn.innerHTML='<div class="pixel-spinner" style="width:20px;height:20px;margin:0"></div>'; btn.disabled=true; }
    else { btn.innerHTML=btn.dataset.text; btn.disabled=false; }
}

let audioCtx = null;
let popSnd = null;
let bgMusic = null;

function initAudio() {
    if (audioCtx) return; // Déjà initialisé
    
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        popSnd = new Audio('pop.mp3'); 
        popSnd.volume = 0.52;
        bgMusic = new Audio('music.mp3'); 
        bgMusic.volume = 0.15; 
        bgMusic.loop = true;
        console.log('Audio initialized');
    } catch (err) {
        console.error('Erreur init audio:', err);
    }
}

function playSound(type) {
    if (!audioCtx) {
        initAudio();
        if (!audioCtx) return; // Toujours pas d'audio
    }
    
    try {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        
        if(type === 'pop' && popSnd) { 
            popSnd.currentTime = 0; 
            popSnd.play().catch(() => {});
        }
        else if(type === 'ready' && audioCtx) {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.frequency.setValueAtTime(880, audioCtx.currentTime); 
            o.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            g.gain.setValueAtTime(0.1, audioCtx.currentTime); 
            g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            o.connect(g); 
            g.connect(audioCtx.destination); 
            o.start(); 
            o.stop(audioCtx.currentTime + 0.1);
        }
    } catch (err) {
        console.warn('Erreur playSound:', err);
    }
}