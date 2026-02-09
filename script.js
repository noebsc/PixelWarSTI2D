/* ==========================================================================
   PIXEL WAR STI2D 
   ========================================================================== */

// Variables Firebase
let auth, db, firestore;

// Initialiser Firebase depuis window
function initFirebase() {
    auth = window.auth;
    db = window.db;
    firestore = window.firestore;
}

// Initialiser Firebase immédiatement
initFirebase();

// Fonction pour mettre à jour le message de chargement
function updateLoadingProgress(message, progress) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

const CONFIG = {
    BOARD_SIZE: 150,
    PIXEL_SCALE: 20,
    COOLDOWN_MS: 60000, // Cooldown pour placer les pixels (60 secondes)
    CHAT_COOLDOWN_MS: 10000, // Cooldown pour le chat (10 secondes)
    CLIENT_VERSION: "V1.6.3",
    DOUBLE_CLICK_THRESHOLD: 300,
    ADMIN_USER: "noeb",
    
    // Temps d'inactivité (en millisecondes)
    INACTIVITY_TAB_TIMEOUT: 30000, // 30 secondes pour onglet inactif/changement d'onglet
    INACTIVITY_MOUSE_TIMEOUT: 300000, // 5 minutes (300 secondes) pour souris inactive
    
    PALETTE: [
        // Triées par ordre HSL parfait (0-360°)
        '#000000', '#212121', '#424242', '#616161', '#757575', '#9E9E9E',
        '#BDBDBD', '#D3D3D3', '#DCDCDC', '#E0E0E0', '#EEEEEE', '#F5F5F5',
        '#FAFAFA', '#FFFFFF', '#8B0000', '#A52A2A', '#B22222',
        '#FF0000', // FLUO Rouge ultra pétant
        '#CD5C5C', '#FF6B6B', '#F08080', '#FFE4E1', '#FA8072', '#FF6347',
        '#BCAAA4', '#E9967A', '#8D6E63', '#A1887F', '#FF6B35', '#FF7F50',
        '#FFA07A', '#A0522D', '#FF8C42',
        '#FF6600', // FLUO Orange vif
        '#6D482F', '#A0826D', '#8B4513', '#D2691E', '#F4A460', '#F57F17',
        '#FFDAB9', '#FFB470', '#FF8C00', '#8B7355', '#DEB887', '#9C6926',
        '#D2B48C', '#BC9A6A', '#FFB347', '#F9A825', '#CDAF7D', '#FFE4B5',
        '#FFCC70', '#FFA500', '#F5DEB3', '#FFA800', '#B8860B', '#DAA520',
        '#FFC107', '#FFD635', '#FDD835', '#FFD700', '#FFEB3B', '#FFF59D',
        '#FFFACD', '#FFFF00',
        '#FFFF33', // FLUO Jaune fluo
        '#FFFFE0', '#ADFF2F', '#8BC34A', '#7EED56', '#228B22', '#32CD32',
        '#00FF00', '#8FBC8F', '#90EE90', '#98FB98', '#4CAF50', '#388E3C',
        '#2E8B57', '#3CB371',
        '#00FF7F', // FLUO Vert fluo
        '#00CC78', '#00A368', '#66CDAA', '#40E0D0', '#00CCC0', '#20B2AA',
        '#00756F', '#48D1CC', '#008B8B', '#00FFFF', '#AFEEEE', '#E0FFFF',
        '#F0FFFF', '#00CED1', '#51E9F4', '#009EAA', '#0097A7', '#00ACC1',
        '#B0E0E6', '#00BCD4', '#00BFFF', '#87CEEB', '#87CEFA',
        '#0099FF', // FLUO Bleu azur
        '#2196F3', '#42A5F5', '#1E90FF', '#1976D2', '#708090', '#778899',
        '#3690EA', '#B0C4DE', '#6495ED', '#2450A4', '#4169E1', '#000080',
        '#191970', '#0000CD', '#E6E6FA', '#6A5CFF', '#493AC1', '#9370DB',
        '#5E35B1',
        '#9966FF', // FLUO Indigo
        '#B39DDB', '#9575CD', '#7E57C2', '#8A2BE2', '#4B0082', '#6A0DAD',
        '#9932CC', '#E4ABFF', '#9400D3', '#811E9F', '#BA55D3', '#9C27B0',
        '#BA68C8', '#AB47BC', '#B44AC0', '#8B008B', '#FF00FF', '#EE82EE',
        '#DDA0DD', '#DA70D6',
        '#FF1493', // FLUO Rose profond
        '#DE107F', '#FF69B4', '#FF3881', '#F8BBD0', '#F06292', '#F48FB1',
        '#FFF0F5', '#BE0039', '#6D001A', '#DC143C', '#FFC0CB', '#FF99AA',
        '#FFB6C1', '#FF4757'
    ],
    FACTIONS: {
        1: { name: 'TSTI1', color: '#00d2ff', cssClass: 'tsti1' },
        2: { name: 'TSTI2', color: '#ff2a6d', cssClass: 'tsti2' }
    }
};

const state = {
    user: null, userProfile: null, whitelistCache: [],
    camera: { x: 0, y: 0, zoom: 1.5, targetZoom: 1.5 },
    isDragging: false, lastMouse: { x: 0, y: 0 },
    dragStartTime: 0, dragStartPos: { x: 0, y: 0 },
    
    // Animation fluide du zoom
    zoomAnimation: null,
    
    // Support du pinch-to-zoom mobile
    touchState: {
        isPinching: false,
        lastDistance: 0,
        initialZoom: 1.5
    },
    
    boardData: {}, selectedColor: CONFIG.PALETTE[2], nextPixelTime: 0,
    
    // Pour le survol (Hover)
    hoverGrid: { x: -1, y: -1 },
    
    // Paramètres utilisateur
    settings: {
        menuOpacity: 80,
        smoothAnimation: true,
        backgroundMusic: true,  // Changé à true par défaut
        soundEffects: true
    },
    
    // Transition fluide du survol
    hoverTransition: {
        currentX: -1,
        currentY: -1,
        targetX: -1,
        targetY: -1,
        animationId: null,
        smoothing: 0.2
    },
    
    // Mode Admin (noeb uniquement)
    adminNoCooldown: false,
    showPixelInfo: false,
    userNamesCache: {}, // Cache des noms d'utilisateurs {uid: username}
    
    // États pour les boosts et bans
    globalBoost: null,
    userBoosts: {},
    activeBans: {},
    
    // Image overlay
    imageOverlay: {
        img: null,
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        visible: false
    },
    
    // Timers et intervals
    renderLoopId: null,
    boardSyncInterval: null,
    onlineCountUpdateInterval: null,
    presenceHeartbeatInterval: null,
    
    // Cooldown effectif
    cooldownMsEffective: CONFIG.COOLDOWN_MS,
    lastPixelTs: 0,
    banExpiresAt: 0,
    
    // Utilisateurs en ligne
    onlineUsers: {}, // {uid: {name, faction}}
    showScoreboard: false,
    scoreboardUpdateInterval: null,

    onlineCountUpdateInterval: null,

    // Heartbeat de présence
    presenceHeartbeatInterval: null,
    
    // Resynchronisation périodique
    boardSyncInterval: null,
    
    // Couleur persistante
    userColor: null,
    
    // Chat system
    chatMessages: [],
    chatCooldown: 0,
    chatMutedUntil: 0,
    chatBannedUntil: 0,
    chatInfractions: 0,
    
    // Inactivity system
    isInactive: false,
    inactivityTimer: null,
    lastActivity: Date.now(),
    renderLoopPaused: false,
    
    // Firebase references for pause/resume
    boardRef: null,
    statusRef: null,
    chatMessagesRef: null,
    chatPunishmentsRef: null,
    lastMessageTimes: [],
    chatMessageCount: 0,
    chatWindowOpen: false,
    lastReadCount: 0,
    
    // Chat punishment update timer (optimisé pour économiser les requêtes)
    chatPunishmentUpdateTimer: null,
    lastChatPunishmentUpdate: 0,
    
    // Local cooldown counter (pas de requêtes Firebase)
    chatCooldownInterval: null,
    
    // Punishment banner refresh timer
    punishmentBannerInterval: null,
    
    // Chat punishments
    activeChatPunishments: {}, // {uid: {type: 'mute'/'ban_chat', expires_at: timestamp}}
    
    // Bad words list (multilingue : 75% FR, 25% EN/DE/ES)
    badWords: [
        // Français (majorité)
        'con', 'connard', 'connasse', 'salope', 'putain', 'merde', 'bite', 'cul', 'chatte',
        'enculé', 'enculer', 'fils de pute', 'fdp', 'ntm', 'ta mère', 'tg', 'batard',
        'trou du cul', 'salaud', 'enculé', 'pute', 'bougnoul', 'negre', 'race',
        'enculer', 'salope', 'connasse', 'connard', 'putain', 'merde', 'bite', 'cul',
        'ntm', 'fdp', 'tg', 'ta mere', 'ta mère', 'fils de pute', 'batard', 'salaud',
        'enculé', 'pute', 'bougnoul', 'negre', 'race', 'trou du cul', 'chiennasse',
        'enculé', 'salaud', 'connard', 'connasse', 'salope', 'pute', 'merde', 'bite',
        'cul', 'chatte', 'enculer', 'ntm', 'fdp', 'tg', 'batard', 'enculé',
        'trou du cul', 'bougnoul', 'negre', 'race', 'chiennasse', 'grossesse',
        'sodomie', 'sodomiser', 'pedophile', 'pedophilie', 'necrophile', 'necrophilie',
        'zoophile', 'zoophilie', 'inceste', 'incestueux', 'incestueuse',
        'viol', 'violeur', 'violeuse', 'violenter', 'agression sexuelle',
        'harcelement sexuel', 'harcèlement sexuel', 'pédophile', 'pédophilie',
        'nazi', 'nazisme', 'hitler', 'ss', 'gestapo', 'klu klux klan', 'kkk',
        'antisémite', 'antisémitisme', 'raciste', 'racisme', 'xénophobe', 'xénophobie',
        'homophobe', 'homophobie', 'transphobe', 'transphobie', 'sexiste', 'sexisme',
        'misogyne', 'misogynie', 'patriarcat', 'féminazi', 'gouine', 'tapette',
        'pd', 'pede', 'hetero', 'brebis', 'hétéro', 'hétérosexuel', 'hétérosexuelle',
        'baise', 'baiser', 'sucer', 'sucette', 'branlette', 'branler', 'masturbateur',
        'masturbation', 'ejaculation', 'éjaculation', 'sperme', 'spermatozoide',
        'testicule', 'testicules', 'vagin', 'vaginale', 'pénis', 'pénien',
        'clitoris', 'clitoridien', 'seins', 'sein', 'nichons', 'seins',
        'cul', 'fesse', 'fesses', 'derrière', 'postérieur', 'anus', 'anal',
        'prostate', 'prostatique', 'uriner', 'urine', 'pipi', 'caca', 'excrément',
        'excréments', 'déjection', 'déjections', 'vomir', 'vomi', 'vomissement',
        'vomissements', 'nausée', 'nausées', 'diarrhée', 'diarrhées', 'constipation',
        'constipé', 'constipée', 'flatulence', 'flatulences', 'gaz', 'gazeux',
        'roter', 'rot', 'pets', 'pet', 'prout', 'prouts', 'vagin', 'vaginale',
        
        // Anglais
        'fuck', 'fucking', 'fucker', 'shit', 'shitty', 'bitch', 'bastard', 'asshole',
        'dick', 'dickhead', 'cock', 'cocksucker', 'pussy', 'cunt', 'twat', 'slut',
        'whore', 'motherfucker', 'son of a bitch', 'bullshit', 'damn', 'goddamn',
        'hell', 'wanker', 'tosser', 'prick', 'knob', 'knobhead', 'arse', 'arsehole',
        'bugger', 'buggery', 'bollocks', 'bollock', 'pillock', 'pillocks', 'git',
        'git', 'git', 'git', 'git', 'git', 'git', 'git', 'git', 'git', 'git',
        
        // Allemand
        'fick', 'ficken', 'ficker', 'scheiße', 'arschloch', 'hure', 'nutte', 'fotze',
        'mist', 'miststück', 'wixer', 'wichser', 'schwanzlutscher', 'schwanz',
        'arsch', 'arschficker', 'fotze', 'fotzen', 'hurensohn', 'bastard',
        'saukerl', 'sauhund', 'schweinehund', 'schwein', 'schlampe', 'schlampen',
        'drecksack', 'dreckskerl', 'fick dich', 'fick dich', 'fick dich',
        
        // Espagnol
        'joder', 'jodete', 'mierda', 'mierdas', 'puta', 'puto', 'hijo de puta',
        'cabrón', 'cabrona', 'coño', 'coñazo', 'polla', 'polvo', 'zorra',
        'maricón', 'marica', 'gilipollas', 'subnormal', 'tonto', 'tonta',
        'pendejo', 'pendeja', 'culiado', 'culiada', 'chinga', 'chingar',
        'pinche', 'pinche', 'pinche', 'pinche', 'pinche', 'pinche',
        
        // Expressions et insultes supplémentaires
        'ntm', 'fdp', 'tg', 'tg', 'tg', 'tg', 'tg', 'tg', 'tg', 'tg',
        'balek', 'dégage', 'casse toi', 'casstoi', 'cass-toi', 'casse-toi',
        'va te faire', 'va te faire voir', 'va te faire foutre', 'allez vous faire',
        'nique ta mère', 'nique ta race', 'nique ta famille', 'nique tes morts',
        'mort aux vaches', 'mort aux bourgeois', 'mort à l\'etat',
        'mort aux juifs', 'mort aux arabes', 'mort aux noirs', 'mort aux blancs',
        'mort aux asiatiques', 'mort aux homosexuels', 'mort aux trans',
        'mort aux handicapés', 'mort aux vieux', 'mort aux enfants',
        'mort aux femmes', 'mort aux hommes', 'mort aux pauvres',
        'mort aux riches', 'mort aux étrangers', 'mort aux immigrés',
        'mort aux réfugiés', 'mort aux demandeurs d\'asile', 'mort aux sans-papiers',
        'mort aux sans-abri', 'mort aux sdf', 'mort aux chômeurs',
        'mort aux étudiants', 'mort aux lycéens', 'mort aux collégiens',
        'mort aux primaires', 'mort aux maternelles', 'mort aux bébés',
        'mort aux nourrissons', 'mort aux foetus', 'mort aux embryons',
        'mort aux ovules', 'mort aux spermatozoïdes', 'mort aux chromosomes',
        'mort aux gènes', 'mort aux adn', 'mort aux cellules', 'mort aux atomes',
        'mort aux molécules', 'mort aux électrons', 'mort aux protons',
        'mort aux neutrons', 'mort aux quarks', 'mort aux particules',
        'mort aux ondes', 'mort aux fréquences', 'mort aux vibrations',
        'mort aux sons', 'mort aux bruits', 'mort aux silences',
        'mort aux musiques', 'mort aux chants', 'mort aux voix',
        'mort aux paroles', 'mort aux mots', 'mort aux lettres',
        'mort aux chiffres', 'mort aux nombres', 'mort aux calculs',
        'mort aux équations', 'mort aux formules', 'mort aux théorèmes',
        'mort aux axiomes', 'mort aux postulats', 'mort aux hypothèses',
        'mort aux expériences', 'mort aux tests', 'mort aux preuves',
        'mort aux démonstrations', 'mort aux raisonnements', 'mort aux logiques',
        'mort aux mathématiques', 'mort aux sciences', 'mort aux savoirs',
        'mort aux connaissances', 'mort aux apprentissages', 'mort aux enseignements',
        'mort aux professeurs', 'mort aux élèves', 'mort aux étudiants',
        'mort aux chercheurs', 'mort aux inventeurs', 'mort aux découvreurs',
        'mort aux explorateurs', 'mort aux aventuriers', 'mort aux voyageurs',
        'mort aux touristes', 'mort aux visiteurs', 'mort aux spectateurs',
        'mort aux auditeurs', 'mort aux lecteurs', 'mort aux écrivains',
        'mort aux poètes', 'mort aux artistes', 'mort aux créateurs',
        'mort aux producteurs', 'mort aux réalisateurs', 'mort aux acteurs',
        'mort aux actrices', 'mort aux musiciens', 'mort aux chanteurs',
        'mort aux chanteuses', 'mort aux danseurs', 'mort aux danseuses',
        'mort aux sportifs', 'mort aux sportives', 'mort aux athlètes',
        'mort aux champions', 'mort aux championnes', 'mort aux gagnants',
        'mort aux gagnantes', 'mort aux perdants', 'mort aux perdantes',
        'mort aux vainqueurs', 'mort aux vainqueuses', 'mort aux vaincus',
        'mort aux vaincues', 'mort aux combattants', 'mort aux combattantes',
        'mort aux soldats', 'mort aux soldates', 'mort aux officiers',
        'mort aux officières', 'mort aux généraux', 'mort aux générales',
        'mort aux commandants', 'mort aux commandantes', 'mort aux leaders',
        'mort aux cheffes', 'mort aux patrons', 'mort aux patronnes',
        'mort aux employés', 'mort aux employées', 'mort aux ouvriers',
        'mort aux ouvrières', 'mort aux artisans', 'mort aux artisanes',
        'mort aux techniciens', 'mort aux techniciennes', 'mort aux ingénieurs',
        'mort aux ingénieures', 'mort aux architectes', 'mort aux architectes',
        'mort aux médecins', 'mort aux médecines', 'mort aux infirmiers',
        'mort aux infirmières', 'mort aux chirurgiens', 'mort aux chirurgiennes',
        'mort aux dentistes', 'mort aux dentistes', 'mort aux pharmaciens',
        'mort aux pharmaciennes', 'mort aux avocats', 'mort aux avocates',
        'mort aux juges', 'mort aux juges', 'mort aux procureurs',
        'mort aux procureures', 'mort aux présidents', 'mort aux présidentes',
        'mort aux ministres', 'mort aux ministres', 'mort aux députés',
        'mort aux députées', 'mort aux sénateurs', 'mort aux sénatrices',
        'mort aux maires', 'mort aux mairesses', 'mort aux conseillers',
        'mort aux conseillères', 'mort aux élus', 'mort aux élues',
        'mort aux citoyens', 'mort aux citoyennes', 'mort aux habitants',
        'mort aux habitantes', 'mort aux résidents', 'mort aux résidentes',
        'mort aux voisins', 'mort aux voisines', 'mort aux amis',
        'mort aux amies', 'mort aux ennemis', 'mort aux ennemies',
        'mort aux alliés', 'mort aux alliées', 'mort aux partenaires',
        'mort aux associés', 'mort aux associées', 'mort aux collègues',
        'mort aux camarades', 'mort aux compagnons', 'mort aux compagnes',
        'mort aux amants', 'mort aux amantes', 'mort aux amoureux',
        'mort aux amoureuses', 'mort aux époux', 'mort aux épouses',
        'mort aux maris', 'mort aux femmes', 'mort aux hommes',
        'mort aux garçons', 'mort aux filles', 'mort aux enfants',
        'mort aux bébés', 'mort aux nourrissons', 'mort aux adolescents',
        'mort aux adolescentes', 'mort aux adultes', 'mort aux personnes âgées',
        'mort aux vieillards', 'mort aux vieilles', 'mort aux seniors',
        'mort aux retraités', 'mort aux retraitées', 'mort aux pensionnés',
        'mort aux pensionnées', 'mort aux chômeurs', 'mort aux chômeuses',
        'mort aux sans-emploi', 'mort aux précaires', 'mort aux précarisés',
        'mort aux précarisées', 'mort aux exclus', 'mort aux exclues',
        'mort aux marginalisés', 'mort aux marginalisées', 'mort aux isolés',
        'mort aux isolées', 'mort aux seuls', 'mort aux seules',
        'mort aux solitaires', 'mort aux solitaires', 'mort aux célibataires',
        'mort aux veufs', 'mort aux veuves', 'mort aux divorcés',
        'mort aux divorcées', 'mort aux séparés', 'mort aux séparées',
        'mort aux orphelins', 'mort aux orphelines', 'mort aux abandonnés',
        'mort aux abandonnées', 'mort aux délaissés', 'mort aux délaissées',
        'mort aux oubliés', 'mort aux oubliées', 'mort aux perdus',
        'mort aux perdues', 'mort aux disparus', 'mort aux disparues',
        'mort aux morts', 'mort aux mortes', 'mort aux vivants',
        'mort aux vivantes', 'mort aux nés', 'mort aux nées',
        'mort aux conçus', 'mort aux conçues', 'mort aux créés',
        'mort aux créées', 'mort aux faits', 'mort aux faites',
        'mort aux produits', 'mort aux produites', 'mort aux fabriqués',
        'mort aux fabriquées', 'mort aux construits', 'mort aux construites',
        'mort aux bâtis', 'mort aux bâties', 'mort aux érigés',
        'mort aux érigées', 'mort aux dressés', 'mort aux dressées',
        'mort aux installés', 'mort aux installées', 'mort aux placés',
        'mort aux placées', 'mort aux posés', 'mort aux posées',
        'mort aux mis', 'mort aux mises', 'mort aux établis',
        'mort aux établies', 'mort aux fondés', 'mort aux fondées',
        'mort aux créés', 'mort aux créées', 'mort aux inventés',
        'mort aux inventées', 'mort aux découverts', 'mort aux découvertes',
        'mort aux trouvées', 'mort aux cherchés', 'mort aux cherchées',
        'mort aux recherchés', 'mort aux recherchées', 'mort aux explorés',
        'mort aux explorées', 'mort aux visités', 'mort aux visitées',
        'mort aux vus', 'mort aux vues', 'mort aux regardés',
        'mort aux regardées', 'mort aux observés', 'mort aux observées',
        'mort aux écoutés', 'mort aux écoutées', 'mort aux entendus',
        'mort aux entendues', 'mort aux perçus', 'mort aux perçues',
        'mort aux sentis', 'mort aux senties', 'mort aux touchés',
        'mort aux touchées', 'mort aux ressentis', 'mort aux ressenties',
        'mort aux éprouvés', 'mort aux éprouvées', 'mort aux subis',
        'mort aux subies', 'mort aux endurés', 'mort aux endurées',
        'mort aux supportés', 'mort aux supportées', 'mort aux tolérés',
        'mort aux tolérées', 'mort aux acceptés', 'mort aux acceptées',
        'mort aux refusés', 'mort aux refusées', 'mort aux rejetés',
        'mort aux rejetées', 'mort aux exclus', 'mort aux exclues',
        'mort aux bannis', 'mort aux bannies', 'mort aux chassés',
        'mort aux chassées', 'mort aux expulsés', 'mort aux expulsées',
        'mort aux évincés', 'mort aux évincées', 'mort aux limogés',
        'mort aux limogées', 'mort aux renvoyés', 'mort aux renvoyées',
        'mort aux licenciés', 'mort aux licenciées', 'mort aux démissionnés',
        'mort aux démissionnées', 'mort aux partis', 'mort aux parties',
        'mort aux sortis', 'mort aux sorties', 'mort aux partis',
        'mort aux parties', 'mort aux absents', 'mort aux absentes',
        'mort aux présents', 'mort aux présentes', 'mort aux ici',
        'mort aux là', 'mort aux partout', 'mort aux nulle part',
        'mort aux quelque part', 'mort aux ailleurs', 'mort aux ailleurs',
        'mort aux ici-bas', 'mort aux là-haut', 'mort aux en bas',
        'mort aux en haut', 'mort aux à gauche', 'mort aux à droite',
        'mort aux devant', 'mort aux derrière', 'mort aux dedans',
        'mort aux dehors', 'mort aux au-delà', 'mort aux en deçà',
        'mort aux toujours', 'mort aux jamais', 'mort aux parfois',
        'mort aux rarement', 'mort aux souvent', 'mort aux quelquefois',
        'mort aux jamais', 'mort aux toujours', 'mort aux maintenant',
        'mort aux autrefois', 'mort aux jadis', 'mort aux naguère',
        'mort aux autrefois', 'mort aux désormais', 'mort aux désormais',
        'mort aux désormais', 'mort aux désormais', 'mort aux désormais'
    ],

    // Chat punishment configuration
    chatPunishmentRules: {
        // Seuils d'infractions pour chaque niveau
        thresholds: {
            warning: 1,      // 1ère infraction = warning
            mute5min: 2,     // 2ème infraction = mute 5min
            mute20min: 3,    // 3ème infraction = mute 20min
            mute1day: 4,     // 4ème infraction = mute 1 jour
            mute1week: 5,    // 5ème infraction = mute 1 semaine
            ban1day: 6,      // 6ème infraction = ban jeu 1 jour
            ban1week: 7,     // 7ème infraction = ban jeu 1 semaine
            banDef: 8        // 8ème infraction = ban définitif
        },
        // Durées en millisecondes
        durations: {
            warning: 0,           // Warning = pas de mute
            mute5min: 5 * 60 * 1000,      // 5 minutes
            mute20min: 20 * 60 * 1000,    // 20 minutes
            mute1day: 24 * 60 * 60 * 1000, // 1 jour
            mute1week: 7 * 24 * 60 * 60 * 1000, // 1 semaine
            muteDef: 0,            // Mute définitif
            ban1day: 24 * 60 * 60 * 1000,   // 1 jour
            ban1week: 7 * 24 * 60 * 60 * 1000, // 1 semaine
            banDef: 0               // Ban définitif
        }
    },

    onlineCountUpdateInterval: null,

    lastPixelTs: 0,
    cooldownMsEffective: 60000,
    banExpiresAt: 0,

    versionCheckInterval: null,
    serverSiteVersion: null,
    publicConfigLoaded: false,

    scoreUpdateTimer: null, renderLoopId: null,
    
    // Outil actif (pinceau ou pipette)
    currentTool: 'brush',
    
    // Import image overlay
    imageOverlay: {
        img: null,
        opacity: 0.5,
        scale: 1.0,
        x: 0,
        y: 0,
        visible: false
    }
};

/* ================= CHAT SYSTEM ================= */
function setupChatSystem() {
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (!chatToggleBtn || !chatWindow || !chatCloseBtn || !chatInput || !chatSendBtn) return;
    
    // Toggle chat window
    chatToggleBtn.addEventListener('click', () => {
        state.chatWindowOpen = !state.chatWindowOpen;
        if (state.chatWindowOpen) {
            chatWindow.classList.add('show');
            chatWindow.classList.remove('hidden');
            chatInput.focus();
            loadChatMessages();
            hideChatNotification(); // Hide notification when opening
        } else {
            chatWindow.classList.remove('show');
            setTimeout(() => chatWindow.classList.add('hidden'), 400);
        }
    });
    
    // Close chat window
    chatCloseBtn.addEventListener('click', () => {
        state.chatWindowOpen = false;
        chatWindow.classList.remove('show');
        setTimeout(() => chatWindow.classList.add('hidden'), 400);
    });
    
    // Send message
    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Listen for chat punishments
    if (state.chatPunishmentsRef) {
        state.chatPunishmentsRef.off('value');
    }
    state.chatPunishmentsRef = db.ref('chat_punishments');
    state.chatPunishmentsRef.on('value', (snapshot) => {
        state.activeChatPunishments = snapshot.val() || {};
        updateChatUI();
    });
    
    // Listen for user's own punishments
    if (state.user) {
        db.ref(`chat_punishments/${state.user.uid}`).on('value', (snapshot) => {
            const punishment = snapshot.val();
            if (punishment && punishment.expires_at > Date.now()) {
                if (punishment.type === 'mute') {
                    state.chatMutedUntil = punishment.expires_at;
                } else if (punishment.type === 'ban_chat') {
                    state.chatBannedUntil = punishment.expires_at;
                }
                // Ne pas appeler updateChatUI() ici, il sera appelé par le listener ci-dessus
            } else if (!punishment) {
                // Si la punishment est supprimée ou expirée
                state.chatMutedUntil = 0;
                state.chatBannedUntil = 0;
            }
            updateChatUI();
        });
    }
    
    // Initial update for existing punishments
    updateChatUI();
    
    // Protection contre le rechargement : enclencher un cooldown automatique (sauf admin)
    const isAdmin = state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER;
    if (!isAdmin) {
        state.chatCooldown = Date.now() + CONFIG.CHAT_COOLDOWN_MS; // 10 secondes de cooldown au chargement
        startLocalCooldownCounter(); // Démarrer le compteur local
    }
}

// Load chat messages
async function loadChatMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    // Check if user is punished before loading messages
    const now = Date.now();
    if (state.chatBannedUntil > now || state.chatMutedUntil > now) {
        // Show access denied message immediately
        const punishmentType = state.chatBannedUntil > now ? 'ban' : 'mute';
        const expiresAt = punishmentType === 'ban' ? state.chatBannedUntil : state.chatMutedUntil;
        const remaining = Math.ceil((expiresAt - now) / (1000 * 60));
        
        // Get punishment details from active punishments
        const userPunishment = state.activeChatPunishments?.[state.user?.uid];
        const reason = userPunishment?.reason || 'Non spécifié';
        const infractions = userPunishment?.infractions || 0;
        
        messagesContainer.innerHTML = `
            <div class="chat-punishment-banner ${punishmentType}">
                <div class="punishment-icon">${punishmentType === 'ban' ? '🚫' : '🔇'}</div>
                <div class="punishment-title">${punishmentType === 'ban' ? 'Banni du chat' : 'Muet du chat'}</div>
                <div class="punishment-reason">Raison: ${reason}</div>
                <div class="punishment-duration">Temps restant: ${remaining} minute${remaining > 1 ? 's' : ''}</div>
                <div class="punishment-details">Infractions: ${infractions}</div>
                <div class="punishment-expires">Expire: ${new Date(expiresAt).toLocaleString('fr-FR')}</div>
            </div>
        `;
        
        // Add gray overlay to chat
        messagesContainer.classList.add('chat-punished');
        
        // Démarrer le timer d'actualisation de la bannière
        startPunishmentBannerRefresh();
        return;
    }
    
    // Remove gray overlay if not punished
    messagesContainer.classList.remove('chat-punished');
    
    // Arrêter le timer d'actualisation si plus puni
    stopPunishmentBannerRefresh();
    
    const messagesRef = db.ref('chat').orderByChild('timestamp').limitToLast(100);
    
    // Stocker la référence pour pouvoir la mettre en pause
    if (state.chatMessagesRef) {
        state.chatMessagesRef.off('value');
    }
    state.chatMessagesRef = messagesRef;
    
    messagesRef.on('value', (snapshot) => {
        // Double-check punishment status in real-time
        const currentNow = Date.now();
        if (state.chatBannedUntil > currentNow || state.chatMutedUntil > currentNow) {
            // Stop listening if user became punished
            messagesRef.off('value');
            renderChatMessages(); // Will show punishment banner
            return;
        }
        
        state.chatMessages = [];
        snapshot.forEach((childSnapshot) => {
            state.chatMessages.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Check for new messages while chat was closed
        if (!state.chatWindowOpen && state.chatMessages.length > state.lastReadCount) {
            showChatNotification();
        }
        
        renderChatMessages();
    });
}

// Show notification indicator
function showChatNotification() {
    const notification = document.getElementById('chat-notification');
    if (notification) {
        notification.classList.remove('hidden');
    }
}

// Hide notification indicator
function hideChatNotification() {
    const notification = document.getElementById('chat-notification');
    if (notification) {
        notification.classList.add('hidden');
    }
    state.lastReadCount = state.chatMessages.length;
}

// Update chat UI (cooldown, status, etc.)
function updateChatUI() {
    const cooldownDisplay = document.getElementById('chat-cooldown-display');
    const statusDisplay = document.getElementById('chat-status-display');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (!cooldownDisplay || !statusDisplay || !chatInput || !chatSendBtn) return;
    
    const isAdmin = state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER;
    const now = Date.now();
    
    // Reset displays
    cooldownDisplay.textContent = '';
    statusDisplay.textContent = '';
    statusDisplay.className = 'chat-status-display';
    
    // Check bans and mutes
    if (state.chatBannedUntil > now) {
        const remaining = Math.ceil((state.chatBannedUntil - now) / (1000 * 60));
        statusDisplay.textContent = `🚫 Banni du chat pour ${remaining} minute${remaining > 1 ? 's' : ''}`;
        statusDisplay.classList.add('banned');
        chatInput.disabled = true;
        chatSendBtn.disabled = true;
        chatInput.style.opacity = '0.5';
        stopLocalCooldownCounter();
    } else if (state.chatMutedUntil > now) {
        const remaining = Math.ceil((state.chatMutedUntil - now) / (1000 * 60));
        statusDisplay.textContent = `🔇 Muet pour ${remaining} minute${remaining > 1 ? 's' : ''} (langage inapproprié)`;
        statusDisplay.classList.add('muted');
        chatInput.disabled = true;
        chatSendBtn.disabled = true;
        chatInput.style.opacity = '0.5';
        stopLocalCooldownCounter();
    } else if (!isAdmin && state.chatCooldown > now) {
        // Démarrer le compteur local pour le cooldown
        startLocalCooldownCounter();
    } else {
        cooldownDisplay.textContent = '';
        statusDisplay.textContent = '';
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatInput.style.opacity = '1';
        stopLocalCooldownCounter();
    }
}

// Compteur local pour le cooldown (pas de requêtes Firebase)
function startLocalCooldownCounter() {
    // Arrêter le compteur existant
    stopLocalCooldownCounter();
    
    const cooldownDisplay = document.getElementById('chat-cooldown-display');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (!cooldownDisplay) return;
    
    state.chatCooldownInterval = setInterval(() => {
        const now = Date.now();
        const isAdmin = state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER;
        
        if (isAdmin || state.chatCooldown <= now) {
            cooldownDisplay.textContent = '';
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.style.opacity = '1';
            stopLocalCooldownCounter();
            return;
        }
        
        const remaining = Math.ceil((state.chatCooldown - now) / 1000);
        cooldownDisplay.textContent = `⏱️ Prochain message dans ${remaining}s`;
        cooldownDisplay.style.color = 'white';
        chatInput.disabled = false;
        chatSendBtn.disabled = true;
        chatInput.style.opacity = '1';
    }, 1000); // Actualisation chaque seconde
}

// Timer d'actualisation de la bannière de punition
function startPunishmentBannerRefresh() {
    // Arrêter le timer existant
    stopPunishmentBannerRefresh();
    
    state.punishmentBannerInterval = setInterval(() => {
        const now = Date.now();
        
        // Vérifier si l'utilisateur est encore puni
        if (state.chatBannedUntil <= now && state.chatMutedUntil <= now) {
            // Plus puni, arrêter le timer et recharger les messages
            stopPunishmentBannerRefresh();
            loadChatMessages();
            return;
        }
        
        // Actualiser la bannière
        renderChatMessages();
    }, 5000); // Actualisation toutes les 5 secondes
}

function stopPunishmentBannerRefresh() {
    if (state.punishmentBannerInterval) {
        clearInterval(state.punishmentBannerInterval);
        state.punishmentBannerInterval = null;
    }
}

function stopLocalCooldownCounter() {
    if (state.chatCooldownInterval) {
        clearInterval(state.chatCooldownInterval);
        state.chatCooldownInterval = null;
    }
}

function renderChatMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const now = Date.now();
    
    // Check if user is punished and show punishment banner
    if (state.chatBannedUntil > now || state.chatMutedUntil > now) {
        const punishmentType = state.chatBannedUntil > now ? 'ban' : 'mute';
        const expiresAt = punishmentType === 'ban' ? state.chatBannedUntil : state.chatMutedUntil;
        const remaining = Math.ceil((expiresAt - now) / (1000 * 60));
        
        // Get punishment details from active punishments
        const userPunishment = state.activeChatPunishments?.[state.user?.uid];
        const reason = userPunishment?.reason || 'Non spécifié';
        const infractions = userPunishment?.infractions || 0;
        
        messagesContainer.innerHTML = `
            <div class="chat-punishment-banner ${punishmentType}">
                <div class="punishment-icon">${punishmentType === 'ban' ? '🚫' : '🔇'}</div>
                <div class="punishment-title">${punishmentType === 'ban' ? 'Banni du chat' : 'Muet du chat'}</div>
                <div class="punishment-reason">Raison: ${reason}</div>
                <div class="punishment-duration">Temps restant: ${remaining} minute${remaining > 1 ? 's' : ''}</div>
                <div class="punishment-details">Infractions: ${infractions}</div>
                <div class="punishment-expires">Expire: ${new Date(expiresAt).toLocaleString('fr-FR')}</div>
            </div>
        `;
        
        // Add gray overlay to chat
        messagesContainer.classList.add('chat-punished');
        
        // Démarrer le timer d'actualisation de la bannière
        startPunishmentBannerRefresh();
        return;
    }
    
    // Remove gray overlay if not punished
    messagesContainer.classList.remove('chat-punished');
    
    // Arrêter le timer d'actualisation si plus puni
    stopPunishmentBannerRefresh();
    
    // If not punished, check for messages
    if (state.chatMessages.length === 0) {
        messagesContainer.innerHTML = '<div class="chat-loading">Aucun message pour le moment</div>';
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    // Vérifier s'il y a plus de 100 messages et ajouter un message de suppression
    const hasOldMessages = state.chatMessages.length > 100;
    
    state.chatMessages.forEach((msg, index) => {
        // N'afficher que les 100 derniers messages
        if (index >= state.chatMessages.length - 100) {
            const messageDiv = createChatMessageElement(msg);
            messagesContainer.appendChild(messageDiv);
        }
    });
    
    // Afficher un message si des anciens messages ont été supprimés
    if (hasOldMessages) {
        const oldMessagesDiv = document.createElement('div');
        oldMessagesDiv.className = 'chat-old-messages-notice';
        oldMessagesDiv.innerHTML = '📝 Messages plus anciens supprimés (conservation des 100 derniers)';
        messagesContainer.insertBefore(oldMessagesDiv, messagesContainer.firstChild);
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createChatMessageElement(msg) {
    const messageDiv = document.createElement('div');
    
    // Add special class for system messages
    if (msg.isSystemMessage) {
        messageDiv.className = 'chat-message system-message';
    } else {
        messageDiv.className = 'chat-message';
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    // Check if message is from current user or system
    const isCurrentUser = state.user && msg.uid === state.user.uid;
    const isSystem = msg.isSystemMessage || msg.uid === 'system';
    
    let userName = msg.author;
    let adminTag = '';
    
    // Don't show admin tag for system messages
    if (!isSystem && userName === CONFIG.ADMIN_USER) {
        adminTag = '<span class="chat-admin-tag">[ADMIN]</span> ';
    }
    
    // Create delete button for admin only (not for system messages)
    const currentUserIsAdmin = state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER;
    const deleteButton = currentUserIsAdmin && !isSystem ? `
        <button class="chat-delete-btn" onclick="deleteChatMessage('${msg.id}')" title="Supprimer le message">
            <i class="ph ph-trash"></i>
        </button>
    ` : '';
    
    messageDiv.innerHTML = `
        <div class="chat-message-line">
            ${deleteButton}
            <span class="chat-time-badge">${time}</span>
            <span class="chat-message-author ${isSystem ? 'system-author' : ''}">${adminTag}${userName}:</span>
            <span class="chat-message-content ${isSystem ? 'system-content' : ''}">${msg.content}</span>
        </div>
    `;
    
    return messageDiv;
}

// Fonction pour supprimer un message du chat (admin uniquement)
async function deleteChatMessage(messageId) {
    // Vérifier si l'utilisateur est admin
    if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) {
        showToast("Accès refusé", "error");
        return;
    }
    
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce message ?")) {
        return;
    }
    
    try {
        await db.ref(`chat/${messageId}`).remove();
        showToast("Message supprimé", "success");
    } catch (e) {
        console.error('Erreur lors de la suppression du message:', e);
        showToast("Erreur lors de la suppression", "error");
    }
}
// Rendre la fonction accessible globalement pour le onclick
window.deleteChatMessage = deleteChatMessage;

// ================= SYSTÈME D'INACTIVITÉ =================
function setupInactivitySystem() {
    // Écouter les changements de visibilité de la page (changement d'onglet)
    if (document.hidden) {
        startInactivityTimer();
    } else {
        stopInactivityTimer();
        
        if (state.isInactive) {
            resumeFromInactivity();
        }
    }
}

function startInactivityTimer() {
    if (!document.hidden) return;
    
    // Arrêter le timer existant
    stopInactivityTimer();
    
    // Démarrer un nouveau timer avec le temps configuré
    state.inactivityTimer = setTimeout(() => {
        // Vérifier que l'onglet est toujours caché avant de déclencher
        if (document.hidden) {
            goToInactive();
        }
    }, CONFIG.INACTIVITY_TAB_TIMEOUT);
}

function stopInactivityTimer() {
    if (state.inactivityTimer) {
        clearTimeout(state.inactivityTimer);
        state.inactivityTimer = null;
    }
}

function goToInactive() {
    if (state.isInactive) return; // Déjà inactif
    
    // Vérification finale : s'assurer que l'onglet est vraiment caché
    if (!document.hidden) {
        return;
    }
    
    state.isInactive = true;
    state.renderLoopPaused = true;
    
    // Mettre en pause les requêtes Firebase
    pauseFirebaseQueries();
    
    // Afficher le popup avec un message contextuel
    const popup = document.getElementById('inactivity-popup');
    const messageEl = document.getElementById('inactivity-message');
    
    if (messageEl) {
        messageEl.textContent = `Vous avez quitté l'onglet pendant plus de ${CONFIG.INACTIVITY_TAB_TIMEOUT / 1000} secondes.`;
    }
    
    popup.classList.add('show');
}

function resumeFromInactivity() {
    if (!state.isInactive) return; // Déjà actif
    
    state.isInactive = false;
    state.renderLoopPaused = false;
    
    resumeFirebaseQueries();
    
    const popup = document.getElementById('inactivity-popup');
    if (popup) {
        popup.classList.remove('show');
    }
}

function pauseFirebaseQueries() {
    // Arrêter les listeners Firebase
    if (state.boardRef) {
        state.boardRef.off('value');
        state.boardRef = null;
    }
    if (state.statusRef) {
        state.statusRef.off('value');
        state.statusRef = null;
    }
    if (state.chatMessagesRef) {
        state.chatMessagesRef.off('value');
        state.chatMessagesRef = null;
    }
    if (state.chatPunishmentsRef) {
        state.chatPunishmentsRef.off('value');
        state.chatPunishmentsRef = null;
    }
    
    // Arrêter le timer d'inactivité
    if (state.inactivityTimer) {
        clearTimeout(state.inactivityTimer);
        state.inactivityTimer = null;
    }
    
    console.log('🔇 Requêtes Firebase mises en pause');
}

function resumeFirebaseQueries() {
    // Reprendre les listeners Firebase
    if (state.user) {
        startRealtimeSync(); // Utiliser startRealtimeSync au lieu de setupBoardListeners
        resumeChatFirebaseListeners(); // Reprendre uniquement les listeners Firebase du chat
    }
}

function resumeChatFirebaseListeners() {
    // Reprendre les listeners Firebase du chat sans réinitialiser les event listeners UI
    
    // Listener pour les messages du chat
    if (state.chatMessagesRef) {
        state.chatMessagesRef.off('value');
    }
    const messagesRef = db.ref('chat').orderByChild('timestamp').limitToLast(100);
    state.chatMessagesRef = messagesRef;
    
    messagesRef.on('value', (snapshot) => {
        const currentNow = Date.now();
        if (state.chatBannedUntil > currentNow || state.chatMutedUntil > currentNow) {
            messagesRef.off('value');
            renderChatMessages();
            return;
        }
        
        state.chatMessages = [];
        snapshot.forEach((childSnapshot) => {
            state.chatMessages.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        state.chatMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Check for new messages while chat was closed
        if (!state.chatWindowOpen && state.chatMessages.length > state.lastReadCount) {
            showChatNotification();
        }
        
        renderChatMessages();
    });
    
    // Listener pour les punitions
    if (state.chatPunishmentsRef) {
        state.chatPunishmentsRef.off('value');
    }
    state.chatPunishmentsRef = db.ref('chat_punishments');
    state.chatPunishmentsRef.on('value', (snapshot) => {
        state.activeChatPunishments = snapshot.val() || {};
        updateChatUI();
    });
    
    // Listener pour les punitions de l'utilisateur
    if (state.user) {
        db.ref(`chat_punishments/${state.user.uid}`).on('value', (snapshot) => {
            const punishment = snapshot.val();
            if (punishment && punishment.expires_at > Date.now()) {
                if (punishment.type === 'mute') {
                    state.chatMutedUntil = punishment.expires_at;
                } else if (punishment.type === 'ban_chat') {
                    state.chatBannedUntil = punishment.expires_at;
                }
            } else if (!punishment) {
                state.chatMutedUntil = 0;
                state.chatBannedUntil = 0;
            }
            updateChatUI();
        });
    }
    
    // Recharger les messages si le chat est ouvert
    if (state.chatWindowOpen) {
        loadChatMessages();
    }
}

// Rendre la fonction accessible globalement
window.resumeFromInactivity = resumeFromInactivity;

// ================= SYSTÈME DE RÈGLES =================
function setupRulesSystem() {
    const rulesToggleBtn = document.getElementById('rules-toggle-btn');
    const rulesPopup = document.getElementById('rules-popup');
    
    if (!rulesToggleBtn || !rulesPopup) return;
    
    // Ouvrir le popup des règles
    rulesToggleBtn.addEventListener('click', () => {
        rulesPopup.classList.add('show');
        // Mettre en pause le jeu pendant la lecture des règles
        if (!state.isInactive) {
            state.renderLoopPaused = true;
        }
    });
    
    // Fermer le popup en cliquant sur l'arrière-plan
    rulesPopup.addEventListener('click', (e) => {
        if (e.target === rulesPopup) {
            closeRulesPopup();
        }
    });
    
    // Fermer avec la touche Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rulesPopup.classList.contains('show')) {
            closeRulesPopup();
        }
    });
}

function closeRulesPopup() {
    const rulesPopup = document.getElementById('rules-popup');
    if (rulesPopup) {
        rulesPopup.classList.remove('show');
        // Reprendre le jeu
        if (!state.isInactive) {
            state.renderLoopPaused = false;
        }
    }
}

// Rendre la fonction accessible globalement
window.closeRulesPopup = closeRulesPopup;

async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const content = chatInput.value.trim();
    
    if (!content) return;
    
    // Check if user is logged in
    if (!state.user || !state.userProfile) {
        showToast("Tu dois être connecté pour chatter", "error");
        return;
    }
    
    // Check chat ban
    if (state.chatBannedUntil > Date.now()) {
        const remaining = Math.ceil((state.chatBannedUntil - Date.now()) / (1000 * 60));
        showToast(`Tu es banni du chat pour ${remaining} minutes`, "error");
        return;
    }
    
    // Check mute
    if (state.chatMutedUntil > Date.now()) {
        const remaining = Math.ceil((state.chatMutedUntil - Date.now()) / (1000 * 60));
        showToast(`Tu es muet pour ${remaining} minutes`, "error");
        return;
    }
    
    // Check cooldown (except for admin)
    const isAdmin = state.userProfile.username_norm === CONFIG.ADMIN_USER;
    if (!isAdmin && state.chatCooldown > Date.now()) {
        const remaining = Math.ceil((state.chatCooldown - Date.now()) / 1000);
        showToast(`Attends ${remaining} secondes`, "error");
        return;
    }
    
    // Check for bad words
    const hasBadWord = checkBadWords(content);
    if (hasBadWord && !isAdmin) {
        await handleBadWordInfraction();
        return; // Pas de toast ici, handleBadWordInfraction s'en occupe
    }
    
    // Check for spam
    const isSpam = checkSpam(content);
    if (isSpam && !isAdmin) {
        await handleSpamInfraction();
        showToast("Tu as été muet pour spam", "error");
        return;
    }
    
    try {
        // Send message
        const messageData = {
            uid: state.user.uid,
            author: state.userProfile.username,
            content: content,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await db.ref('chat').push(messageData);
        
        // Nettoyer les anciens messages après l'envoi
        cleanupOldChatMessages();
        
        // Set cooldown (except for admin) and start local counter immediately
        if (!isAdmin) {
            state.chatCooldown = Date.now() + CONFIG.CHAT_COOLDOWN_MS; // Utiliser la constante CHAT (10 secondes)
            startLocalCooldownCounter(); // Démarrer immédiatement le compteur local
        }
        
        // Clear input
        chatInput.value = '';
        
        // Update message tracking
        updateMessageTracking(content);
        
    } catch (error) {
        showToast("Erreur lors de l'envoi", "error");
    }
}

// Function to send system announcements (admin only)
async function sendSystemAnnouncement(content) {
    if (!content || !content.trim()) {
        showToast("Le message ne peut pas être vide", "error");
        return;
    }
    
    // Check if user is admin
    if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) {
        showToast("Accès refusé", "error");
        return;
    }
    
    try {
        // Send system message using Realtime Database (like normal chat)
        const messageData = {
            uid: 'system', // Special UID for system messages
            author: 'Système', // Special author name
            content: content.trim(),
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            isSystemMessage: true // Flag to identify system messages
        };
        
        await db.ref('chat').push(messageData);
        
        // Nettoyer les anciens messages après l'envoi
        cleanupOldChatMessages();
        
        showToast("Annonce système envoyée", "success");
        
    } catch (error) {
        console.error('Error sending system announcement:', error);
        showToast("Erreur lors de l'envoi de l'annonce", "error");
    }
}

// Fonction pour nettoyer les anciens messages dans Firebase (garde seulement les 100 derniers)
async function cleanupOldChatMessages() {
    try {
        const messagesRef = db.ref('chat').orderByChild('timestamp');
        const snapshot = await messagesRef.once('value');
        const messages = [];
        
        snapshot.forEach((childSnapshot) => {
            messages.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Si plus de 100 messages, supprimer les plus anciens
        if (messages.length > 100) {
            const messagesToDelete = messages.slice(0, messages.length - 100);
            const updates = {};
            
            messagesToDelete.forEach(msg => {
                updates[msg.id] = null; // Supprimer le message
            });
            
            await db.ref('chat').update(updates);
            console.log(`Nettoyé ${messagesToDelete.length} anciens messages du chat`);
        }
    } catch (error) {
        console.error('Erreur lors du nettoyage des anciens messages:', error);
    }
}

function checkBadWords(content) {
    const normalizedContent = content.toLowerCase().replace(/\s+/g, ' ');
    
    return state.badWords.some(badWord => {
        // Check if bad word is a whole word (not part of another word)
        const regex = new RegExp(`\\b${badWord}\\b`, 'gi');
        return regex.test(normalizedContent);
    });
}

function checkSpam(content) {
    const now = Date.now();
    const normalizedContent = content.toLowerCase().replace(/\s+/g, '');
    
    // Add current message to tracking
    state.lastMessageTimes.push({ time: now, content: normalizedContent });
    
    // Keep only last 3 minutes
    state.lastMessageTimes = state.lastMessageTimes.filter(msg => now - msg.time < 180000);
    
    // Count identical messages in last 3 minutes
    const identicalCount = state.lastMessageTimes.filter(msg => msg.content === normalizedContent).length;
    
    return identicalCount >= 5;
}

function updateMessageTracking(content) {
    state.chatMessageCount++;
    state.lastMessageTimes.push({ time: Date.now(), content: content.toLowerCase().replace(/\s+/g, '') });
    
    // Keep only last 3 minutes
    const threeMinutesAgo = Date.now() - 180000;
    state.lastMessageTimes = state.lastMessageTimes.filter(msg => msg.time > threeMinutesAgo);
}

async function handleBadWordInfraction() {
    state.chatInfractions++;
    
    const rules = state.chatPunishmentRules;
    let punishmentType = 'warning';
    let duration = 0;
    let message = '';
    
    // Déterminer la punition selon le nombre d'infractions
    if (state.chatInfractions >= rules.thresholds.banDef) {
        // Ban définitif
        punishmentType = 'ban_chat';
        duration = rules.durations.banDef;
        message = '🚫 Banni définitivement du chat pour langage inapproprié';
        
        // Also ban from game permanently
        await db.ref(`bans/${state.user.uid}`).set({ expires_at: 0 });
        showToast("🚫 Banni définitivement du jeu", "error");
        
    } else if (state.chatInfractions >= rules.thresholds.ban1week) {
        // Ban jeu 1 semaine
        punishmentType = 'ban_chat';
        duration = rules.durations.muteDef; // Ban chat définitif
        message = `🚫 Banni du chat définitivement (ban jeu 1 semaine)`;
        
        // Also ban from game for 1 week
        const gameBanExpires = Date.now() + rules.durations.ban1week;
        await db.ref(`bans/${state.user.uid}`).set({ expires_at: gameBanExpires });
        showToast("🚫 Banni du jeu pour 1 semaine", "error");
        
    } else if (state.chatInfractions >= rules.thresholds.ban1day) {
        // Ban jeu 1 jour
        punishmentType = 'ban_chat';
        duration = rules.durations.mute1week; // Mute chat 1 semaine
        message = `🚫 Banni du chat pour 1 semaine (ban jeu 1 jour)`;
        
        // Also ban from game for 1 day
        const gameBanExpires = Date.now() + rules.durations.ban1day;
        await db.ref(`bans/${state.user.uid}`).set({ expires_at: gameBanExpires });
        showToast("🚫 Banni du jeu pour 1 jour", "error");
        
    } else if (state.chatInfractions >= rules.thresholds.mute1week) {
        // Mute 1 semaine
        punishmentType = 'mute';
        duration = rules.durations.mute1week;
        message = `🔇 Muet du chat pour 1 semaine (langage inapproprié)`;
        
    } else if (state.chatInfractions >= rules.thresholds.mute1day) {
        // Mute 1 jour
        punishmentType = 'mute';
        duration = rules.durations.mute1day;
        message = `🔇 Muet du chat pour 1 jour (langage inapproprié)`;
        
    } else if (state.chatInfractions >= rules.thresholds.mute20min) {
        // Mute 20 minutes
        punishmentType = 'mute';
        duration = rules.durations.mute20min;
        message = `🔇 Muet du chat pour 20 minutes (langage inapproprié)`;
        
    } else if (state.chatInfractions >= rules.thresholds.mute5min) {
        // Mute 5 minutes
        punishmentType = 'mute';
        duration = rules.durations.mute5min;
        message = `🔇 Muet du chat pour 5 minutes (langage inapproprié)`;
        
    } else if (state.chatInfractions >= rules.thresholds.warning) {
        // Warning
        message = `⚠️ Avertissement : langage inapproprié (${state.chatInfractions}/${rules.thresholds.mute5min - 1} avant mute)`;
    }
    
    // Appliquer la punition si nécessaire
    if (punishmentType !== 'warning' && duration >= 0) {
        await applyChatPunishment(punishmentType, duration, 'Langage inapproprié');
    }
    
    // Afficher le message
    if (message) {
        showToast(message, "error");
    }
}

async function handleSpamInfraction() {
    // Spam: 10 minutes mute
    await applyChatPunishment('mute', 10 * 60 * 1000, 'Spam');
    showToast("🔇 Tu as été muet pour spam par l'auto-modération", "error");
}

async function applyChatPunishment(type, duration, reason) {
    const expiresAt = duration > 0 ? Date.now() + duration : 0;
    
    await db.ref(`chat_punishments/${state.user.uid}`).set({
        type: type,
        reason: reason,
        expires_at: expiresAt,
        infractions: state.chatInfractions
    });
    
    // Update local state
    if (type === 'mute') {
        state.chatMutedUntil = expiresAt;
    } else if (type === 'ban_chat') {
        state.chatBannedUntil = expiresAt;
    }
    
    // Mettre à jour l'UI immédiatement
    updateChatUI();
}

function renderActiveBans() {
    const content = document.getElementById('active-bans-content');
    if (!content) return;
    
    content.innerHTML = '';
    
    Object.entries(state.activeBans || {}).forEach(([uid, ban]) => {
        if (ban.expires_at > Date.now()) {
            const expiresAt = new Date(ban.expires_at);
            // Récupérer le bon nom depuis la whitelist en priorité
            const whitelistUser = state.whitelistCache.find(u => u.id === uid);
            const onlineUser = state.onlineUsers[uid];
            const userName = whitelistUser ? prettyName(whitelistUser.id) : (onlineUser?.name || uid.substring(0, 8));
            const remaining = Math.ceil((ban.expires_at - Date.now()) / (1000 * 60));
            
            const item = document.createElement('div');
            item.className = 'active-item ban';
            item.innerHTML = `
                <div class="active-item-header">
                    <span>🚫 ${userName}</span>
                    <span style="color: #ff0040;">${remaining}min</span>
                </div>
                <div class="active-item-details">
                    Expire: ${expiresAt.toLocaleString('fr-FR')}<br>
                    Temps restant: ${remaining} minutes
                </div>
            `;
            content.appendChild(item);
        }
    });
    
    if (content.children.length === 0) {
        content.innerHTML = '<p style="color: #888; font-style: italic;">Aucun ban actif</p>';
    }
}

// ================= UTILITAIRES TEXTE =================
function normalizeName(name) {
    if(!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function prettyName(name) {
    if(!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
}

/* ================= INIT & AUTH ================= */
// ANCIEN BOOTSTRAP SUPPRIMÉ - UTILISER aggressiveBootstrap()

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

async function handleAuthState(user) {
    if (user) {
        updateLoadingProgress('Chargement du profil...', 90);
        try {
            // Ajouter un timeout pour éviter le blocage infini
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout loading user profile')), 10000);
            });
            
            const docPromise = firestore.collection('users').doc(user.uid).get();
            const doc = await Promise.race([docPromise, timeoutPromise]);
            
            if (!doc.exists) { 
                await auth.signOut(); 
                return; 
            }
            
            state.user = user; 
            state.userProfile = doc.data();
            
            // Charger la couleur persistante de l'utilisateur
            const userData = doc.data();
            
            if (userData.selected_color && CONFIG.PALETTE.includes(userData.selected_color)) {
                state.selectedColor = userData.selected_color;
                state.userColor = userData.selected_color;
            }
            
            updateUserInterface(); 
            initGameEngine();
            
            await loadPublicConfigOnce();
            startVersionChecks();
            
            const loadingScreen = document.getElementById('loading-screen');
            const authScreen = document.getElementById('auth-screen');
            const registerModal = document.getElementById('register-modal');
            const gameUI = document.getElementById('game-ui');
            
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
            
            if (authScreen) {
                authScreen.classList.add('hidden');
            }
            
            if (registerModal) {
                registerModal.classList.add('hidden');
            }
            
            if (gameUI) {
                gameUI.classList.remove('hidden');
            }
            
            // Afficher les boutons chat et règles seulement quand l'utilisateur est connecté
            const chatToggleBtn = document.getElementById('chat-toggle-btn');
            const rulesToggleBtn = document.getElementById('rules-toggle-btn');
            if (chatToggleBtn) {
                chatToggleBtn.classList.add('visible');
            }
            if (rulesToggleBtn) {
                rulesToggleBtn.classList.add('visible');
            }
            
            showToast(`Bon retour, ${state.userProfile.username} !`, 'success');
            
        } catch (e) {
            console.error('Error during user initialization:', e);
            
            let errorMessage = "Erreur profil.";
            if (e.code === 'permission-denied') {
                errorMessage = "Accès refusé. Vérifiez votre connexion.";
            } else if (e.code === 'not-found') {
                errorMessage = "Profil introuvable. Contactez un admin.";
            } else if (e.code === 'unavailable') {
                errorMessage = "Service indisponible. Réessayez plus tard.";
            } else if (e.message && e.message.includes('Timeout')) {
                errorMessage = "Timeout de connexion. Vérifiez votre réseau.";
            } else if (e.message) {
                errorMessage = `Erreur: ${e.message}`;
            }
            
            showAuthError('login-error', errorMessage);
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
            
            // Si l'erreur est un timeout, essayer de déconnecter et reconnecter
            if (e.message && e.message.includes('Timeout')) {
                setTimeout(() => {
                    auth.signOut().catch(err => console.log('Sign out error:', err));
                }, 1000);
            }
        }
    } else {
        document.getElementById('game-ui').classList.add('hidden');
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        
        // Cacher les boutons chat et règles quand l'utilisateur est déconnecté
        const chatToggleBtn = document.getElementById('chat-toggle-btn');
        const rulesToggleBtn = document.getElementById('rules-toggle-btn');
        if (chatToggleBtn) {
            chatToggleBtn.classList.remove('visible');
        }
        if (rulesToggleBtn) {
            rulesToggleBtn.classList.remove('visible');
        }
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
    // Charger la whitelist au démarrage
    fetchWhitelist();
    
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

async function renderAdminActiveBans() {
    const container = document.getElementById('active-bans-content');
    if (!container) return;
    
    try {
        const snapshot = await db.ref('bans').once('value');
        const bans = snapshot.val() || {};
        const now = Date.now();
        
        let html = '';
        let hasActiveBans = false;
        
        for (const [uid, banData] of Object.entries(bans)) {
            if (banData && typeof banData.expires_at === 'number' && banData.expires_at > now) {
                hasActiveBans = true;
                const remainingMs = banData.expires_at - now;
                const remaining = formatRemaining(remainingMs);
                const userName = state.onlineUsers?.[uid]?.name || uid;
                
                html += `
                    <div class="ban-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin: 4px 0; background: rgba(255, 255, 255, 0.05); border-radius: 6px; border-left: 3px solid #ff4757;">
                        <div>
                            <strong style="color: #fff;">${userName}</strong>
                            <div style="font-size: 0.85rem; color: #888;">Restant: ${remaining}</div>
                        </div>
                        <button class="btn-small" style="background: var(--error); color: white; padding: 4px 8px; font-size: 0.8rem;" onclick="window.removeBanFromList('${uid}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                `;
            }
        }
        
        if (!hasActiveBans) {
            html = '<p style="color: #888; font-style: italic;">Aucun ban actif</p>';
        }
        
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p style="color: #ff6b6b;">Erreur lors du chargement</p>';
    }
}

// Fonction globale pour débannir depuis la liste
window.removeBanFromList = async (uid) => {
    if (!confirm('Débannir ce joueur ?')) return;
    try {
        await db.ref(`bans/${uid}`).remove();
        showToast("Joueur débanni", "success");
        renderAdminActiveBans(); // Rafraîchir la liste
    } catch (e) {
        showToast("Erreur", "error");
    }
};

async function renderAdminChatPunishments() {
    const container = document.getElementById('active-chat-punishments-content');
    if (!container) return;
    
    try {
        const snapshot = await db.ref('chat_punishments').once('value');
        const punishments = snapshot.val() || {};
        const now = Date.now();
        
        let html = '';
        let hasActivePunishments = false;
        
        for (const [uid, punishment] of Object.entries(punishments)) {
            if (punishment && typeof punishment.expires_at === 'number' && punishment.expires_at > now) {
                hasActivePunishments = true;
                const remainingMs = punishment.expires_at - now;
                const remaining = formatRemaining(remainingMs);
                const userName = state.onlineUsers?.[uid]?.name || uid;
                const type = punishment.type || 'mute';
                const reason = punishment.reason || 'Non spécifié';
                const infractions = punishment.infractions || 0;
                
                const icon = type === 'ban_chat' ? '🚫' : '🔇';
                const typeText = type === 'ban_chat' ? 'Banni du chat' : 'Muet du chat';
                
                html += `
                    <div class="ban-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin: 4px 0; background: rgba(255, 255, 255, 0.05); border-radius: 6px; border-left: 3px solid ${type === 'ban_chat' ? '#ff4757' : '#ffa502'};">
                        <div>
                            <strong style="color: #fff;">${icon} ${userName}</strong>
                            <div style="font-size: 0.85rem; color: #888;">${typeText} - Restant: ${remaining}</div>
                            <div style="font-size: 0.75rem; color: #666;">Raison: ${reason} | Infractions: ${infractions}</div>
                        </div>
                        <button class="btn-small" style="background: var(--error); color: white; padding: 4px 8px; font-size: 0.8rem;" onclick="window.removeChatPunishment('${uid}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                `;
            }
        }
        
        if (!hasActivePunishments) {
            html = '<p style="color: #888; font-style: italic;">Aucun mute/ban chat actif</p>';
        }
        
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p style="color: #ff6b6b;">Erreur lors du chargement</p>';
    }
}

// Fonction globale pour supprimer une punition chat depuis la liste
window.removeChatPunishment = async (uid) => {
    if (!confirm('Supprimer cette punition chat ?')) return;
    try {
        await db.ref(`chat_punishments/${uid}`).remove();
        showToast("Punition supprimée", "success");
        renderAdminChatPunishments(); // Rafraîchir la liste
    } catch (e) {
        showToast("Erreur", "error");
    }
};

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
        console.warn('Error loading announcement:', e);
        container.innerHTML = '<p style="color: #ff6b6b;">Erreur lors du chargement</p>';
    }
}

async function fetchWhitelist() {
    try {
        const snapPromise = firestore.collection('whitelist').get();
        const snap = await Promise.race([snapPromise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loading whitelist')), 5000))]);
            
        state.whitelistCache = [];
        snap.forEach(doc => state.whitelistCache.push({ id: doc.id, faction: doc.data().faction }));
            
        if (!document.getElementById('admin-modal').classList.contains('hidden')) renderAdminUserList();
    } catch (e) { 
        console.warn("Whitelist offline:", e.message); 
    }
}
// ================= ADMIN CHAT FUNCTIONS =================
function setupAdminChatListeners() {
    const applyPunishmentBtn = document.getElementById('btn-admin-apply-chat-punishment');
    const removePunishmentBtn = document.getElementById('btn-admin-remove-chat-punishment');
    
    if (applyPunishmentBtn && !applyPunishmentBtn.hasListener) {
        applyPunishmentBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            
            // Get selected user
            let uid = document.getElementById('admin-chat-target')?.value || '';
            let targetName = '';
            
            // If no UID selected, try offline name
            if (!uid) {
                const offlineName = document.getElementById('admin-chat-offline-name')?.value?.trim();
                if (!offlineName) return showToast("Choisis un joueur en ligne ou entre un prénom", "error");
                
                // Find user in whitelist
                let whitelistUser = state.whitelistCache.find(u => 
                    u.id.toLowerCase() === offlineName.toLowerCase()
                );
                
                if (!whitelistUser) {
                    whitelistUser = state.whitelistCache.find(u => 
                        prettyName(u.id).toLowerCase() === offlineName.toLowerCase()
                    );
                }
                
                if (!whitelistUser) {
                    const normalizedName = normalizeName(offlineName);
                    whitelistUser = state.whitelistCache.find(u => u.id === normalizedName);
                }
                
                if (!whitelistUser) {
                    return showToast("Joueur non trouvé dans la whitelist", "error");
                }
                
                // Get real UID
                const realUid = await findUserUidByName(whitelistUser.id);
                if (!realUid) {
                    return showToast("Impossible de trouver l'UID du joueur", "error");
                }
                
                uid = realUid;
                targetName = prettyName(whitelistUser.id);
            } else {
                const onlineUser = state.onlineUsers[uid];
                targetName = onlineUser?.name || uid;
            }
            
            const action = document.getElementById('admin-chat-action')?.value || 'mute';
            const duration = parseInt(document.getElementById('admin-chat-duration')?.value || '0', 10);
            const unit = document.getElementById('admin-chat-unit')?.value || 'minutes';
            
            if (!duration || duration <= 0) return showToast("Durée invalide", "error");
            
            const mult = unit === 'days' ? 24 * 60 * 60 * 1000 : unit === 'hours' ? 60 * 60 * 1000 : 60 * 1000;
            const durationMs = duration * mult;
            
            try {
                await applyChatPunishment(uid, action, durationMs);
                showToast(`${targetName} ${action === 'mute' ? 'muet' : 'banni du chat'} pour ${duration} ${unit}`, "success");
                
                // Clear fields
                document.getElementById('admin-chat-target').value = '';
                document.getElementById('admin-chat-offline-name').value = '';
                document.getElementById('admin-chat-duration').value = '';
            } catch (e) {
                showToast("Erreur lors de l'application", "error");
            }
        });
        applyPunishmentBtn.hasListener = true;
    }
    
    if (removePunishmentBtn && !removePunishmentBtn.hasListener) {
        removePunishmentBtn.addEventListener('click', async () => {
            if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) return showToast("Accès refusé", "error");
            
            // Get selected user
            let uid = document.getElementById('admin-chat-target')?.value || '';
            let targetName = '';
            
            // If no UID selected, try offline name
            if (!uid) {
                const offlineName = document.getElementById('admin-chat-offline-name')?.value?.trim();
                if (!offlineName) return showToast("Choisis un joueur en ligne ou entre un prénom", "error");
                
                // Find user in whitelist
                let whitelistUser = state.whitelistCache.find(u => 
                    u.id.toLowerCase() === offlineName.toLowerCase()
                );
                
                if (!whitelistUser) {
                    whitelistUser = state.whitelistCache.find(u => 
                        prettyName(u.id).toLowerCase() === offlineName.toLowerCase()
                    );
                }
                
                if (!whitelistUser) {
                    const normalizedName = normalizeName(offlineName);
                    whitelistUser = state.whitelistCache.find(u => u.id === normalizedName);
                }
                
                if (!whitelistUser) {
                    return showToast("Joueur non trouvé dans la whitelist", "error");
                }
                
                // Get real UID
                const realUid = await findUserUidByName(whitelistUser.id);
                if (!realUid) {
                    return showToast("Impossible de trouver l'UID du joueur", "error");
                }
                
                uid = realUid;
                targetName = prettyName(whitelistUser.id);
            } else {
                const onlineUser = state.onlineUsers[uid];
                targetName = onlineUser?.name || uid;
            }
            
            try {
                await db.ref(`chat_punishments/${uid}`).remove();
                showToast(`${targetName} n'est plus puni`, "success");
                
                // Clear fields
                document.getElementById('admin-chat-target').value = '';
                document.getElementById('admin-chat-offline-name').value = '';
            } catch (e) {
                showToast("Erreur lors du retrait", "error");
            }
        });
        removePunishmentBtn.hasListener = true;
    }
}

function renderAdminChatSelects() {
    const chatSelect = document.getElementById('admin-chat-target');
    const infractionsSelect = document.getElementById('admin-infractions-target');
    
    if (!chatSelect && !infractionsSelect) return;
    
    const currentChat = chatSelect?.value || '';
    const currentInfractions = infractionsSelect?.value || '';
    
    if (chatSelect) {
        chatSelect.innerHTML = '<option value="">Choisir un joueur en ligne</option>';
    }
    if (infractionsSelect) {
        infractionsSelect.innerHTML = '<option value="">Choisir un joueur en ligne</option>';
    }
    
    Object.entries(state.onlineUsers).forEach(([uid, info]) => {
        if (chatSelect) {
            const opt = document.createElement('option');
            opt.value = uid;
            opt.textContent = info?.name ? info.name : uid;
            chatSelect.appendChild(opt);
        }
        
        if (infractionsSelect) {
            const opt = document.createElement('option');
            opt.value = uid;
            opt.textContent = info?.name ? info.name : uid;
            infractionsSelect.appendChild(opt);
        }
    });
    
    if (chatSelect && [...chatSelect.options].some(o => o.value === currentChat)) {
        chatSelect.value = currentChat;
    }
    if (infractionsSelect && [...infractionsSelect.options].some(o => o.value === currentInfractions)) {
        infractionsSelect.value = currentInfractions;
    }
}

// Fonctions pour gérer les infractions
async function viewUserInfractions() {
    const targetSelect = document.getElementById('admin-infractions-target');
    const offlineNameInput = document.getElementById('admin-infractions-offline-name');
    const detailsDiv = document.getElementById('infractions-details');
    const userNameSpan = document.getElementById('infractions-user-name');
    const contentDiv = document.getElementById('infractions-content');
    
    if (!detailsDiv || !userNameSpan || !contentDiv) return;
    
    let uid = targetSelect.value;
    let targetName = '';
    
    if (!uid && offlineNameInput.value.trim()) {
        // Recherche hors ligne
        const offlineName = offlineNameInput.value.trim();
        const whitelistUser = state.whitelistCache.find(u => 
            prettyName(u.id).toLowerCase() === offlineName.toLowerCase()
        );
        
        if (!whitelistUser) {
            whitelistUser = state.whitelistCache.find(u => 
                prettyName(u.id).toLowerCase() === offlineName.toLowerCase()
            );
        }
        
        if (!whitelistUser) {
            const normalizedName = normalizeName(offlineName);
            whitelistUser = state.whitelistCache.find(u => u.id === normalizedName);
        }
        
        if (!whitelistUser) {
            return showToast("Joueur non trouvé", "error");
        }
        
        // Get real UID
        const realUid = await findUserUidByName(whitelistUser.id);
        if (!realUid) {
            return showToast("Impossible de trouver l'UID du joueur", "error");
        }
        
        uid = realUid;
        targetName = prettyName(whitelistUser.id);
    } else if (uid) {
        const onlineUser = state.onlineUsers[uid];
        targetName = onlineUser?.name || uid;
    } else {
        return showToast("Veuillez sélectionner un joueur", "error");
    }
    
    try {
        // Récupérer les infractions depuis Firebase
        const infractionsSnapshot = await db.ref(`users/${uid}/chatInfractions`).once('value');
        const infractions = infractionsSnapshot.val() || 0;
        
        // Récupérer les punitions actives
        const punishmentsSnapshot = await db.ref(`chat_punishments/${uid}`).once('value');
        const activePunishment = punishmentsSnapshot.val();
        
        userNameSpan.textContent = targetName;
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span><strong>Infractions totales:</strong> ${infractions}</span>
                <span><strong>Punition active:</strong> ${activePunishment ? `${activePunishment.type} (${Math.ceil((activePunishment.expires_at - Date.now()) / (1000 * 60))} min)` : 'Aucune'}</span>
            </div>
        `;
        
        if (activePunishment) {
            html += `
                <div style="background: rgba(255,0,64,0.1); padding: 8px; border-radius: 4px; margin-top: 10px;">
                    <strong>Détails de la punition:</strong><br>
                    Type: ${activePunishment.type}<br>
                    Raison: ${activePunishment.reason || 'Non spécifié'}<br>
                    Infractions: ${activePunishment.infractions || 0}<br>
                    Expire: ${new Date(activePunishment.expires_at).toLocaleString('fr-FR')}
                </div>
            `;
        }
        
        contentDiv.innerHTML = html;
        detailsDiv.style.display = 'block';
        
    } catch (e) {
        console.error('Erreur lors de la récupération des infractions:', e);
        showToast("Erreur lors de la récupération des infractions", "error");
    }
}

async function resetUserInfractions() {
    const targetSelect = document.getElementById('admin-infractions-target');
    const offlineNameInput = document.getElementById('admin-infractions-offline-name');
    
    let uid = targetSelect.value;
    let targetName = '';
    
    if (!uid && offlineNameInput.value.trim()) {
        // Recherche hors ligne
        const offlineName = offlineNameInput.value.trim();
        const whitelistUser = state.whitelistCache.find(u => 
            prettyName(u.id).toLowerCase() === offlineName.toLowerCase()
        );
        
        if (!whitelistUser) {
            const normalizedName = normalizeName(offlineName);
            const foundUser = state.whitelistCache.find(u => u.id === normalizedName);
            if (foundUser) {
                targetName = prettyName(foundUser.id);
                uid = foundUser.id;
            }
        } else {
            targetName = prettyName(whitelistUser.id);
            uid = whitelistUser.id;
        }
        
        if (!uid) {
            return showToast("Joueur non trouvé", "error");
        }
    } else if (uid) {
        const onlineUser = state.onlineUsers[uid];
        targetName = onlineUser?.name || uid;
    } else {
        return showToast("Veuillez sélectionner un joueur", "error");
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser les infractions de ${targetName} ?`)) {
        return;
    }
    
    try {
        // Réinitialiser les infractions dans Firebase
        await db.ref(`users/${uid}/chatInfractions`).set(0);
        
        // Si l'utilisateur est en ligne, mettre à jour l'état local
        if (state.onlineUsers[uid]) {
            // Forcer la relecture des infractions depuis Firebase
            db.ref(`users/${uid}/chatInfractions`).once('value').then(snapshot => {
                const infractions = snapshot.val() || 0;
                // Mettre à jour l'état local si nécessaire
                if (state.user && state.user.uid === uid) {
                    state.chatInfractions = infractions;
                }
            });
        }
        
        showToast(`Infractions de ${targetName} réinitialisées`, "success");
        
        // Cacher les détails et réinitialiser les champs
        document.getElementById('infractions-details').style.display = 'none';
        targetSelect.value = '';
        offlineNameInput.value = '';
        
        // Rafraîchir l'affichage
        viewUserInfractions();
        
    } catch (e) {
        console.error('Erreur lors de la réinitialisation des infractions:', e);
        showToast("Erreur lors de la réinitialisation des infractions", "error");
    }
}

// ================= ADMIN ================= */
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

    const viewInfractionsBtn = document.getElementById('btn-admin-view-infractions');
    if (viewInfractionsBtn && !viewInfractionsBtn.hasListener) {
        viewInfractionsBtn.addEventListener('click', viewUserInfractions);
        viewInfractionsBtn.hasListener = true;
    }

    // Chat announcement listeners
    const sendChatAnnouncementBtn = document.getElementById('btn-admin-send-chat-announcement');
    if (sendChatAnnouncementBtn && !sendChatAnnouncementBtn.hasListener) {
        sendChatAnnouncementBtn.addEventListener('click', async () => {
            const messageInput = document.getElementById('admin-chat-announcement-message');
            const content = messageInput.value.trim();
            
            if (!content) {
                showToast("Le message ne peut pas être vide", "error");
                return;
            }
            
            await sendSystemAnnouncement(content);
            messageInput.value = ''; // Clear input after sending
        });
        sendChatAnnouncementBtn.hasListener = true;
    }

    const clearChatAnnouncementBtn = document.getElementById('btn-admin-clear-chat-announcement');
    if (clearChatAnnouncementBtn && !clearChatAnnouncementBtn.hasListener) {
        clearChatAnnouncementBtn.addEventListener('click', () => {
            const messageInput = document.getElementById('admin-chat-announcement-message');
            messageInput.value = '';
            messageInput.focus();
        });
        clearChatAnnouncementBtn.hasListener = true;
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
            
            // Essayer de récupérer l'UID depuis la liste des joueurs en ligne
            let uid = document.getElementById('admin-ban-target')?.value || '';
            let targetName = '';
            
            // Si pas d'UID sélectionné, essayer avec le nom hors ligne
            if (!uid) {
                const offlineName = document.getElementById('admin-ban-offline-name')?.value?.trim();
                
                if (!offlineName) return showToast("Choisis un joueur en ligne ou entre un prénom", "error");
                
                // Chercher d'abord une correspondance exacte (insensible à la casse)
                let whitelistUser = state.whitelistCache.find(u => 
                    u.id.toLowerCase() === offlineName.toLowerCase()
                );
                
                // Si pas trouvé, essayer avec prettyName (pour les prénoms avec majuscules)
                if (!whitelistUser) {
                    whitelistUser = state.whitelistCache.find(u => 
                        prettyName(u.id).toLowerCase() === offlineName.toLowerCase()
                    );
                }
                
                // Si toujours pas trouvé, essayer avec normalizeName (ancienne méthode)
                if (!whitelistUser) {
                    const normalizedName = normalizeName(offlineName);
                    whitelistUser = state.whitelistCache.find(u => u.id === normalizedName);
                }
                
                if (!whitelistUser) {
                    return showToast("Joueur non trouvé dans la whitelist", "error");
                }
                
                // Récupérer l'UID Firebase réel depuis le nom
                const realUid = await findUserUidByName(whitelistUser.id);
                
                if (!realUid) {
                    return showToast("Impossible de trouver l'UID du joueur", "error");
                }
                
                uid = realUid;
                targetName = prettyName(whitelistUser.id);
            } else {
                // Récupérer le nom depuis les joueurs en ligne
                const onlineUser = state.onlineUsers[uid];
                targetName = onlineUser?.name || uid;
            }
            
            const dur = parseInt(document.getElementById('admin-ban-duration')?.value || '0', 10);
            const unit = document.getElementById('admin-ban-unit')?.value || 'minutes';
            if (!dur || dur <= 0) return showToast("Durée invalide", "error");
            const mult = unit === 'weeks' ? 7 * 24 * 60 * 60 * 1000 : unit === 'days' ? 24 * 60 * 60 * 1000 : unit === 'hours' ? 60 * 60 * 1000 : 60 * 1000;
            const expiresAt = Date.now() + (dur * mult);
            
            try {
                await db.ref(`bans/${uid}`).set({ expires_at: expiresAt });
                showToast(`${targetName} banni pour ${dur} ${unit}`, "success");
                
                // Vider les champs
                document.getElementById('admin-ban-target').value = '';
                document.getElementById('admin-ban-offline-name').value = '';
                document.getElementById('admin-ban-duration').value = '';
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
            
            // Essayer de récupérer l'UID depuis la liste des joueurs en ligne
            let uid = document.getElementById('admin-ban-target')?.value || '';
            let targetName = '';
            
            // Si pas d'UID sélectionné, essayer avec le nom hors ligne
            if (!uid) {
                const offlineName = document.getElementById('admin-ban-offline-name')?.value?.trim();
                
                if (!offlineName) return showToast("Choisis un joueur en ligne ou entre un prénom", "error");
                
                // Chercher d'abord une correspondance exacte (insensible à la casse)
                let whitelistUser = state.whitelistCache.find(u => 
                    u.id.toLowerCase() === offlineName.toLowerCase()
                );
                
                // Si pas trouvé, essayer avec prettyName (pour les prénoms avec majuscules)
                if (!whitelistUser) {
                    whitelistUser = state.whitelistCache.find(u => 
                        prettyName(u.id).toLowerCase() === offlineName.toLowerCase()
                    );
                }
                
                // Si toujours pas trouvé, essayer avec normalizeName (ancienne méthode)
                if (!whitelistUser) {
                    const normalizedName = normalizeName(offlineName);
                    whitelistUser = state.whitelistCache.find(u => u.id === normalizedName);
                }
                
                if (!whitelistUser) {
                    return showToast("Joueur non trouvé dans la whitelist", "error");
                }
                
                // Récupérer l'UID Firebase réel depuis le nom
                const realUid = await findUserUidByName(whitelistUser.id);
                
                if (!realUid) {
                    return showToast("Impossible de trouver l'UID du joueur", "error");
                }
                
                uid = realUid;
                targetName = prettyName(whitelistUser.id);
            } else {
                // Récupérer le nom depuis les joueurs en ligne
                const onlineUser = state.onlineUsers[uid];
                targetName = onlineUser?.name || uid;
            }
            
            try {
                await db.ref(`bans/${uid}`).remove();
                showToast(`${targetName} débanni`, "success");
                
                // Vider les champs
                document.getElementById('admin-ban-target').value = '';
                document.getElementById('admin-ban-offline-name').value = '';
            } catch (e) {
                showToast("Erreur débannissement", "error");
            }
        });
        removeBanBtn.hasListener = true;
    }

    // Setup chat admin listeners
    setupAdminChatListeners();
}

function openAdminPanel() {
    // Vérifier si c'est bien l'admin
    if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) {
        showToast("Accès refusé", "error");
        return;
    }
    
    // Afficher la modale de code au lieu du panel directement
    const modal = document.getElementById('admin-code-modal');
    const input = document.getElementById('admin-code-input');
    
    modal.classList.remove('hidden');
    input.value = '';
    input.focus();
    
    // Masquer l'erreur au cas où
    document.getElementById('admin-code-error').classList.add('hidden');
}

// Nouvelle fonction pour ouvrir le panel admin après vérification
function openAdminPanelAfterCode() {
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
        
        // Afficher les bans actifs
        renderAdminActiveBans();
        
        // Afficher les mutes/bans chat actifs
        renderAdminChatPunishments();
        
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
    
    // Also render chat selects
    renderAdminChatSelects();
}

function selectColor(color) {
    state.selectedColor = color;
    playSound('pop');
}

function updateCooldownProgressBar() {
    const progressBar = document.getElementById('cooldown-progress-bar');
    if (!progressBar) return;
    
    // Vérifier si le joueur est banni
    if (state.banExpiresAt && state.banExpiresAt > Date.now()) {
        progressBar.classList.add('banned');
        return;
    }
    
    progressBar.classList.remove('banned');
    
    // Calculer le temps restant
    const now = Date.now();
    const nextPixelTime = state.nextPixelTime || 0;
    
    if (now >= nextPixelTime) {
        // Peut placer un pixel - barre pleine
        progressBar.style.width = '100%';
    } else {
        // En cooldown - barre proportionnelle
        const timeRemaining = nextPixelTime - now;
        const progress = 1 - (timeRemaining / state.cooldownMsEffective);
        const widthPercentage = Math.max(0, Math.min(100, progress * 100));
        progressBar.style.width = `${widthPercentage}%`;
    }
    
    // Mettre à jour l'indicateur admin
    updateAdminIndicator();
}

function updateAdminIndicator() {
    const indicator = document.getElementById('admin-indicator');
    if (!indicator) return;
    
    if (state.adminNoCooldown && state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

function renderActiveBoosts() {
    const content = document.getElementById('active-boosts-content');
    if (!content) return;
    
    content.innerHTML = '';
    
    // Tableau pour stocker tous les boosts actifs
    const activeBoosts = [];
    
    // Boost global en premier
    if (state.globalBoost && state.globalBoost.expires_at > Date.now()) {
        const expiresAt = new Date(state.globalBoost.expires_at);
        const cooldownSec = state.globalBoost.cooldown_ms / 1000;
        
        activeBoosts.push({
            type: 'global',
            name: 'Tous les joueurs',
            icon: '🌐',
            cooldownSec: cooldownSec,
            expiresAt: expiresAt,
            target: 'global'
        });
    }
    
    // Boosts utilisateurs
    Object.entries(state.userBoosts || {}).forEach(([uid, boost]) => {
        if (boost.expires_at > Date.now()) {
            const expiresAt = new Date(boost.expires_at);
            const cooldownSec = boost.cooldown_ms / 1000;
            // Récupérer le bon nom depuis la whitelist en priorité
            const whitelistUser = state.whitelistCache.find(u => u.id === uid);
            const onlineUser = state.onlineUsers[uid];
            const userName = whitelistUser ? prettyName(whitelistUser.id) : (onlineUser?.name || uid.substring(0, 8));
            
            activeBoosts.push({
                type: 'user',
                name: userName,
                icon: '👤',
                cooldownSec: cooldownSec,
                expiresAt: expiresAt,
                target: uid
            });
        }
    });
    
    // Afficher tous les boosts
    activeBoosts.forEach(boost => {
        const item = document.createElement('div');
        item.className = 'active-item boost';
        item.innerHTML = `
            <div class="active-item-header">
                <span>${boost.icon} ${boost.name}</span>
                <span style="color: #00ff88;">${boost.cooldownSec}s</span>
            </div>
            <div class="active-item-details">
                Expire: ${boost.expiresAt.toLocaleString('fr-FR')}<br>
                Cooldown: ${boost.cooldownSec} secondes
            </div>
        `;
        content.appendChild(item);
    });
    
    if (content.children.length === 0) {
        content.innerHTML = '<p style="color: #888; font-style: italic;">Aucun boost actif</p>';
    }
}

// Fonction pour trouver l'UID Firebase réel depuis le nom normalisé
async function findUserUidByName(normalizedName) {
    
    // Chercher d'abord dans les joueurs en ligne
    for (const [uid, userData] of Object.entries(state.onlineUsers || {})) {
        if (userData.name && userData.name.toLowerCase() === normalizedName.toLowerCase()) {
            return uid;
        }
    }
    
    // Si pas trouvé en ligne, chercher dans Firestore
    try {
        const snapshot = await firestore.collection('users')
            .where('username_norm', '==', normalizedName)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const uid = snapshot.docs[0].id;
            return uid;
        }
    } catch (error) {
        console.error('Erreur recherche UID:', error);
    }
    
    return null;
}

async function removeBoost(target) {
    if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) {
        showToast("Accès refusé", "error");
        return;
    }
    
    try {
        if (target === 'global') {
            await db.ref('boosts/global').remove();
            showToast("Boost global supprimé", "success");
        } else {
            await db.ref(`boosts/users/${target}`).remove();
            showToast("Boost utilisateur supprimé", "success");
        }
    } catch (e) {
        console.error('Erreur suppression boost:', e);
        showToast("Erreur suppression boost", "error");
    }
}

window.removeBoost = removeBoost; // Rendre accessible globalement

function renderActiveChatPunishments() {
    const content = document.getElementById('active-chat-punishments-content');
    if (!content) return;
    
    content.innerHTML = '';
    
    // Tableau pour stocker toutes les punishments actives
    const activePunishments = [];
    
    Object.entries(state.activeChatPunishments || {}).forEach(([uid, punishment]) => {
        if (punishment.expires_at > Date.now()) {
            const expiresAt = new Date(punishment.expires_at);
            // Récupérer le bon nom depuis la whitelist en priorité
            const whitelistUser = state.whitelistCache.find(u => u.id === uid);
            const onlineUser = state.onlineUsers[uid];
            const userName = whitelistUser ? prettyName(whitelistUser.id) : (onlineUser?.name || uid.substring(0, 8));
            
            // Calculer le temps restant
            const remainingMs = punishment.expires_at - Date.now();
            const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
            const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
            const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
            
            let timeRemaining;
            if (remainingMs <= 0) {
                timeRemaining = 'Expiré';
            } else if (remainingDays > 1) {
                timeRemaining = `${remainingDays} jours`;
            } else if (remainingHours > 1) {
                timeRemaining = `${remainingHours} heures`;
            } else {
                timeRemaining = `${remainingMinutes} minutes`;
            }
            
            activePunishments.push({
                type: punishment.type,
                name: userName,
                uid: uid,
                icon: punishment.type === 'mute' ? '' : '',
                timeRemaining: timeRemaining,
                expiresAt: expiresAt,
                reason: punishment.reason || 'Non spécifié',
                infractions: punishment.infractions || 0
            });
        }
    });
    
    // Afficher toutes les punishments
    activePunishments.forEach(punishment => {
        const item = document.createElement('div');
        item.className = `active-item ${punishment.type}`;
        item.innerHTML = `
            <div class="active-item-header">
                <span>${punishment.icon} ${punishment.name}</span>
                <span style="color: ${punishment.type === 'mute' ? '#ffaa00' : '#ff0040'};">${punishment.timeRemaining}</span>
            </div>
            <div class="active-item-details">
                Type: ${punishment.type === 'mute' ? 'Mute' : 'Ban chat'}<br>
                Raison: ${punishment.reason}<br>
                Infractions: ${punishment.infractions}<br>
                Expire: ${punishment.expiresAt.toLocaleString('fr-FR')}
            </div>
        `;
        content.appendChild(item);
    });
    
    if (content.children.length === 0) {
        content.innerHTML = '<p style="color: #888; font-style: italic;">Aucune punition de chat active</p>';
    }
}

async function removeBan(uid) {
    if (!state.userProfile || state.userProfile.username_norm !== CONFIG.ADMIN_USER) {
        showToast("Accès refusé", "error");
        return;
    }
    
    try {
        await db.ref(`bans/${uid}`).remove();
        showToast("Joueur débanni", "success");
    } catch (e) {
        console.error('Erreur débannissement:', e);
        showToast("Erreur débannissement", "error");
    }
}

window.removeBan = removeBan; // Rendre accessible globalement

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
        
    // TODO: Implémenter la suppression de la whitelist
    console.log(`Suppression de ${id} de la whitelist`);
};

/* ================= MOTEUR JEU ================= */
function initGameEngine() {
    setupPalette();
    loadUserSettings(); // Charger les paramètres utilisateur
    setupSettingsModal(); // Initialiser le modal des paramètres
        
    // Initialiser les contrôles de paramètres avec un petit délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
        setupSettingsControls();
    }, 100);
        
    state.camera.x = (CONFIG.BOARD_SIZE * CONFIG.PIXEL_SCALE) / 2;
    state.camera.y = (CONFIG.BOARD_SIZE * CONFIG.PIXEL_SCALE) / 2;
    state.camera.zoom = 1.5;
    state.camera.targetZoom = 1.5;
    resizeCanvas(); 
    setupCanvasInput();
    setupScoreboardInput();
    setupChatSystem(); // Ajout du système de chat
    setupInactivitySystem(); // Ajout du système d'inactivité
    setupRulesSystem(); // Ajout du système de règles
    startRealtimeSync(); 
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
        // Lancer l'animation de découpe
        startWelcomeAnimation();
    };
}

function startWelcomeAnimation() {
    const popup = document.getElementById('welcome-popup');
    const welcomeCard = popup.querySelector('.welcome-card');
    
    // Fondu très rapide et instantané
    welcomeCard.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
    welcomeCard.style.opacity = '0';
    welcomeCard.style.transform = 'scale(0.95)';
    
    // Initialiser l'audio
    initAudio();
    
    // Démarrer la musique
    setTimeout(() => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (bgMusic) {
            bgMusic.play().catch(() => console.log('Background music playback failed'));
        }
    }, 200);
    
    // Masquer le popup immédiatement après le fondu rapide
    setTimeout(() => {
        popup.classList.add('hidden');
        // Réinitialiser les styles pour la prochaine fois
        welcomeCard.style.transition = '';
        welcomeCard.style.opacity = '';
        welcomeCard.style.transform = '';
        welcomeCard.classList.remove('fading-out');
    }, 150);
}

function createParticles(container, rect) {
    const particleCount = 20;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'welcome-particle';
        
        // Position au centre de la carte
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        
        // Direction aléatoire
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = 100 + Math.random() * 200;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        container.appendChild(particle);
    }
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
    if (state.boardRef) {
        state.boardRef.off('child_changed', handlePixelUpdate);
        state.boardRef.off('child_added', handlePixelUpdate);
    }
    state.boardRef = db.ref('board');
    state.boardRef.on('child_changed', handlePixelUpdate);
    state.boardRef.orderByChild('t').startAt(Date.now() - 5000).on('child_added', handlePixelUpdate);
    
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
    
    // Écouter tous les boosts utilisateurs pour l'affichage admin
    db.ref('boosts/users').on('value', snap => {
        state.userBoosts = snap.val() || {};
    });
    
    // Écouter tous les bans pour l'affichage admin
    db.ref('bans').on('value', snap => {
        state.activeBans = snap.val() || {};
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
    
    // Compter les joueurs par faction
    const factionCounts = { 1: 0, 2: 0 };
    sortedUsers.forEach(([uid, userData]) => {
        if (userData.faction && factionCounts[userData.faction] !== undefined) {
            factionCounts[userData.faction]++;
        }
    });
    
    // Vider et reconstruire complètement la liste
    listContainer.innerHTML = '';
    
    // Ajouter l'en-tête avec les comptes de factions
    const headerDiv = document.createElement('div');
    headerDiv.className = 'scoreboard-faction-counts';
    headerDiv.innerHTML = `
        <div class="faction-count-item tsti1">
            <span class="faction-count-number">${factionCounts[1]}</span>
            <span class="faction-count-label">TSTI1</span>
        </div>
        <div class="faction-vs">VS</div>
        <div class="faction-count-item tsti2">
            <span class="faction-count-number">${factionCounts[2]}</span>
            <span class="faction-count-label">TSTI2</span>
        </div>
    `;
    listContainer.appendChild(headerDiv);
    
    if (sortedUsers.length === 0) {
        listContainer.innerHTML += '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Aucun joueur en ligne</div>';
        return;
    }
    
    // Créer les éléments du classement
    sortedUsers.forEach((entry, index) => {
        const [uid, userData] = entry;
        const factionInfo = CONFIG.FACTIONS[userData.faction];
        const factionClass = factionInfo ? factionInfo.cssClass : '';
        
        const li = document.createElement('div');
        li.className = `scoreboard-item ${factionClass}`;
        
        // Vérifier si c'est l'admin
        const isAdmin = userData.name && userData.name.toLowerCase() === CONFIG.ADMIN_USER;
        const adminTag = isAdmin ? '<span class="admin-tag">ADMIN</span> ' : '';
        const nameStyle = isAdmin ? 'style="color: #ff0040;"' : '';
        
        li.innerHTML = `
            <div class="scoreboard-item-name" ${nameStyle}>${adminTag}${userData.name}</div>
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
function updatePixelStats() {
    const totalPixels = CONFIG.BOARD_SIZE * CONFIG.BOARD_SIZE;
    const placedPixels = Object.keys(state.boardData).length;
    const percentage = ((placedPixels / totalPixels) * 100).toFixed(1);
    
    const statsText = document.getElementById('pixel-stats-text');
    if (statsText) {
        statsText.textContent = `${placedPixels}/${totalPixels} (${percentage}%)`;
    }
}

function renderLoop() {
    // Si inactif, ne pas exécuter le render loop
    if (state.renderLoopPaused) {
        state.renderLoopId = requestAnimationFrame(renderLoop);
        return;
    }
    
    drawGame(); 
    updateTimerDisplay(); 
    updateOverlayPosition();
    updateCooldownProgressBar();
    renderActiveBoosts();
    renderActiveBans(); // Ajout de cette ligne
    renderActiveChatPunishments(); // Ajout de l'affichage des punishments du chat
    
    // Pas d'appel à updateChatUI ici car le compteur local gère déjà l'affichage du cooldown
    
    state.renderLoopId = requestAnimationFrame(renderLoop);
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
    
    // Image overlay (calque)
    if (state.imageOverlay.visible && state.imageOverlay.img) {
        ctx.save();
        ctx.globalAlpha = state.imageOverlay.opacity;
        
        const img = state.imageOverlay.img;
        const scaledWidth = img.width * state.imageOverlay.scale;
        const scaledHeight = img.height * state.imageOverlay.scale;
        
        ctx.drawImage(
            img,
            state.imageOverlay.x,
            state.imageOverlay.y,
            scaledWidth,
            scaledHeight
        );
        
        ctx.restore();
    }
    
    // FIX: Highlight Hover (Contour Noir Fin sur la case visée)
    if (state.hoverTransition.currentX >= 0 && state.hoverTransition.currentX < CONFIG.BOARD_SIZE && 
        state.hoverTransition.currentY >= 0 && state.hoverTransition.currentY < CONFIG.BOARD_SIZE) {
        
        ctx.lineWidth = 1; // Trait fin
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; // Noir quasi opaque
        
        // On dessine le contour avec les coordonnées de transition fluide
        ctx.strokeRect(
            state.hoverTransition.currentX * CONFIG.PIXEL_SCALE, 
            state.hoverTransition.currentY * CONFIG.PIXEL_SCALE, 
            CONFIG.PIXEL_SCALE, 
            CONFIG.PIXEL_SCALE
        );
        
        // Afficher les infos du pixel si activé pour noeb
        if (state.showPixelInfo && state.userProfile && state.userProfile.username_norm === CONFIG.ADMIN_USER) {
            try {
                const key = `${state.hoverTransition.currentX}_${state.hoverTransition.currentY}`;
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
                        const boxX = state.hoverTransition.currentX * CONFIG.PIXEL_SCALE + CONFIG.PIXEL_SCALE / 2 - boxWidth / 2;
                        const boxY = state.hoverTransition.currentY * CONFIG.PIXEL_SCALE - boxHeight - 5 / state.camera.zoom;
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
                            ctx.fillText(displayLines[i], state.hoverTransition.currentX * CONFIG.PIXEL_SCALE + CONFIG.PIXEL_SCALE / 2, y);
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
// Gestion du zoom fluide avec la molette
function onWheel(e) {
    e.preventDefault(); 
    
    if (!state.settings.smoothAnimation) {
        // Mode sans animation fluide : zoom direct
        const zoomSpeed = 0.001;
        const delta = e.deltaY * zoomSpeed * state.camera.zoom;
        const newZoom = state.camera.zoom - delta;
        state.camera.zoom = Math.min(Math.max(0.1, newZoom), 10);
        state.camera.targetZoom = state.camera.zoom;
        return;
    }
    
    // Mode avec animation fluide
    // Calculer le zoom cible basé sur la vitesse de la molette
    const zoomSpeed = 0.001;
    const delta = e.deltaY * zoomSpeed * state.camera.zoom;
    const newTargetZoom = state.camera.targetZoom - delta;
    
    // Limiter le zoom entre 0.1 et 10
    state.camera.targetZoom = Math.min(Math.max(0.1, newTargetZoom), 10);
    
    // Démarrer l'animation de zoom si ce n'est pas déjà fait
    if (!state.zoomAnimation) {
        animateZoom();
    }
}

// Animation fluide du zoom
function animateZoom() {
    const smoothing = 0.15; // Facteur de lissage (plus = plus rapide)
    const threshold = 0.001; // Seuil pour arrêter l'animation
    
    const difference = state.camera.targetZoom - state.camera.zoom;
    
    if (Math.abs(difference) > threshold) {
        state.camera.zoom += difference * smoothing;
        state.zoomAnimation = requestAnimationFrame(animateZoom);
    } else {
        state.camera.zoom = state.camera.targetZoom;
        state.zoomAnimation = null;
    }
}

// Gestion des événements tactiles pour le pinch-to-zoom
function onTouchStart(e) {
    if (e.touches.length === 1) {
        // Touch simple pour le drag
        onDown(e.touches[0]);
    } else if (e.touches.length === 2) {
        // Pinch-to-zoom
        e.preventDefault();
        state.touchState.isPinching = true;
        state.touchState.lastDistance = getTouchDistance(e.touches);
        state.touchState.initialZoom = state.camera.zoom;
        
        // Arrêter l'animation de zoom en cours
        if (state.zoomAnimation) {
            cancelAnimationFrame(state.zoomAnimation);
            state.zoomAnimation = null;
        }
    }
}

function onTouchMove(e) {
    if (e.touches.length === 1 && !state.touchState.isPinching) {
        // Mouvement simple
        e.preventDefault();
        onMove(e.touches[0]);
    } else if (e.touches.length === 2 && state.touchState.isPinching) {
        // Pinch-to-zoom
        e.preventDefault();
        
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / state.touchState.lastDistance;
        
        // Calculer le nouveau zoom
        const newZoom = state.touchState.initialZoom * scale;
        state.camera.zoom = Math.min(Math.max(0.1, newZoom), 10);
        state.camera.targetZoom = state.camera.zoom;
        
        // Mettre à jour la distance de référence
        state.touchState.lastDistance = currentDistance;
    }
}

function onTouchEnd(e) {
    if (e.touches.length === 0) {
        if (state.touchState.isPinching) {
            state.touchState.isPinching = false;
        } else {
            onUp(e);
        }
    }
}

// Utilitaire pour calculer la distance entre deux touches
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function setupCanvasInput() {
    const cvs = document.getElementById('gameCanvas');
    cvs.addEventListener('mousedown', onDown); 
    window.addEventListener('mousemove', onMove); 
    window.addEventListener('mouseup', onUp);
    
    // Support du touch pour mobile
    cvs.addEventListener('touchstart', onTouchStart, {passive:false});
    cvs.addEventListener('touchmove', onTouchMove, {passive:false});
    cvs.addEventListener('touchend', onTouchEnd);
    
    // Zoom fluide avec la molette
    cvs.addEventListener('wheel', onWheel, {passive:false});
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

// Animation fluide de transition du survol
function animateHoverTransition() {
    const smoothing = state.hoverTransition.smoothing;
    const threshold = 0.05; // Seuil pour arrêter l'animation
    
    let hasChanged = false;
    
    // Interpoler X
    const diffX = state.hoverTransition.targetX - state.hoverTransition.currentX;
    if (Math.abs(diffX) > threshold) {
        state.hoverTransition.currentX += diffX * smoothing;
        hasChanged = true;
    } else {
        state.hoverTransition.currentX = state.hoverTransition.targetX;
    }
    
    // Interpoler Y
    const diffY = state.hoverTransition.targetY - state.hoverTransition.currentY;
    if (Math.abs(diffY) > threshold) {
        state.hoverTransition.currentY += diffY * smoothing;
        hasChanged = true;
    } else {
        state.hoverTransition.currentY = state.hoverTransition.targetY;
    }
    
    if (hasChanged) {
        state.hoverTransition.animationId = requestAnimationFrame(animateHoverTransition);
    } else {
        state.hoverTransition.animationId = null;
    }
}

function onDown(e) {
    state.isDragging = true; state.dragStartTime = Date.now();
    state.lastMouse = { x: e.clientX, y: e.clientY }; state.dragStartPos = { x: e.clientX, y: e.clientY };
}

function onMove(e) {
    // FIX: Mise à jour des coordonnées Hover pour le Highlight
    const pos = screenToGrid(e.clientX, e.clientY);
    
    // Mettre à jour la cible de transition si la position change ET si l'animation fluide est activée
    if(state.settings.smoothAnimation) {
        if(pos.x !== state.hoverGrid.x || pos.y !== state.hoverGrid.y) {
            state.hoverGrid = pos;
            state.hoverTransition.targetX = pos.x;
            state.hoverTransition.targetY = pos.y;
            
            // Démarrer l'animation de transition si ce n'est pas déjà fait
            if (!state.hoverTransition.animationId) {
                animateHoverTransition();
            }
        }
    } else {
        // Mode sans animation fluide : mise à jour directe
        state.hoverGrid = pos;
        state.hoverTransition.currentX = pos.x;
        state.hoverTransition.currentY = pos.y;
        state.hoverTransition.targetX = pos.x;
        state.hoverTransition.targetY = pos.y;
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
            selectColor(c);
            document.querySelectorAll('.color-swatch').forEach(e=>e.classList.remove('active'));
            d.classList.add('active');
            if(window.innerWidth < 768) document.getElementById('palette-container').classList.add('collapsed-mobile');
        };
        grid.appendChild(d);
    });
    
    // Initialiser le slider d'outils
    setupToolSlider();
    
    // Setup import image functionality
    setupImageImport();
}

function setupImageImport() {
    const importBtn = document.getElementById('btn-import-image');
    const modal = document.getElementById('import-image-modal');
    const closeBtn = document.getElementById('btn-close-import-image');
    const fileInput = document.getElementById('file-input');
    const selectBtn = document.getElementById('btn-select-file');
    const dropZone = document.getElementById('drop-zone');
    const urlInput = document.getElementById('image-url');
    const loadUrlBtn = document.getElementById('btn-load-url');
    
    if (!importBtn || !modal) return;
    
    // Open modal
    importBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        // Tenter d'initialiser les contrôles overlay maintenant
        setupOverlayControls();
    });
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    // File selection
    selectBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImageFile(file);
        }
    });
    
    // Drag & drop
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImageFile(file);
        }
    });
    
    // URL loading
    loadUrlBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
            loadImageFromUrl(url);
        }
    });
    
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const url = urlInput.value.trim();
            if (url) {
                loadImageFromUrl(url);
            }
        }
    });
}

function setupOverlayControls() {
    const overlayControls = document.getElementById('image-overlay-controls');
    const moveBtn = document.getElementById('btn-move-image');
    const settingsBtn = document.getElementById('btn-opacity-settings');
    const resizeBtn = document.getElementById('btn-resize-image');
    const deleteBtn = document.getElementById('btn-delete-image');
    const resizeHandle = document.getElementById('resize-handle');
    const moveHandle = document.getElementById('move-handle');
    const opacityHandle = document.getElementById('opacity-handle');
    const opacityPopup = document.getElementById('opacity-popup');
    const opacitySlider = document.getElementById('opacity-slider-popup');
    const opacityValue = document.getElementById('opacity-value-popup');
    
    // Vérifier si tous les éléments existent avant de continuer
    if (!overlayControls || !moveBtn || !settingsBtn || !resizeBtn || !deleteBtn || !resizeHandle || !moveHandle || !opacityHandle || !opacityPopup || !opacitySlider || !opacityValue) {
        console.log('Éléments de contrôle overlay non encore disponibles, initialisation différée');
        return;
    }
    
    let isMoving = false;
    let isResizing = false;
    let isAdjustingOpacity = false;
    let startX, startY;
    
    // Bouton de déplacement (haut)
    moveBtn.addEventListener('mousedown', (e) => {
        isMoving = true;
        startX = e.clientX - state.imageOverlay.x;
        startY = e.clientY - state.imageOverlay.y;
        e.preventDefault();
    });
    
    // Curseur de déplacement (bas centre)
    moveHandle.addEventListener('mousedown', (e) => {
        isMoving = true;
        startX = e.clientX - state.imageOverlay.x;
        startY = e.clientY - state.imageOverlay.y;
        e.preventDefault();
    });
    
    // Bouton de redimensionnement
    resizeBtn.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
    });
    
    // Curseur de taille (coin bas droit)
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
    });
    
    // Curseur de transparence (coin bas gauche)
    opacityHandle.addEventListener('mousedown', (e) => {
        isAdjustingOpacity = true;
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
    });
    
    // Bouton de paramètres (transparence)
    settingsBtn.addEventListener('click', () => {
        opacityPopup.classList.toggle('hidden');
        opacitySlider.value = state.imageOverlay.opacity * 100;
        opacityValue.textContent = `${Math.round(state.imageOverlay.opacity * 100)}%`;
    });
    
    // Slider de transparence
    opacitySlider.addEventListener('input', (e) => {
        const value = e.target.value;
        opacityValue.textContent = `${value}%`;
        state.imageOverlay.opacity = value / 100;
    });
    
    // Bouton de suppression
    deleteBtn.addEventListener('click', () => {
        state.imageOverlay.img = null;
        state.imageOverlay.visible = false;
        overlayControls.classList.add('hidden');
        opacityPopup.classList.add('hidden');
        showToast('Image supprimée', 'info');
    });
    
    // Événements globaux pour déplacement, redimensionnement et transparence
    document.addEventListener('mousemove', (e) => {
        if (isMoving) {
            state.imageOverlay.x = e.clientX - startX;
            state.imageOverlay.y = e.clientY - startY;
            updateOverlayPosition();
        }
        
        if (isResizing) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const delta = Math.max(deltaX, deltaY);
            // Sensibilité réduite pour le redimensionnement
            const newScale = Math.max(0.1, Math.min(3, state.imageOverlay.scale + delta / 500));
            state.imageOverlay.scale = newScale;
            startX = e.clientX;
            startY = e.clientY;
            updateOverlayPosition();
        }
        
        if (isAdjustingOpacity) {
            const deltaX = e.clientX - startX;
            // Sensibilité réduite pour la transparence
            const delta = deltaX / 500;
            const newOpacity = Math.max(0, Math.min(1, state.imageOverlay.opacity + delta));
            state.imageOverlay.opacity = newOpacity;
            startX = e.clientX;
            
            // Mettre à jour le slider si le popup est ouvert
            if (!opacityPopup.classList.contains('hidden')) {
                opacitySlider.value = newOpacity * 100;
                opacityValue.textContent = `${Math.round(newOpacity * 100)}%`;
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        isMoving = false;
        isResizing = false;
        isAdjustingOpacity = false;
    });
    
    // Fermer popup de transparence en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!opacityPopup.contains(e.target) && e.target !== settingsBtn) {
            opacityPopup.classList.add('hidden');
        }
    });
}

function updateOverlayPosition() {
    const overlayControls = document.getElementById('image-overlay-controls');
    if (!overlayControls) return;
    
    if (!state.imageOverlay.img || !state.imageOverlay.visible) {
        overlayControls.classList.add('hidden');
        return;
    }
    
    overlayControls.classList.remove('hidden');
    
    const img = state.imageOverlay.img;
    const scaledWidth = img.width * state.imageOverlay.scale;
    const scaledHeight = img.height * state.imageOverlay.scale;
    
    // Convertir les coordonnées monde en coordonnées écran
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    
    const screenX = (state.imageOverlay.x - state.camera.x) * state.camera.zoom + canvas.width / 2;
    const screenY = (state.imageOverlay.y - state.camera.y) * state.camera.zoom + canvas.height / 2;
    const screenWidth = scaledWidth * state.camera.zoom;
    const screenHeight = scaledHeight * state.camera.zoom;
    
    overlayControls.style.left = `${screenX}px`;
    overlayControls.style.top = `${screenY}px`;
    overlayControls.style.width = `${screenWidth}px`;
    overlayControls.style.height = `${screenHeight}px`;
}

function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.imageOverlay.img = img;
            state.imageOverlay.visible = true;
            
            // Centrer l'image sur la vue actuelle
            const canvas = document.getElementById('gameCanvas');
            const centerX = canvas.width / 2 - (img.width * state.imageOverlay.scale) / 2;
            const centerY = canvas.height / 2 - (img.height * state.imageOverlay.scale) / 2;
            
            // Convertir en coordonnées monde
            state.imageOverlay.x = centerX / state.camera.zoom + state.camera.x;
            state.imageOverlay.y = centerY / state.camera.zoom + state.camera.y;
            
            document.getElementById('import-image-modal').classList.add('hidden');
            
            const overlayControls = document.getElementById('image-overlay-controls');
            if (overlayControls) {
                overlayControls.classList.remove('hidden');
            }
            
            // Initialiser les contrôles overlay si ce n'est pas déjà fait
            setupOverlayControls();
            
            updateOverlayPosition();
            showToast('Image chargée avec succès', 'success');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function loadImageFromUrl(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        state.imageOverlay.img = img;
        state.imageOverlay.visible = true;
        
        // Centrer l'image sur la vue actuelle
        const canvas = document.getElementById('gameCanvas');
        const centerX = canvas.width / 2 - (img.width * state.imageOverlay.scale) / 2;
        const centerY = canvas.height / 2 - (img.height * state.imageOverlay.scale) / 2;
        
        // Convertir en coordonnées monde
        state.imageOverlay.x = centerX / state.camera.zoom + state.camera.x;
        state.imageOverlay.y = centerY / state.camera.zoom + state.camera.y;
        
        document.getElementById('import-image-modal').classList.add('hidden');
        
        const overlayControls = document.getElementById('image-overlay-controls');
        if (overlayControls) {
            overlayControls.classList.remove('hidden');
        }
        
        // Initialiser les contrôles overlay si ce n'est pas déjà fait
        setupOverlayControls();
        
        updateOverlayPosition();
        showToast('Image chargée avec succès', 'success');
    };
    img.onerror = () => {
        showToast('Erreur lors du chargement de l\'image', 'error');
    };
    img.src = url;
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
    
    // Setup modale de code admin
    setupAdminCodeModal();
}

function setupAdminCodeModal() {
    const form = document.getElementById('admin-code-form');
    const input = document.getElementById('admin-code-input');
    const errorDiv = document.getElementById('admin-code-error');
    
    if (!form || !input) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const enteredCode = input.value.trim();
        const isValid = verifyAdminCode(enteredCode);
        
        if (isValid) {
            // Fermer la modale de code
            document.getElementById('admin-code-modal').classList.add('hidden');
            input.value = '';
            errorDiv.classList.add('hidden');
            
            // Ouvrir le panel admin après vérification
            openAdminPanelAfterCode();
        } else {
            // Afficher erreur
            errorDiv.classList.remove('hidden');
            input.value = '';
            input.focus();
            
            // Animation de secousse
            input.style.animation = 'shake 0.5s';
            setTimeout(() => {
                input.style.animation = '';
            }, 500);
        }
    });
    
    // Fermer la modale avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('admin-code-modal');
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                input.value = '';
                errorDiv.classList.add('hidden');
            }
        }
    });
}

function verifyAdminCode(enteredCode) {
    // Code correct stocké : 0304
    const correctCode = '0304';
    
    // Vérifier que le code saisi fait 4 caractères
    if (!enteredCode || enteredCode.length !== 4) {
        return false;
    }
    
    // Transformer le code saisi selon la logique :
    // - Augmenter le 2ème caractère (index 1) de 1
    // - Augmenter le 4ème caractère (index 3) de 1
    let transformedCode = '';
    for (let i = 0; i < enteredCode.length; i++) {
        const char = enteredCode[i];
        const digit = parseInt(char);
        
        if (i === 1 || i === 3) {
            // 2ème et 4ème caractère : augmenter de 1 si c'est un nombre
            if (!isNaN(digit) && digit >= 0 && digit <= 8) {
                transformedCode += (digit + 1).toString();
            } else {
                transformedCode += char; // Garder le caractère si ce n'est pas un nombre valide
            }
        } else {
            // Autres caractères : inchangés
            transformedCode += char;
        }
    }
    
    // Vérifier si le code transformé correspond au code correct
    return transformedCode === correctCode;
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
        // Cooldown réduit (boost joyeux) - différents niveaux selon la durée
        const cooldownSeconds = Math.ceil(currentCooldown / 1000);
        let boostText = 'BOOST ACTIF';
        let boostColor = '#05ffa1'; // vert par défaut
        
        // Supprimer toutes les classes d'animation précédentes
        boostReduced.classList.remove('boost-small', 'boost-normal', 'boost-super', 'boost-ultra');
        
        if (cooldownSeconds >= 45 && cooldownSeconds <= 59) {
            boostText = 'PETIT BOOST ACTIF';
            boostColor = '#05ffa1'; // vert
            boostReduced.classList.add('boost-small');
        } else if (cooldownSeconds >= 30 && cooldownSeconds <= 44) {
            boostText = 'BOOST ACTIF';
            boostColor = '#00BCD4'; // bleu
            boostReduced.classList.add('boost-normal');
        } else if (cooldownSeconds >= 15 && cooldownSeconds <= 29) {
            boostText = 'SUPER BOOST ACTIF';
            boostColor = '#9C27B0'; // violet
            boostReduced.classList.add('boost-super');
        } else if (cooldownSeconds >= 1 && cooldownSeconds <= 14) {
            boostText = 'ULTRA BOOST ACTIF';
            boostColor = '#FF4757'; // rouge
            boostReduced.classList.add('boost-ultra');
        }
        
        boostReduced.classList.remove('hidden');
        const boostTextElement = boostReduced.querySelector('.boost-text');
        boostTextElement.textContent = boostText;
        boostTextElement.style.color = boostColor;
        
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
        // Ajouter un timeout pour éviter le blocage
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout loading public config')), 5000);
        });
        
        const docPromise = firestore.collection('config').doc('public').get();
        const doc = await Promise.race([docPromise, timeoutPromise]);
        
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
                if (banner) {
                    banner.classList.remove('hidden');
                    
                    // Initialiser l'animation de progression sur le bouton de fermeture
                    startAnnouncementCountdown(10000); // 10 secondes
                }
            }
        }
    } catch (e) {
        console.warn('Public config unavailable');
    }
}

function startAnnouncementCountdown(duration) {
    const banner = document.getElementById('announcement-banner');
    if (!banner) return;
    
    // Créer la barre de progression en haut du bandeau
    let progressBar = banner.querySelector('.announcement-progress-bar');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'announcement-progress-bar';
        progressBar.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            height: 2px;
            width: 100%;
            background: #ff6b6b;
            transform-origin: left;
            transform: scaleX(1);
            z-index: 10;
            will-change: transform;
        `;
        banner.appendChild(progressBar);
    }
    
    const startTime = Date.now();
    let animationId = null;
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const scale = 1 - progress;
        
        // Utiliser transform3d pour GPU acceleration
        progressBar.style.transform = `scale3d(${scale}, 1, 1)`;
        
        if (progress < 1 && !banner.classList.contains('hidden')) {
            animationId = requestAnimationFrame(animate);
        } else {
            // Fermer l'annonce quand le temps est écoulé
            if (!banner.classList.contains('hidden')) {
                banner.classList.add('hidden');
            }
            // Supprimer la barre de progression
            if (progressBar.parentNode) {
                progressBar.remove();
            }
            // Nettoyer le will-change
            progressBar.style.willChange = 'auto';
        }
    };
    
    // Démarrer l'animation immédiatement
    animationId = requestAnimationFrame(animate);
    
    // Arrêter l'animation si l'annonce est fermée manuellement
    const stopAnimation = () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (progressBar.parentNode) {
            progressBar.remove();
        }
        if (progressBar) {
            progressBar.style.willChange = 'auto';
        }
    };
    
    const closeBtn = document.getElementById('btn-close-announcement');
    if (closeBtn) {
        closeBtn.addEventListener('click', stopAnimation, { once: true });
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
    const el = document.createElement('div'); 
    el.className = 'toast'; 
    el.textContent = msg;
    
    if(type==='error') el.style.borderLeftColor = '#ff4757'; 
    else if(type==='success') el.style.borderLeftColor = '#2ed573';
    
    const container = document.getElementById('toast-container');
    if (container) {
        container.appendChild(el);
        setTimeout(() => { 
            el.style.opacity='0'; 
            setTimeout(()=>el.remove(),300); 
        }, 3000);
    } else {
        // Fallback: afficher dans la console si le conteneur n'existe pas
        console.warn(`Toast (${type}): ${msg}`);
    }
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

// Initialiser l'état des sons par défaut
window.soundEnabled = true;

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
        // Ne pas initialiser l'audio automatiquement à cause des restrictions autoplay
        // Attendre une interaction utilisateur pour initialiser
        return;
    }
    
    // Vérifier si les sons sont activés
    if (window.soundEnabled === false) {
        return;
    }
    
    try {
        if(audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {
                // Si ça échoue, on abandonne le son pour cette fois
                return;
            });
        }
        
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
        // Silencieux - pas d'erreur dans la console pour l'audio
    }
} 

// Initialisation simple
document.addEventListener('DOMContentLoaded', () => {
    // S'assurer que Firebase est initialisé
    initFirebase();
    
    // Attendre un peu que Firebase soit prêt si nécessaire
    const setupAuthListener = () => {
        if (auth && typeof auth.onAuthStateChanged === 'function') {
            auth.onAuthStateChanged(handleAuthState);
        } else {
            console.error('❌ Firebase auth not ready, retrying in 500ms...');
            setTimeout(setupAuthListener, 500);
        }
    };
    
    // Démarrer l'authentification
    setupAuthListener();
    
    // Initialiser l'interface
    setupAuthUI();
    setupAdminListeners();
    setupGlobalUiListeners();
    auth.onAuthStateChanged(handleAuthState);
    fetchWhitelist();
});

// Si le DOM est déjà chargé
if (document.readyState !== 'loading') {
    initFirebase();
    
    // Attendre un peu que Firebase soit prêt si nécessaire
    const setupAuthListenerImmediate = () => {
        if (auth && typeof auth.onAuthStateChanged === 'function') {
            auth.onAuthStateChanged(handleAuthState);
        } else {
            console.error('❌ Firebase auth not ready, retrying in 500ms...');
            setTimeout(setupAuthListenerImmediate, 500);
        }
    };
    
    // Démarrer l'authentification
    setupAuthListenerImmediate();
    
    // Initialiser l'interface
    setupAuthUI();
    setupAdminListeners();
    setupGlobalUiListeners();
    setupAdminTabs();
}

/* ================= PARAMÈTRES UTILISATEUR ================= */
function setupSettingsModal() {
    const btnSettings = document.getElementById('btn-settings');
    const btnClose = document.getElementById('btn-close-settings');
    const modal = document.getElementById('settings-modal');
    
    if (!btnSettings || !btnClose || !modal) return;
    
    // Ouvrir le modal
    btnSettings.addEventListener('click', () => {
        modal.classList.remove('hidden');
        updateSettingsUI(); // Mettre à jour l'UI avec les valeurs actuelles
        
        // Re-attacher les événements aux contrôles à chaque ouverture avec un délai plus long
        setTimeout(() => {
            setupSettingsControls();
        }, 200);
    });
    
    // Fermer le modal
    btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

function updateSettingsUI() {
    // Mettre à jour l'UI avec les valeurs actuelles
    const opacitySlider = document.getElementById('menu-opacity-slider');
    const opacityValue = document.getElementById('menu-opacity-value');
    const smoothToggle = document.getElementById('smooth-animation-toggle');
    const musicToggle = document.getElementById('background-music-toggle');
    const soundToggle = document.getElementById('sound-effects-toggle');
    
    if (opacitySlider && opacityValue) {
        opacitySlider.value = state.settings.menuOpacity;
        opacityValue.textContent = `${state.settings.menuOpacity}%`;
    }
    
    if (smoothToggle) {
        smoothToggle.checked = state.settings.smoothAnimation;
    }
    
    if (musicToggle) {
        musicToggle.checked = state.settings.backgroundMusic;
    }
    
    if (soundToggle) {
        soundToggle.checked = state.settings.soundEffects;
    }
}

function setupSettingsControls() {
    console.log('🔧 setupSettingsControls appelé');
    
    // Transparence des menus
    const opacitySlider = document.getElementById('menu-opacity-slider');
    const opacityValue = document.getElementById('menu-opacity-value');
    console.log('🎛️ Opacity slider:', opacitySlider, 'value:', opacityValue);
    
    if (opacitySlider && opacityValue) {
        // Supprimer tous les événements existants pour éviter les doublons
        opacitySlider.removeEventListener('input', handleOpacityChange);
        opacitySlider.addEventListener('input', handleOpacityChange);
    }
    
    // Animation fluide
    const smoothToggle = document.querySelector('input#smooth-animation-toggle');
    console.log('🎛️ Smooth toggle trouvé:', smoothToggle);
    if (smoothToggle) {
        console.log('🎛️ Smooth toggle état actuel:', smoothToggle.checked);
        smoothToggle.removeEventListener('change', handleSmoothChange);
        smoothToggle.addEventListener('change', handleSmoothChange);
    } else {
        console.error('❌ Smooth toggle NON TROUVÉ !');
    }
    
    // Musique d'arrière-plan
    const musicToggle = document.querySelector('input#background-music-toggle');
    console.log('🎛️ Music toggle trouvé:', musicToggle);
    if (musicToggle) {
        console.log('🎛️ Music toggle état actuel:', musicToggle.checked);
        musicToggle.removeEventListener('change', handleMusicChange);
        musicToggle.addEventListener('change', handleMusicChange);
    } else {
        console.error('❌ Music toggle NON TROUVÉ !');
    }
    
    // Sons
    const soundToggle = document.querySelector('input#sound-effects-toggle');
    console.log('🎛️ Sound toggle trouvé:', soundToggle);
    if (soundToggle) {
        console.log('🎛️ Sound toggle état actuel:', soundToggle.checked);
        soundToggle.removeEventListener('change', handleSoundChange);
        soundToggle.addEventListener('change', handleSoundChange);
    } else {
        console.error('❌ Sound toggle NON TROUVÉ !');
    }
}

// Fonctions séparées pour gérer les changements
function handleOpacityChange(e) {
    console.log('🎛️ Opacity slider input:', e.target.value);
    const value = e.target.value;
    state.settings.menuOpacity = value;
    document.getElementById('menu-opacity-value').textContent = `${value}%`;
    applyMenuOpacity(value);
    saveUserSettings();
}

function handleSmoothChange(e) {
    console.log('🎛️ Smooth toggle change - target.checked:', e.target.checked);
    console.log('🎛️ Smooth toggle change - e.target:', e.target);
    
    // Forcer la mise à jour immédiate de l'état visuel
    e.target.checked = e.target.checked;
    
    // Mettre à jour l'état et appliquer
    state.settings.smoothAnimation = e.target.checked;
    applySmoothAnimation(e.target.checked);
    saveUserSettings();
    
    // Forcer la mise à jour de l'interface
    setTimeout(() => {
        const smoothToggle = document.getElementById('smooth-animation-toggle');
        if (smoothToggle) {
            smoothToggle.checked = e.target.checked;
        }
    }, 10);
    
    console.log('🎛️ Smooth animation mise à jour:', state.settings.smoothAnimation);
}

function handleMusicChange(e) {
    console.log('🎛️ Music toggle change - target.checked:', e.target.checked);
    console.log('🎛️ Music toggle change - e.target:', e.target);
    
    // Forcer la mise à jour immédiate de l'état visuel
    e.target.checked = e.target.checked;
    
    // Mettre à jour l'état et appliquer
    state.settings.backgroundMusic = e.target.checked;
    applyBackgroundMusic(e.target.checked);
    saveUserSettings();
    
    // Forcer la mise à jour de l'interface
    setTimeout(() => {
        const musicToggle = document.getElementById('background-music-toggle');
        if (musicToggle) {
            musicToggle.checked = e.target.checked;
        }
    }, 10);
    
    console.log('🎛️ Background music mise à jour:', state.settings.backgroundMusic);
}

function handleSoundChange(e) {
    console.log('🎛️ Sound toggle change - target.checked:', e.target.checked);
    console.log('🎛️ Sound toggle change - e.target:', e.target);
    
    // Forcer la mise à jour immédiate de l'état visuel
    e.target.checked = e.target.checked;
    
    // Mettre à jour l'état et appliquer
    state.settings.soundEffects = e.target.checked;
    applySoundEffects(e.target.checked);
    saveUserSettings();
    
    // Forcer la mise à jour de l'interface
    setTimeout(() => {
        const soundToggle = document.getElementById('sound-effects-toggle');
        if (soundToggle) {
            soundToggle.checked = e.target.checked;
        }
    }, 10);
    
    console.log('🎛️ Sound effects mise à jour:', state.settings.soundEffects);
}

function applyMenuOpacity(opacity) {
    const opacityDecimal = opacity / 100;
    const glassElements = document.querySelectorAll('.glass-panel, .glass-pill, .modal-card');
    
    glassElements.forEach(element => {
        element.style.opacity = opacityDecimal;
    });
}

function applySmoothAnimation(enabled) {
    // Activer/désactiver les animations fluides
    if (!enabled) {
        // Arrêter les animations en cours
        if (state.zoomAnimation) {
            cancelAnimationFrame(state.zoomAnimation);
            state.zoomAnimation = null;
        }
        if (state.hoverTransition.animationId) {
            cancelAnimationFrame(state.hoverTransition.animationId);

        }
    }
}

function applyBackgroundMusic(enabled) {
    if (enabled && bgMusic) {
        bgMusic.play().catch(() => console.log('Background music play failed'));
    } else if (!enabled && bgMusic) {
        bgMusic.pause();
    }
}

function applySoundEffects(enabled) {
    // Cette fonction sera utilisée par la fonction playSound
    // pour déterminer si les sons doivent être joués
    window.soundEnabled = enabled;
}

async function loadUserSettings() {
    if (!state.user) return;
    
    try {
        const doc = await firestore.collection('users').doc(state.user.uid).get();
        const userData = doc.data();
        
        if (userData && userData.settings) {
            // Appliquer les paramètres chargés
            state.settings = { ...state.settings, ...userData.settings };
            
            // Appliquer les paramètres immédiatement
            applyMenuOpacity(state.settings.menuOpacity);
            applySmoothAnimation(state.settings.smoothAnimation);
            applyBackgroundMusic(state.settings.backgroundMusic);
            applySoundEffects(state.settings.soundEffects);
        }
    } catch (error) {
        console.error('Erreur chargement paramètres:', error);
    }
}

async function saveUserSettings() {
    if (!state.user) return;
    
    try {
        await firestore.collection('users').doc(state.user.uid).update({
            settings: state.settings
        });
    } catch (error) {
        console.error('Erreur sauvegarde paramètres:', error);
    }
}