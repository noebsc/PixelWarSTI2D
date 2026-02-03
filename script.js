/* ==========================================================================
   PIXEL WAR STI2D - ULTIMATE EDITION
   Version: 3.1 (Hover Highlight & Dynamic Search)
   ========================================================================== */

const CONFIG = {
    BOARD_SIZE: 150,
    PIXEL_SCALE: 20,
    COOLDOWN_MS: 60000,
    CLIENT_VERSION: "V1.4",
    DOUBLE_CLICK_THRESHOLD: 300,
    ADMIN_USER: "noeb",
    
    PALETTE: [
        // Rouges
        '#8B0000', '#6D001A', '#BE0039', '#FF4500', '#FF6B35', '#FF8C42',
        // Oranges
        '#FFA800', '#FFB347', '#FFCC70', '#FFD635', '#FFEB3B', '#FFF8B8',
        // Jaunes
        '#FDD835', '#F9A825', '#F57F17', '#FFC107', '#FFEB3B', '#FFF59D',
        // Verts
        '#00A368', '#00CC78', '#7EED56', '#8BC34A', '#4CAF50', '#388E3C',
        // Cyans
        '#00756F', '#009EAA', '#00CCC0', '#00BCD4', '#00ACC1', '#0097A7',
        // Bleus
        '#2450A4', '#3690EA', '#51E9F4', '#42A5F5', '#2196F3', '#1976D2',
        // Indigos
        '#493AC1', '#6A5CFF', '#5E35B1', '#7E57C2', '#9575CD', '#B39DDB',
        // Violets
        '#811E9F', '#B44AC0', '#E4ABFF', '#9C27B0', '#AB47BC', '#BA68C8',
        // Magentas/Roses
        '#DE107F', '#FF3881', '#FF99AA', '#E91E63', '#F06292', '#F48FB1',
        // Marrons
        '#6D482F', '#9C6926', '#FFB470', '#8D6E63', '#A1887F', '#BCAAA4',
        // Gris/Noirs/Blancs
        '#000000', '#212121', '#424242', '#616161', '#757575', '#9E9E9E',
        '#BDBDBD', '#E0E0E0', '#EEEEEE', '#F5F5F5', '#FAFAFA', '#FFFFFF'
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
    
    // Resynchronisation périodique
    boardSyncInterval: null,
    
    // Couleur persistante
    userColor: null,
    
    // Scoreboard (utilisateurs en ligne)
    onlineUsers: {}, // {uid: {name, faction}}
    showScoreboard: false,
    scoreboardUpdateInterval: null,

    onlineCountUpdateInterval: null,

    lastPixelTs: 0,
    cooldownMsEffective: 60000,
    banExpiresAt: 0,

    versionCheckInterval: null,
    serverSiteVersion: null,
    publicConfigLoaded: false,

    scoreUpdateTimer: null, renderLoopId: null,
    
    // Outil actif (pinceau ou pipette)
    currentTool: 'brush'
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
let __bootstrapped = false;

function bootstrapApp() {
    if (__bootstrapped) return;
    __bootstrapped = true;

    setupAuthUI();
    setupAdminListeners();
    setupGlobalUiListeners();
    setupAdminTabs();
    auth.onAuthStateChanged(handleAuthState);
    fetchWhitelist(); // Charge le cache initial
}

function setupAdminTabs() {
    const modal = document.getElementById('admin-modal');
    if (!modal) return;

    const navItems = [...modal.querySelectorAll('.admin-nav-item')];
    const tabs = [...modal.querySelectorAll('.admin-tab')];
    if (navItems.length === 0 || tabs.length === 0) return;

    const openTab = (tabId) => {
        tabs.forEach(t => {
            if (t.id === tabId) t.classList.remove('hidden');
            else t.classList.add('hidden');
        });
        navItems.forEach(b => {
            if (b.dataset.adminTab === tabId) b.classList.add('active');
            else b.classList.remove('active');
        });
    };

    navItems.forEach(btn => {
        if (btn.hasListener) return;
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.adminTab;
            if (!tabId) return;
            openTab(tabId);
        });
        btn.hasListener = true;
    });

    const defaultTabId = navItems.find(b => b.classList.contains('active'))?.dataset.adminTab || navItems[0].dataset.adminTab;
    if (defaultTabId) openTab(defaultTabId);
}

document.addEventListener('DOMContentLoaded', bootstrapApp);

// Important: si script.js est chargé après DOMContentLoaded (cache busting / injection),
// l'événement ne se déclenche plus. On bootstrap donc immédiatement si le DOM est prêt.
if (document.readyState !== 'loading') {
    bootstrapApp();
}

async function handleAuthState(user) {
    if (user) {
        try {
            const doc = await firestore.collection('users').doc(user.uid).get();
            if (!doc.exists) { await auth.signOut(); return; }
            state.user = user; state.userProfile = doc.data();
            
            // Charger la couleur persistante de l'utilisateur
            const userData = doc.data();
            if (userData.selected_color && CONFIG.PALETTE.includes(userData.selected_color)) {
                state.selectedColor = userData.selected_color;
                state.userColor = userData.selected_color;
            }
            
            updateUserInterface(); initGameEngine();
            await loadPublicConfigOnce();
            startVersionChecks();
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

function setupGlobalUiListeners() {
    const closeBtn = document.getElementById('btn-close-announcement');
    if (closeBtn && !closeBtn.hasListener) {
        closeBtn.addEventListener('click', () => {
            const banner = document.getElementById('announcement-banner');
            if (banner) banner.classList.add('hidden');
        });
        closeBtn.hasListener = true;
    }

    const updateBtn = document.getElementById('btn-force-update');
    if (updateBtn && !updateBtn.hasListener) {
        updateBtn.addEventListener('click', () => forceReloadNoCache());
        updateBtn.hasListener = true;
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

async function renderAdminCurrentVersion() {
    const container = document.getElementById('admin-current-version');
    const input = document.getElementById('admin-site-version');
    if (!container || !input) return;
    
    try {
        const doc = await firestore.collection('config').doc('public').get();
        if (doc.exists) {
            const data = doc.data();
            const serverVersion = data.site_version || CONFIG.CLIENT_VERSION;
            container.innerHTML = `
                <div style="border-left: 4px solid var(--accent); padding-left: 12px;">
                    <h4 style="margin: 0; color: var(--accent); font-size: 18px;">${serverVersion}</h4>
                    <p style="margin: 4px 0 0 0; color: #888; font-size: 12px;">Version serveur</p>
                </div>
            `;
            input.value = serverVersion;
        } else {
            container.innerHTML = `
                <div style="border-left: 4px solid #888; padding-left: 12px;">
                    <h4 style="margin: 0; color: #888; font-size: 18px;">${CONFIG.CLIENT_VERSION}</h4>
                    <p style="margin: 4px 0 0 0; color: #888; font-size: 12px;">Version client (par défaut)</p>
                </div>
            `;
            input.value = CONFIG.CLIENT_VERSION;
        }
    } catch (e) {
        container.innerHTML = '<p style="color: #ff6b6b;">Erreur lors du chargement</p>';
        input.value = CONFIG.CLIENT_VERSION;
    }
}

async function renderAdminCurrentAnnouncement() {
    const container = document.getElementById('admin-current-announcement');
    if (!container) return;
    
    try {
        const doc = await firestore.collection('config').doc('public').get();
        if (doc.exists) {
            const data = doc.data();
            const announcement = data.announcement;
            if (announcement && (announcement.title || announcement.content)) {
                container.innerHTML = `
                    <div style="border-left: 4px solid var(--primary); padding-left: 12px;">
                        ${announcement.title ? `<h4 style="margin: 0 0 8px 0; color: var(--primary);">${announcement.title}</h4>` : ''}
                        ${announcement.content ? `<p style="margin: 0; color: #ddd;">${announcement.content}</p>` : ''}
                    </div>
                `;
            } else {
                container.innerHTML = '<p style="color: #888; font-style: italic;">Aucune annonce publiée</p>';
            }
        } else {
            container.innerHTML = '<p style="color: #888; font-style: italic;">Aucune annonce publiée</p>';
        }
    } catch (e) {
        container.innerHTML = '<p style="color: #ff6b6b;">Erreur lors du chargement</p>';
    }
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

    const publishBtn = document.getElementById('btn-admin-publish-announcement');
    if (publishBtn && !publishBtn.hasListener) {
        publishBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            const title = (document.getElementById('admin-announcement-title')?.value || '').trim();
            const content = (document.getElementById('admin-announcement-content')?.value || '').trim();
            if (!title && !content) return showToast("Annonce vide", "error");
            try {
                await firestore.collection('config').doc('public').set({
                    announcement: {
                        title: title,
                        content: content,
                        updated_at: firebase.firestore.FieldValue.serverTimestamp()
                    }
                }, { merge: true });
                showToast("Annonce publiée", "success");
            } catch (e) {
                showToast("Erreur annonce", "error");
            }
        });
        publishBtn.hasListener = true;
    }

    const deleteBtn = document.getElementById('btn-admin-delete-announcement');
    if (deleteBtn && !deleteBtn.hasListener) {
        deleteBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            try {
                await firestore.collection('config').doc('public').set({
                    announcement: null
                }, { merge: true });
                showToast("Annonce supprimée", "success");
            } catch (e) {
                showToast("Erreur annonce", "error");
            }
        });
        deleteBtn.hasListener = true;
    }

    const saveVersionBtn = document.getElementById('btn-admin-save-version');
    if (saveVersionBtn && !saveVersionBtn.hasListener) {
        saveVersionBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            const v = (document.getElementById('admin-site-version')?.value || '').trim();
            if (!/^V\d+(\.\d+)*$/i.test(v)) return showToast("Format invalide (ex: V1.2)", "error");
            try {
                await firestore.collection('config').doc('public').set({
                    site_version: v
                }, { merge: true });
                showToast("Version sauvegardée", "success");
            } catch (e) {
                showToast("Erreur version", "error");
            }
        });
        saveVersionBtn.hasListener = true;
    }

    const applyBoostBtn = document.getElementById('btn-admin-apply-boost');
    if (applyBoostBtn && !applyBoostBtn.hasListener) {
        applyBoostBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            const target = document.getElementById('admin-boost-target')?.value || 'all';
            const durMin = parseInt(document.getElementById('admin-boost-duration-min')?.value || '0', 10);
            const cdSec = parseInt(document.getElementById('admin-boost-cooldown-sec')?.value || '0', 10);
            if (!durMin || durMin <= 0 || !cdSec || cdSec <= 0) return showToast("Valeurs invalides", "error");
            const expiresAt = Date.now() + (durMin * 60 * 1000);
            const cooldownMs = cdSec * 1000;
            try {
                if (target === 'all') {
                    await db.ref('boosts/global').set({ cooldown_ms: cooldownMs, expires_at: expiresAt });
                } else {
                    await db.ref(`boosts/users/${target}`).set({ cooldown_ms: cooldownMs, expires_at: expiresAt });
                }
                showToast("Boost activé", "success");
            } catch (e) {
                showToast("Erreur boost", "error");
            }
        });
        applyBoostBtn.hasListener = true;
    }

    const removeBoostBtn = document.getElementById('btn-admin-remove-boost');
    if (removeBoostBtn && !removeBoostBtn.hasListener) {
        removeBoostBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            const target = document.getElementById('admin-boost-target')?.value || 'all';
            try {
                if (target === 'all') {
                    await db.ref('boosts/global').remove();
                } else {
                    await db.ref(`boosts/users/${target}`).remove();
                }
                showToast("Boost supprimé", "success");
            } catch (e) {
                showToast("Erreur boost", "error");
            }
        });
        removeBoostBtn.hasListener = true;
    }

    const applyBanBtn = document.getElementById('btn-admin-apply-ban');
    if (applyBanBtn && !applyBanBtn.hasListener) {
        applyBanBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            const uid = document.getElementById('admin-ban-target')?.value || '';
            if (!uid) return showToast("Choisis un joueur", "error");
            const dur = parseInt(document.getElementById('admin-ban-duration')?.value || '0', 10);
            const unit = document.getElementById('admin-ban-unit')?.value || 'minutes';
            if (!dur || dur <= 0) return showToast("Durée invalide", "error");
            const mult = unit === 'weeks' ? 7 * 24 * 60 * 60 * 1000 : unit === 'days' ? 24 * 60 * 60 * 1000 : unit === 'hours' ? 60 * 60 * 1000 : 60 * 1000;
            const expiresAt = Date.now() + (dur * mult);
            try {
                await db.ref(`bans/${uid}`).set({ expires_at: expiresAt });
                showToast("Joueur banni", "success");
            } catch (e) {
                showToast("Erreur ban", "error");
            }
        });
        applyBanBtn.hasListener = true;
    }

    const removeBanBtn = document.getElementById('btn-admin-remove-ban');
    if (removeBanBtn && !removeBanBtn.hasListener) {
        removeBanBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            const uid = document.getElementById('admin-ban-target')?.value || '';
            if (!uid) return showToast("Choisis un joueur", "error");
            try {
                await db.ref(`bans/${uid}`).remove();
                showToast("Joueur débanni", "success");
            } catch (e) {
                showToast("Erreur ban", "error");
            }
        });
        removeBanBtn.hasListener = true;
    }
}
function openAdminPanel() {
    document.getElementById('admin-modal').classList.remove('hidden');
    // Afficher et initialiser la section admin no cooldown si c'est noeb
    if (state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER) {
        const noCooldownSection = document.getElementById('admin-no-cooldown-section');
        if (noCooldownSection) noCooldownSection.classList.add('shown');
        
        const pixelInfoSection = document.getElementById('admin-pixel-info-section');
        if (pixelInfoSection) pixelInfoSection.classList.add('shown');
        
        // Initialiser le toggle (une seule fois)
        const toggleSwitch = document.getElementById('toggle-admin-nocooldown');
        if (!toggleSwitch.hasListener) {
            toggleSwitch.addEventListener('change', (e) => {
                state.adminNoCooldown = e.target.checked;
                showToast(state.adminNoCooldown ? "Mode admin activé ✓" : "Mode admin désactivé", "success");
            });
            toggleSwitch.hasListener = true;
        }
        
        // Afficher l'annonce actuelle
        renderAdminCurrentAnnouncement();
        
        // Afficher la version actuelle
        renderAdminCurrentVersion();
        
        // Initialiser le toggle pour les infos des cases (une seule fois)
        const pixelInfoToggle = document.getElementById('toggle-pixel-info');
        if (pixelInfoToggle && !pixelInfoToggle.hasListener) {
            pixelInfoToggle.addEventListener('change', (e) => {
                state.showPixelInfo = e.target.checked;
                showToast(state.showPixelInfo ? "Infos des cases activées ✓" : "Infos des cases désactivées", "success");
            });
            pixelInfoToggle.hasListener = true;
        }
    }
    renderAdminUserList();
    renderAdminOnlineSelects();
}

function renderAdminOnlineSelects() {
    const boostSelect = document.getElementById('admin-boost-target');
    const banSelect = document.getElementById('admin-ban-target');
    if (!boostSelect || !banSelect) return;

    const currentBoost = boostSelect.value || 'all';
    boostSelect.innerHTML = '<option value="all">Tous les joueurs</option>';
    Object.entries(state.onlineUsers || {}).forEach(([uid, info]) => {
        const opt = document.createElement('option');
        opt.value = uid;
        opt.textContent = info?.name ? info.name : uid;
        boostSelect.appendChild(opt);
    });
    if ([...boostSelect.options].some(o => o.value === currentBoost)) boostSelect.value = currentBoost;

    const currentBan = banSelect.value || '';
    banSelect.innerHTML = '<option value="">Choisir un joueur en ligne</option>';
    Object.entries(state.onlineUsers || {}).forEach(([uid, info]) => {
        const opt = document.createElement('option');
        opt.value = uid;
        opt.textContent = info?.name ? info.name : uid;
        banSelect.appendChild(opt);
    });
    if ([...banSelect.options].some(o => o.value === currentBan)) banSelect.value = currentBan;
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
    setupScoreboardInput();
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
    // Fonction pour charger/resynchroniser la carte complète
    const loadBoardData = () => {
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
                        if (state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER && state.showPixelInfo) {
                            if (state.userNamesCache && typeof state.userNamesCache === 'object') {
                                if (!state.userNamesCache[pixelData.u]) {
                                    fetchUserName(pixelData.u);
                                }
                            }
                        }
                    } catch (pixelErr) {
                        console.warn(`Pixel invalide ${key}:`, pixelErr);
                        continue;
                    }
                }
                
                console.log(`Board resynchronisé: ${loadedCount} pixels valides`);
                calculateScores();
            } catch (err) {
                console.error('Erreur loading board:', err);
            }
        }).catch(err => {
            console.error('Erreur lecture board:', err);
        });
    };
    
    // Charger les pixels existants au démarrage
    loadBoardData();
    
    // Resynchronisation complète toutes les 5 secondes
    if (state.boardSyncInterval) clearInterval(state.boardSyncInterval);
    state.boardSyncInterval = setInterval(loadBoardData, 120000);
    
    // Écouter SEULEMENT les CHANGEMENTS futurs, pas les données existantes
    db.ref('board').off('child_changed', handlePixelUpdate);
    db.ref('board').on('child_changed', handlePixelUpdate);

    db.ref('board').orderByChild('t').startAt(Date.now() - 5000).off('child_added', handlePixelUpdate);
    db.ref('board').orderByChild('t').startAt(Date.now() - 5000).on('child_added', handlePixelUpdate);
    
    db.ref(`users/${state.user.uid}/last_pixel`).on('value', snap => {
        state.lastPixelTs = (snap.val() || 0);
        state.nextPixelTime = state.lastPixelTs + (state.cooldownMsEffective || CONFIG.COOLDOWN_MS);
        updateTimerDisplay();
    });

    db.ref('boosts/global').on('value', snap => {
        state.globalBoost = snap.val() || null;
        recomputeEffectiveCooldown();
    });

    db.ref(`boosts/users/${state.user.uid}`).on('value', snap => {
        state.userBoost = snap.val() || null;
        recomputeEffectiveCooldown();
    });

    db.ref(`bans/${state.user.uid}`).on('value', snap => {
        const ban = snap.val();
        const expiresAt = ban && typeof ban.expires_at === 'number' ? ban.expires_at : 0;
        state.banExpiresAt = expiresAt;
        updateTimerDisplay();
    });
    
    // Initialiser la présence en ligne
    db.ref('.info/connected').on('value', snap => {
        if(snap.val()) {
            // Configurer le nettoyage automatique à la déconnexion
            db.ref(`status/${state.user.uid}`).onDisconnect().remove();
            // Ajouter la présence initiale avec timestamp
            db.ref(`status/${state.user.uid}`).set({
                t: firebase.database.ServerValue.TIMESTAMP,
                n: state.userProfile?.username || 'Joueur',
                f: state.userProfile?.faction || 0
            });
        }
    });
    
    // Heartbeat toutes les 30 secondes pour maintenir la présence
    if (state.presenceHeartbeatInterval) clearInterval(state.presenceHeartbeatInterval);
    state.presenceHeartbeatInterval = setInterval(() => {
        if (state.user && db) {
            db.ref(`status/${state.user.uid}`).update({ t: firebase.database.ServerValue.TIMESTAMP })
                .catch(err => console.warn('Heartbeat failed:', err));
        }
    }, 30000);
    
    // Compter et afficher les utilisateurs en ligne
    const updateOnlineCount = async () => {
        try {
            const snap = await db.ref('status').once('value');
            document.getElementById('online-count').textContent = snap.numChildren();
        } catch (err) {
            console.warn('Erreur updateOnlineCount:', err);
        }
    };
    
    if (state.onlineCountUpdateInterval) clearInterval(state.onlineCountUpdateInterval);
    state.onlineCountUpdateInterval = null;

    db.ref('status').off('value', handleStatusValue);
    db.ref('status').on('value', handleStatusValue);
}

function handleStatusValue(snap) {
    try {
        const data = snap.val() || {};
        const uids = Object.keys(data);
        const el = document.getElementById('online-count');
        if (el) el.textContent = uids.length;

        const newOnlineUsers = {};
        uids.forEach(uid => {
            const v = data[uid];
            if (!v || typeof v !== 'object') return;
            newOnlineUsers[uid] = {
                name: v.n || 'Inconnu',
                faction: v.f || 0
            };
        });

        state.onlineUsers = newOnlineUsers;

        if (state.showScoreboard) {
            renderScoreboard();
        }

        if (!document.getElementById('admin-modal').classList.contains('hidden')) {
            renderAdminOnlineSelects();
        }
    } catch (e) {
        console.warn('Erreur handleStatusValue:', e);
    }
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
            if (state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER && state.showPixelInfo) {
                if (state.userNamesCache && typeof state.userNamesCache === 'object') {
                    if (!state.userNamesCache[pixelData.u]) {
                        fetchUserName(pixelData.u);
                    }
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
    if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER || !state.showPixelInfo) return;
    
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

/* ================= SCOREBOARD ================= */
async function updateOnlineUsersList() {
    if (state.showScoreboard) renderScoreboard();
}

function renderScoreboard() {
    const listContainer = document.getElementById('scoreboard-list');
    if (!listContainer) return;
    
    const sortedUsers = Object.entries(state.onlineUsers).sort((a, b) => {
        return (a[1].name || '').localeCompare((b[1].name || ''), 'fr', { sensitivity: 'base' });
    });
    
    // Vider et reconstruire complètement la liste
    listContainer.innerHTML = '';
    
    if (sortedUsers.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Aucun joueur en ligne</div>';
        return;
    }
    
    // Créer les éléments du classement
    sortedUsers.forEach((entry, index) => {
        const [uid, userData] = entry;
        const factionInfo = CONFIG.FACTIONS[userData.faction];
        const factionClass = factionInfo ? factionInfo.cssClass : '';
        
        const li = document.createElement('div');
        li.className = `scoreboard-item ${factionClass}`;
        li.innerHTML = `
            <div class="scoreboard-item-name">${userData.name}</div>
            <div class="scoreboard-item-faction ${factionClass}">${factionInfo?.name || '?'}</div>
        `;
        
        listContainer.appendChild(li);
    });
}

function toggleScoreboard(show) {
    const container = document.getElementById('scoreboard-container');
    if (!container) return;
    
    state.showScoreboard = show;
    
    if (show) {
        container.classList.remove('hidden');
        // Afficher immédiatement la liste existante (sinon panneau vide si aucune donnée n'a changé)
        renderScoreboard();
        // Puis rafraîchir les données
        updateOnlineUsersList();
    } else {
        container.classList.add('hidden');
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

function setupScoreboardInput() {
    // Afficher/masquer le scoreboard avec la touche Tab
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            toggleScoreboard(true);
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Tab') {
            toggleScoreboard(false);
        }
    });
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
    
    // Mode pipette : récupérer la couleur du pixel
    if (state.currentTool === 'pipette') {
        const key = `${pos.x}_${pos.y}`;
        const pixelData = state.boardData[key];
        
        if (pixelData && pixelData.c) {
            // Récupérer la couleur
            const color = pixelData.c;
            state.selectedColor = color;
            state.userColor = color;
            
            // Sauvegarder la couleur dans Firestore
            firestore.collection('users').doc(state.user.uid).update({
                selected_color: color
            }).catch(err => console.warn('Erreur sauvegarde couleur:', err));
            
            // Mettre à jour l'UI de la palette
            document.querySelectorAll('.color-swatch').forEach(swatch => {
                swatch.classList.remove('active');
                if (swatch.style.backgroundColor === color || 
                    rgbToHex(swatch.style.backgroundColor) === color.toUpperCase()) {
                    swatch.classList.add('active');
                }
            });
            
            // Repasser automatiquement en mode pinceau
            switchTool('brush');
            
            showToast(`Couleur récupérée !`, "success");
            playSound('pop');
        } else {
            showToast("Ce pixel n'a pas de couleur", "error");
        }
        return;
    }
    
    // Mode pinceau normal
    // Vérifier le cooldown sauf si c'est noeb en mode admin
    if (!state.adminNoCooldown && state.banExpiresAt && Date.now() < state.banExpiresAt) {
        return showToast(`Banni: ${formatRemaining(state.banExpiresAt - Date.now())}`, "error");
    }

    if(!state.adminNoCooldown && Date.now() < state.nextPixelTime) return showToast("Attends le cooldown !", "error");
    
    const key = `${pos.x}_${pos.y}`;
    const color = state.selectedColor;
    const fId = state.userProfile.faction;
    
    state.boardData[key] = { c: color, f: fId }; playSound('pop');
    
    const updates = {};
    updates[`board/${key}`] = { c: color, f: fId, u: state.user.uid, t: firebase.database.ServerValue.TIMESTAMP };
    updates[`users/${state.user.uid}/last_pixel`] = firebase.database.ServerValue.TIMESTAMP;
    
    // Incrémenter le compteur de pixels
    updates[`users/${state.user.uid}/pixels_placed`] = firebase.database.ServerValue.increment(1);
    
    db.ref().update(updates).then(() => {
        showToast(`Pixel posé (${CONFIG.FACTIONS[fId].name})`, "success");
        state.nextPixelTime = Date.now() + (state.cooldownMsEffective || CONFIG.COOLDOWN_MS);
    }).catch(() => showToast("Erreur serveur", "error"));
}

// Utilitaire pour convertir RGB en Hex
function rgbToHex(rgb) {
    if (!rgb || rgb.indexOf('rgb') !== 0) return rgb;
    
    const values = rgb.match(/\d+/g);
    if (!values || values.length < 3) return rgb;
    
    const hex = '#' + values.slice(0, 3).map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    
    return hex.toUpperCase();
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
            state.userColor = c;
            // Sauvegarder la couleur dans Firestore
            firestore.collection('users').doc(state.user.uid).update({
                selected_color: c
            }).catch(err => console.warn('Erreur sauvegarde couleur:', err));
            
            document.querySelectorAll('.color-swatch').forEach(e=>e.classList.remove('active'));
            d.classList.add('active');
            if(window.innerWidth < 768) document.getElementById('palette-container').classList.add('collapsed-mobile');
        };
        grid.appendChild(d);
    });
    
    // Initialiser le slider d'outils
    setupToolSlider();
}

function setupToolSlider() {
    const toolOptions = document.querySelectorAll('.tool-option');
    
    toolOptions.forEach(option => {
        option.addEventListener('click', () => {
            const tool = option.dataset.tool;
            switchTool(tool);
        });
    });
}

function switchTool(tool) {
    const toolOptions = document.querySelectorAll('.tool-option');
    const canvasContainer = document.getElementById('canvas-container');
    
    // Mettre à jour l'état
    state.currentTool = tool;
    
    // Mettre à jour l'UI
    toolOptions.forEach(option => {
        if (option.dataset.tool === tool) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Mettre à jour le curseur du canvas
    if (tool === 'pipette') {
        canvasContainer.classList.add('pipette-mode');
    } else {
        canvasContainer.classList.remove('pipette-mode');
    }
}

function setupGlobalUiListeners() {
    const closeBtn = document.getElementById('btn-close-announcement');
    if (closeBtn && !closeBtn.hasListener) {
        closeBtn.addEventListener('click', () => {
            const banner = document.getElementById('announcement-banner');
            if (banner) banner.classList.add('hidden');
        });
        closeBtn.hasListener = true;
    }

    const updateBtn = document.getElementById('btn-force-update');
    if (updateBtn && !updateBtn.hasListener) {
        updateBtn.addEventListener('click', () => forceReloadNoCache());
        updateBtn.hasListener = true;
    }
    
    document.getElementById('toggle-palette').onclick = () => document.getElementById('palette-container').classList.toggle('collapsed-mobile');
    document.getElementById('btn-logout').onclick = () => {
        // Nettoyer tous les intervals et la présence avant déconnexion
        if (state.presenceHeartbeatInterval) clearInterval(state.presenceHeartbeatInterval);
        if (state.boardSyncInterval) clearInterval(state.boardSyncInterval);
        if (state.scoreboardUpdateInterval) clearInterval(state.scoreboardUpdateInterval);
        if (state.onlineCountUpdateInterval) clearInterval(state.onlineCountUpdateInterval);
        if (state.user) db.ref(`status/${state.user.uid}`).remove();
        auth.signOut().then(() => location.reload());
    };
}
function updateTimerDisplay() {
    const diff = state.nextPixelTime - Date.now();
    const box = document.getElementById('cooldown-container');
    const txt = document.getElementById('timer-text');

    if (!state.adminNoCooldown && state.banExpiresAt && Date.now() < state.banExpiresAt) {
        box.classList.remove('ready');
        txt.textContent = `BANNI: ${formatRemaining(state.banExpiresAt - Date.now())}`;
        return;
    }

    if(diff<=0) {
        if(!box.classList.contains('ready')) { box.classList.add('ready'); txt.textContent="PRÊT !"; playSound('ready'); }
    } else {
        box.classList.remove('ready');
        txt.textContent = `${Math.floor(diff/60000)}:${Math.floor((diff%60000)/1000).toString().padStart(2,'0')}`;
    }
}

function formatRemaining(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const w = Math.floor(s / (7 * 24 * 3600));
    const d = Math.floor((s % (7 * 24 * 3600)) / (24 * 3600));
    const h = Math.floor((s % (24 * 3600)) / 3600);
    const m = Math.floor((s % 3600) / 60);

    if (w > 0) return `${w}sem ${d}j`;
    if (d > 0) return `${d}j ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function recomputeEffectiveCooldown() {
    const base = CONFIG.COOLDOWN_MS;
    const now = Date.now();

    let best = null;
    if (state.globalBoost && typeof state.globalBoost === 'object') {
        if (typeof state.globalBoost.expires_at === 'number' && state.globalBoost.expires_at > now && typeof state.globalBoost.cooldown_ms === 'number') {
            best = state.globalBoost.cooldown_ms;
        }
    }

    if (state.userBoost && typeof state.userBoost === 'object') {
        if (typeof state.userBoost.expires_at === 'number' && state.userBoost.expires_at > now && typeof state.userBoost.cooldown_ms === 'number') {
            best = state.userBoost.cooldown_ms;
        }
    }

    state.cooldownMsEffective = best != null ? best : base;

    if (state.lastPixelTs) {
        state.nextPixelTime = state.lastPixelTs + state.cooldownMsEffective;
    }

    updateTimerDisplay();
    updateBoostIndicators();
}

function updateBoostIndicators() {
    const boostReduced = document.getElementById('boost-reduced');
    const boostIncreased = document.getElementById('boost-increased');
    
    if (!boostReduced || !boostIncreased) return;
    
    const baseCooldown = CONFIG.COOLDOWN_MS;
    const currentCooldown = state.cooldownMsEffective;
    
    // Réinitialiser les deux indicateurs
    boostReduced.classList.add('hidden');
    boostIncreased.classList.add('hidden');
    
    // Déterminer quel indicateur afficher
    if (currentCooldown < baseCooldown) {
        // Cooldown réduit (boost joyeux)
        boostReduced.classList.remove('hidden');
        boostReduced.querySelector('.boost-text').textContent = 
            `BOOST ACTIF`;
    } else if (currentCooldown > baseCooldown) {
        // Cooldown augmenté (moins joyeux)
        boostIncreased.classList.remove('hidden');
        boostIncreased.querySelector('.boost-text').textContent = 
            `COOLDOWN AUGMENTÉ`;
    }
}

async function loadPublicConfigOnce() {
    if (state.publicConfigLoaded) return;
    state.publicConfigLoaded = true;
    try {
        const doc = await firestore.collection('config').doc('public').get();
        if (!doc.exists) return;
        const data = doc.data() || {};
        state.serverSiteVersion = data.site_version || null;

        const announcement = data.announcement || null;
        if (announcement && typeof announcement === 'object') {
            const title = (announcement.title || '').toString();
            const content = (announcement.content || '').toString();
            if (title || content) {
                const banner = document.getElementById('announcement-banner');
                const titleEl = document.getElementById('announcement-title');
                const contentEl = document.getElementById('announcement-content');
                if (titleEl) titleEl.textContent = title;
                if (contentEl) contentEl.textContent = content;
                if (banner) banner.classList.remove('hidden');
            }
        }
    } catch (e) {
        console.warn('Public config unavailable');
    }
}

function startVersionChecks() {
    if (state.versionCheckInterval) clearInterval(state.versionCheckInterval);
    state.versionCheckInterval = setInterval(async () => {
        try {
            const doc = await firestore.collection('config').doc('public').get();
            if (!doc.exists) return;
            const data = doc.data() || {};
            const serverV = data.site_version || null;
            if (!serverV) return;
            if (serverV !== CONFIG.CLIENT_VERSION) {
                const modal = document.getElementById('version-update-modal');
                if (modal) modal.classList.remove('hidden');
            }
        } catch (e) {
        }
    }, 180000);
}

function forceReloadNoCache() {
    try {
        // Forcer un rechargement sans cache (équivalent Ctrl+F5)
        window.location.reload(true);
    } catch (e) {
        // Fallback si reload(true) non supporté
        const u = new URL(window.location.href);
        u.searchParams.set('v', Date.now().toString());
        window.location.replace(u.toString());
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
