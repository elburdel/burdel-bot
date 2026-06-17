const http = require('http');
require('dotenv').config();
const axios = require('axios');

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Events,
    MessageFlags,
    AttachmentBuilder
} = require('discord.js');

const { CronJob } = require('cron');
const moment = require('moment-timezone');

const PORT = process.env.PORT || 10000;
const HUGGING_FACE_URL = process.env.HUGGING_FACE_URL || null;
const API_SPORTS_KEY    = process.env.APIFOOTBALL_KEY || '';     // suspendida, ya no se usa
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || '';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

const CANAL_BOTONES        = '1507503587008188446';
const CANAL_PRINCIPAL      = '1424978392696229990';
const CANAL_PANEL_CONTROL  = '1508567294551392448';
const CANAL_BASE_DATOS     = '1508589852638052474';
const CANAL_AGENDA         = '1512928070758174871';

// Ligas de fútbol a monitorear
// 2=Champions, 3=Europa League, 4=Conference, 9=Bundesliga, 13=Ligue 1,
// 61=Ligue 1 FR, 62=Ligue 2, 71=Serie A BR, 78=Bundesliga, 88=Eredivisie,
// 94=Primeira Liga, 135=Serie A IT, 140=La Liga, 143=Copa del Rey,
// 144=Copa Libertadores, 203=Copa Sudamericana, 253=MLS, 307=Liga Argentina,
// 333=Liga Argentina, 383=Liga Profesional Argentina

let baseCumples = {};
let recordatoriosProgramados = [];

const mensajesCumple = [
    "¡Hoy se toma fuerte! 🍻 Feliz cumpleaños <@USER>, que pases una noche tremenda en El Burdel. 🎉",
    "💥 ¡Atención comunidad! Hoy es el cumpleaños de <@USER>. Dejen su saludo y paguense una ronda. 🍾 ¡Felicidades fiera!",
    "🎂 ¡Feliz cumple <@USER>! Que arranques el día espectacular. Te mandamos un abrazo gigante de parte de toda la banda. 🎈",
    "🥳 ¡Felicidades <@USER>! Un año más viejo pero más fanchero. Que explote ese festejo hoy. 💥🥂",
    "✨ Que las narguilas y los brindis no falten hoy. ¡Muy feliz cumpleaños <@USER>! Pasala de diez loco. 🛕🔥"
];

const links = {
    rojo:     'https://web-app.voicemaker.media/room-share.html?roomId=4838650&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    burdel:   'https://web-app.voicemaker.media/room-share.html?roomId=4431474&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    bubbaloo: 'https://web-app.voicemaker.media/room-share.html?roomId=5086826&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    templo:   'https://web-app.voicemaker.media/room-share.html?roomId=4477382&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7'
};

const cooldowns = new Map();
const COOLDOWN_TIEMPO = 1000 * 60 * 60 * 4;

// ─────────────────────────────────────────────
// BACKUP / RESTAURACIÓN DE CUMPLEAÑOS
// ─────────────────────────────────────────────

async function respaldarEnDiscord() {
    try {
        const canalBD = await client.channels.fetch(CANAL_BASE_DATOS);
        const mensajes = await canalBD.messages.fetch({ limit: 10 });
        const mensajesBackup = mensajes.filter(m => m.author.id === client.user.id);
        for (const msg of mensajesBackup.values()) { await msg.delete().catch(() => {}); }
        await canalBD.send({ content: '||DB_CUMPLES_DATA||' + JSON.stringify(baseCumples) });
        console.log("💾 Datos respaldados con éxito.");
    } catch (e) { console.error("❌ Error al respaldar:", e); }
}

async function recuperarDesdeDiscord() {
    try {
        const canalBD = await client.channels.fetch(CANAL_BASE_DATOS);
        const mensajesBD = await canalBD.messages.fetch({ limit: 5 });
        const backupNuevo = mensajesBD.find(m => m.content.startsWith('||DB_CUMPLES_DATA||'));
        if (backupNuevo) {
            baseCumples = JSON.parse(backupNuevo.content.replace('||DB_CUMPLES_DATA||', ''));
            console.log("🧠 Memoria restaurada. Registros:", Object.keys(baseCumples).length);
            return;
        }
        const canalPanel = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajesPanel = await canalPanel.messages.fetch({ limit: 10 });
        const backupViejo = mensajesPanel.find(m => m.content.startsWith('||BACKUP_CUMPLES||'));
        if (backupViejo) {
            baseCumples = JSON.parse(backupViejo.content.replace('||BACKUP_CUMPLES||', ''));
            await respaldarEnDiscord();
            console.log("🦅 Herencia de datos migrada con éxito.");
        } else {
            baseCumples = {};
            console.log("📂 Sin datos previos. Base limpia.");
        }
    } catch (e) {
        baseCumples = {};
        console.error("❌ Error en recuperación de memoria:", e);
    }
}

// ─────────────────────────────────────────────
// AGENDA DEPORTIVA — APIs
// ─────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// CACHÉ GLOBAL DE AGENDA
// El botón "Ver Agenda" lee esta variable — nunca llama a la API.
// Se rellena una vez a la madrugada (o al arrancar el bot).
// ═══════════════════════════════════════════════════════════════
let agendaCache = { fecha: null, eventos: [] };

// ── Códigos de competición football-data.org (plan free) ──
// WC=Mundial, CL=Champions, EL=Europa League, ECNL=Conference, EC=Eurocopa
// PL=Premier, PD=La Liga, BL1=Bundesliga, SA=Serie A, FL1=Ligue 1
// PPL=Primeira Liga, DED=Eredivisie, BSA=Brasileirão (excluido), CA=Copa América
// ARG=Liga Profesional Argentina (no disponible en free tier)
const COMPS_FUTBOL_FD = ['WC', 'CL', 'EL', 'ECNL', 'EC', 'CA', 'PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'DED'];

const NOMBRE_COMP_FUTBOL = {
    'WC':   'Mundial FIFA 2026',
    'CL':   'Champions League',
    'EL':   'Europa League',
    'ECNL': 'Conference League',
    'EC':   'Eurocopa',
    'CA':   'Copa América',
    'PL':   'Premier League',
    'PD':   'La Liga',
    'BL1':  'Bundesliga',
    'SA':   'Serie A',
    'FL1':  'Ligue 1',
    'PPL':  'Primeira Liga',
    'DED':  'Eredivisie',
};

// IDs TheSportsDB para ligas de fútbol argentino (cubre lo q football-data no tiene)
const TSDB_LIGAS_ARG = [
    { id: '4406', nombre: 'Liga Profesional Argentina' },
    { id: '4960', nombre: 'Copa Argentina' },
    { id: '5342', nombre: 'Copa de la Liga' },
];

// Ligas adicionales fútbol via TheSportsDB
const TSDB_LIGAS_FUTBOL_EXTRA = [
    { id: '4144', nombre: 'Copa Libertadores' },
    { id: '4145', nombre: 'Copa Sudamericana' },
];

// ── Listas blancas de ligas por deporte (IDs de api-sports.io) — LEGACY, ya no usadas ──
const LIGAS_FUTBOL = new Set([
    1,    // FIFA World Cup 2026
    2,    // UEFA Champions League
    3,    // UEFA Europa League
    4,    // UEFA Conference League
    10,   // World - International Friendlies (amistosos de selección)
    15,   // FIFA World Cup (histórico)
    16,   // UEFA Euro
    9,    // Copa América
    29,   // Argentina - Liga Profesional
    26,   // Argentina - Copa de la Liga Profesional
    30,   // Argentina - Primera Nacional (B Nacional)
    34,   // Argentina - Copa Argentina
    39,   // England - Premier League
    61,   // France - Ligue 1
    71,   // Brazil - Série A (Brasileirão)
    78,   // Germany - Bundesliga
    135,  // Italy - Serie A
    140,  // Spain - La Liga
    141,  // Spain - Copa del Rey
    144,  // CONMEBOL - Libertadores
    11,   // CONMEBOL - Sudamericana
    13,   // CONMEBOL - World Cup Qualifying
]);

const NOMBRE_LIGA_FUTBOL = {
    1: 'Mundial FIFA 2026', 2: 'Champions League', 3: 'Europa League', 4: 'Conference League',
    10: 'Amistosos internacionales', 15: 'Mundial FIFA', 16: 'Eurocopa',
    9: 'Copa América', 29: 'Liga Profesional Argentina', 26: 'Copa de la Liga',
    30: 'Primera Nacional', 34: 'Copa Argentina', 39: 'Premier League',
    61: 'Ligue 1', 71: 'Brasileirão', 78: 'Bundesliga', 135: 'Serie A',
    140: 'La Liga', 141: 'Copa del Rey', 144: 'Copa Libertadores',
    11: 'Copa Sudamericana', 13: 'Eliminatorias Mundial',
};

// ── Traducción de nombres de equipos (Mundial 2026 + ligas principales) ──
const TRADUCCION_EQUIPOS = {
    // Grupo A - México, etc
    'Mexico': 'México',
    // Grupo B
    'United States': 'Estados Unidos',
    'USA': 'EE.UU.',
    // Grupo C
    'Argentina': 'Argentina',
    // Grupo general
    'Germany': 'Alemania',
    'France': 'Francia',
    'Spain': 'España',
    'England': 'Inglaterra',
    'Portugal': 'Portugal',
    'Netherlands': 'Países Bajos',
    'Brazil': 'Brasil',
    'Uruguay': 'Uruguay',
    'Colombia': 'Colombia',
    'Chile': 'Chile',
    'Ecuador': 'Ecuador',
    'Peru': 'Perú',
    'Paraguay': 'Paraguay',
    'Bolivia': 'Bolivia',
    'Venezuela': 'Venezuela',
    'Morocco': 'Marruecos',
    'Senegal': 'Senegal',
    'Nigeria': 'Nigeria',
    'Cameroon': 'Camerún',
    'Ghana': 'Ghana',
    'Egypt': 'Egipto',
    'Algeria': 'Argelia',
    'Tunisia': 'Túnez',
    'Ivory Coast': "Costa de Marfil",
    'South Africa': 'Sudáfrica',
    'Japan': 'Japón',
    'South Korea': 'Corea del Sur',
    'Iran': 'Irán',
    'Saudi Arabia': 'Arabia Saudita',
    'Australia': 'Australia',
    'New Zealand': 'Nueva Zelanda',
    'China': 'China',
    'Indonesia': 'Indonesia',
    'Canada': 'Canadá',
    'Costa Rica': 'Costa Rica',
    'Panama': 'Panamá',
    'Jamaica': 'Jamaica',
    'Honduras': 'Honduras',
    'Guatemala': 'Guatemala',
    'Poland': 'Polonia',
    'Belgium': 'Bélgica',
    'Italy': 'Italia',
    'Croatia': 'Croacia',
    'Switzerland': 'Suiza',
    'Denmark': 'Dinamarca',
    'Sweden': 'Suecia',
    'Norway': 'Noruega',
    'Austria': 'Austria',
    'Czech Republic': 'Rep. Checa',
    'Hungary': 'Hungría',
    'Slovakia': 'Eslovaquia',
    'Slovenia': 'Eslovenia',
    'Serbia': 'Serbia',
    'Ukraine': 'Ucrania',
    'Greece': 'Grecia',
    'Turkey': 'Turquía',
    'Romania': 'Rumania',
    'Scotland': 'Escocia',
    'Wales': 'Gales',
    'Ireland': 'Irlanda',
    'Albania': 'Albania',
    'Georgia': 'Georgia',
    'Russia': 'Rusia',
    'Qatar': 'Catar',
    'Iraq': 'Irak',
    'Jordan': 'Jordania',
    'Uzbekistan': 'Uzbekistán',
    'New Caledonia': 'Nueva Caledonia',
    'Kenya': 'Kenia',
    'Congo DR': 'R.D. Congo',
    'Zambia': 'Zambia',
    // Clubes Premier League
    'Manchester City': 'Manchester City',
    'Manchester United': 'Manchester United',
    'Arsenal': 'Arsenal',
    'Chelsea': 'Chelsea',
    'Liverpool': 'Liverpool',
    'Tottenham': 'Tottenham',
    'Newcastle': 'Newcastle',
    'Aston Villa': 'Aston Villa',
    // Clubes La Liga
    'Real Madrid': 'Real Madrid',
    'Barcelona': 'Barcelona',
    'Atletico Madrid': 'Atlético Madrid',
    'Sevilla': 'Sevilla',
    'Valencia': 'Valencia',
    'Villarreal': 'Villarreal',
    'Athletic Club': 'Athletic Club',
    'Real Sociedad': 'Real Sociedad',
    // Clubes Serie A
    'Juventus': 'Juventus',
    'Inter': 'Inter',
    'AC Milan': 'Milan',
    'Napoli': 'Nápoli',
    'Roma': 'Roma',
    'Lazio': 'Lazio',
    // Clubes Bundesliga
    'Bayern Munich': 'Bayern Múnich',
    'Borussia Dortmund': 'Dortmund',
    'RB Leipzig': 'Leipzig',
    'Bayer Leverkusen': 'Leverkusen',
    // Clubes Ligue 1
    'Paris Saint-Germain': 'PSG',
    'Marseille': 'Marsella',
    'Lyon': 'Lyon',
    'Monaco': 'Mónaco',
    // Clubes Argentina
    'River Plate': 'River Plate',
    'Boca Juniors': 'Boca Juniors',
    'Racing Club': 'Racing',
    'Independiente': 'Independiente',
    'San Lorenzo': 'San Lorenzo',
    'Huracan': 'Huracán',
    'Estudiantes': 'Estudiantes',
    'Lanus': 'Lanús',
    'Talleres': 'Talleres',
    'Atletico Tucuman': 'Atlético Tucumán',
    'Defensa y Justicia': 'Defensa y Justicia',
    'Belgrano': 'Belgrano',
    'Tigre': 'Tigre',
    'Godoy Cruz': 'Godoy Cruz',
    'Velez Sarsfield': 'Vélez',
    'Gimnasia La Plata': 'Gimnasia LP',
    'Platense': 'Platense',
    'Instituto': 'Instituto',
    'Sarmiento': 'Sarmiento',
    'Newells Old Boys': "Newell's",
    'Rosario Central': 'Rosario Central',
    'Union de Santa Fe': 'Unión',
    'Colon': 'Colón',
    'Central Cordoba': 'Central Córdoba',
    'Banfield': 'Banfield',
    'Argentinos Juniors': 'Argentinos Jrs',
    'Quilmes': 'Quilmes',
    'San Martin Tucuman': 'San Martín T',
    // NBA
    'Los Angeles Lakers': 'Lakers',
    'Golden State Warriors': 'Warriors',
    'Boston Celtics': 'Celtics',
    'Miami Heat': 'Heat',
    'Chicago Bulls': 'Bulls',
    'New York Knicks': 'Knicks',
    'Brooklyn Nets': 'Nets',
    'Philadelphia 76ers': '76ers',
    'Milwaukee Bucks': 'Bucks',
    'Toronto Raptors': 'Raptors',
    'Denver Nuggets': 'Nuggets',
    'Phoenix Suns': 'Suns',
    'Dallas Mavericks': 'Mavericks',
    'San Antonio Spurs': 'Spurs',
    'Oklahoma City Thunder': 'Thunder',
    'Houston Rockets': 'Rockets',
    'Memphis Grizzlies': 'Grizzlies',
    'New Orleans Pelicans': 'Pelicans',
    'Sacramento Kings': 'Kings',
    'Portland Trail Blazers': 'Blazers',
    'Utah Jazz': 'Jazz',
    'Minnesota Timberwolves': 'Timberwolves',
    'Cleveland Cavaliers': 'Cavaliers',
    'Indiana Pacers': 'Pacers',
    'Atlanta Hawks': 'Hawks',
    'Charlotte Hornets': 'Hornets',
    'Washington Wizards': 'Wizards',
    'Orlando Magic': 'Magic',
    'Detroit Pistons': 'Pistons',
    'Los Angeles Clippers': 'Clippers',
};

function traducirEquipo(nombre) {
    if (!nombre) return '?';
    return TRADUCCION_EQUIPOS[nombre] || nombre;
}

const LIGAS_BASKET  = new Set([12]);  // NBA
const LIGAS_MMA     = new Set([1]);   // UFC
const LIGAS_NHL     = new Set([57]);  // NHL

const TIPOS_TENIS_PERMITIDOS = new Set([
    'Grand Slam', 'ATP Masters 1000', 'ATP 500', 'WTA 1000', 'WTA 500'
]);

function fechaHoy() {
    return moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');
}

// ── Traducción de países para el Mundial ──
const PAISES_MUNDIAL = {
    'Mexico': 'México', 'South Africa': 'Sudáfrica', 'South Korea': 'Corea del Sur',
    'Czech Republic': 'Rep. Checa', 'United States': 'EE.UU.', 'USA': 'EE.UU.',
    'Germany': 'Alemania', 'France': 'Francia', 'Spain': 'España',
    'England': 'Inglaterra', 'Portugal': 'Portugal', 'Netherlands': 'Países Bajos',
    'Brazil': 'Brasil', 'Uruguay': 'Uruguay', 'Colombia': 'Colombia',
    'Chile': 'Chile', 'Ecuador': 'Ecuador', 'Peru': 'Perú',
    'Paraguay': 'Paraguay', 'Bolivia': 'Bolivia', 'Venezuela': 'Venezuela',
    'Morocco': 'Marruecos', 'Senegal': 'Senegal', 'Nigeria': 'Nigeria',
    'Cameroon': 'Camerún', 'Ghana': 'Ghana', 'Egypt': 'Egipto',
    'Algeria': 'Argelia', 'Tunisia': 'Túnez', 'Ivory Coast': 'Costa de Marfil',
    'Congo DR': 'R.D. Congo', 'Kenya': 'Kenia', 'Zambia': 'Zambia',
    'Japan': 'Japón', 'Iran': 'Irán', 'Saudi Arabia': 'Arabia Saudita',
    'Australia': 'Australia', 'New Zealand': 'Nueva Zelanda', 'China': 'China',
    'Indonesia': 'Indonesia', 'Uzbekistan': 'Uzbekistán',
    'Canada': 'Canadá', 'Costa Rica': 'Costa Rica', 'Panama': 'Panamá',
    'Jamaica': 'Jamaica', 'Honduras': 'Honduras', 'Guatemala': 'Guatemala',
    'Cuba': 'Cuba', 'Venezuela': 'Venezuela',
    'Poland': 'Polonia', 'Belgium': 'Bélgica', 'Italy': 'Italia',
    'Croatia': 'Croacia', 'Switzerland': 'Suiza', 'Denmark': 'Dinamarca',
    'Sweden': 'Suecia', 'Norway': 'Noruega', 'Austria': 'Austria',
    'Hungary': 'Hungría', 'Slovakia': 'Eslovaquia', 'Slovenia': 'Eslovenia',
    'Serbia': 'Serbia', 'Ukraine': 'Ucrania', 'Greece': 'Grecia',
    'Turkey': 'Turquía', 'Romania': 'Rumania', 'Scotland': 'Escocia',
    'Wales': 'Gales', 'Albania': 'Albania', 'Georgia': 'Georgia',
    'Jordan': 'Jordania', 'Iraq': 'Irak', 'Qatar': 'Catar',
    'New Caledonia': 'Nueva Caledonia', 'Cabo Verde': 'Cabo Verde',
    'Curacao': 'Curazao',
};

// ── Mundial FIFA 2026: openfootball (GitHub raw, sin API key, sin restricciones IP) ──
async function obtenerMundialOpenfootball() {
    try {
        const resp = await axios.get(
            'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
            { timeout: 15000 }
        );
        const matches = resp.data?.matches || [];
        const hoy = fechaHoy();
        const eventos = [];
        for (const m of matches) {
            if (!m.date || !m.date.startsWith(hoy)) continue;
            // Hora: "13:00 UTC-6" → convertir a AR
            const timeStr = m.time || '';
            const timeMatch = timeStr.match(/^(\d{2}:\d{2})\s*UTC([+-]\d+)$/);
            if (!timeMatch) continue;
            const [, hhmm, offsetStr] = timeMatch;
            const offsetH = parseInt(offsetStr, 10);
            // Construir momento UTC
            const horaUTC = moment.tz(`${hoy} ${hhmm}`, 'YYYY-MM-DD HH:mm', 'UTC').subtract(offsetH, 'hours');
            const horaAR  = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
            if (!horaAR.isValid()) continue;
            eventos.push({
                deporte: 'futbol', emoji: '⚽', hora: horaAR,
                descripcion: `${PAISES_MUNDIAL[m.team1] || m.team1 || '?'} vs ${PAISES_MUNDIAL[m.team2] || m.team2 || '?'}`,
                liga: 'Mundial FIFA 2026',
                rolMencion: 'Fútbol'
            });
        }
        console.log(`⚽ Mundial (openfootball): ${eventos.length} partidos hoy`);
        return eventos;
    } catch (e) {
        console.error('⚠️ Error Mundial (openfootball):', e.message);
        return [];
    }
}

// ── Fútbol europeo: TheSportsDB por liga individual (evita el bloqueo de /matches global) ──
// IDs TheSportsDB de ligas europeas
const TSDB_LIGAS_EUROPEAS = [
    { id: '4480', nombre: 'Champions League' },
    { id: '4481', nombre: 'Europa League' },
    { id: '4335', nombre: 'Premier League' },
    { id: '4332', nombre: 'La Liga' },
    { id: '4331', nombre: 'Bundesliga' },
    { id: '4334', nombre: 'Serie A' },
    { id: '4334', nombre: 'Ligue 1' },
];

async function obtenerFutbolFootballData() {
    // football-data.org bloquea IPs de servidor (403 Host not in allowlist)
    // Esta función queda como fallback vacío — el Mundial va por openfootball
    // y las ligas argentinas/CONMEBOL van por obtenerFutbolTSDB()
    console.log('⚽ football-data.org: omitido (bloquea IPs de servidor)');
    return [];
}

// ── Fútbol argentino + Libertadores/Sudamericana: TheSportsDB ──
async function obtenerFutbolTSDB() {
    const hoy = fechaHoy();
    const todasLasLigas = [...TSDB_LIGAS_ARG, ...TSDB_LIGAS_FUTBOL_EXTRA];
    const eventos = [];
    for (const liga of todasLasLigas) {
        try {
            const resp = await axios.get(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php`, {
                params: { d: hoy, l: liga.id },
                timeout: 10000
            });
            const partidos = resp.data?.events || [];
            for (const p of partidos) {
                const horaStr = p.strTime;
                const fechaStr = p.dateEvent || hoy;
                if (!horaStr || horaStr === '00:00:00') continue;
                const horaUTC = moment.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'UTC');
                const horaAR  = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
                if (!horaAR.isValid()) continue;
                eventos.push({
                    deporte: 'futbol', emoji: '⚽', hora: horaAR,
                    descripcion: `${p.strHomeTeam || '?'} vs ${p.strAwayTeam || '?'}`,
                    liga: liga.nombre,
                    rolMencion: 'Fútbol'
                });
            }
        } catch (e) {
            console.error(`⚠️ Error fútbol TSDB (${liga.nombre}):`, e.message);
        }
    }
    console.log(`⚽ Fútbol ARG/CONMEBOL (TSDB): ${eventos.length} partidos`);
    return eventos;
}

// ── Básquet (NBA): TheSportsDB ──
async function obtenerBasketApiSports() {
    try {
        const hoy = fechaHoy();
        const resp = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
            params: { d: hoy, s: 'Basketball' },
            timeout: 10000
        });
        const events = resp.data?.events || [];
        const eventos = [];
        for (const e of events) {
            if (!e.strLeague?.includes('NBA')) continue;
            const horaStr = e.strTime;
            const fechaStr = e.dateEvent || hoy;
            if (!horaStr || horaStr === '00:00:00') continue;
            const horaUTC = moment.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'UTC');
            const horaAR  = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
            if (!horaAR.isValid()) continue;
            eventos.push({
                deporte: 'basket', emoji: '🏀', hora: horaAR,
                descripcion: `${e.strHomeTeam || '?'} vs ${e.strAwayTeam || '?'}`,
                liga: 'NBA', rolMencion: 'Básquet'
            });
        }
        console.log(`🏀 NBA (TSDB): ${eventos.length} partidos`);
        return eventos;
    } catch (e) {
        console.error('⚠️ Error básquet (TheSportsDB):', e.message);
        return [];
    }
}

// ── Tenis: TheSportsDB (API-Sports no incluido en el plan) ──
async function obtenerTenisApiSports() {
    try {
        const hoy = fechaHoy();
        const resp = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
            params: { d: hoy, s: 'Tennis' },
            timeout: 10000
        });
        const eventos = resp.data?.events || [];
        return eventos.map(e => {
            const horaStr = e.strTime;
            const fechaStr = e.dateEvent || hoy;
            if (!horaStr || horaStr === '00:00:00' || horaStr === '') return null;
            const horaUTC = moment.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'Europe/London');
            const horaAR = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
            if (!horaAR.isValid()) return null;
            return {
                deporte: 'tenis', emoji: '🎾', hora: horaAR,
                descripcion: e.strEvent || 'Partido',
                liga: e.strLeague || 'Tenis', rolMencion: 'Tenis'
            };
        }).filter(Boolean);
    } catch (e) {
        console.error('⚠️ Error tenis (TheSportsDB):', e.message);
        return [];
    }
}

// ── MMA/UFC: TheSportsDB ──
async function obtenerMMAApiSports() {
    try {
        const hoy = fechaHoy();
        const resp = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
            params: { d: hoy, s: 'MMA' },
            timeout: 10000
        });
        const events = resp.data?.events || [];
        const eventos = [];
        for (const e of events) {
            const horaStr = e.strTime;
            const fechaStr = e.dateEvent || hoy;
            if (!horaStr || horaStr === '00:00:00') continue;
            const horaUTC = moment.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'UTC');
            const horaAR  = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
            if (!horaAR.isValid()) continue;
            eventos.push({
                deporte: 'mma', emoji: '🔴', hora: horaAR,
                descripcion: e.strEvent || 'Pelea',
                liga: e.strLeague || 'UFC', rolMencion: 'UFC'
            });
        }
        console.log(`🔴 MMA/UFC (TSDB): ${eventos.length} peleas`);
        return eventos;
    } catch (e) {
        console.error('⚠️ Error MMA (TheSportsDB):', e.message);
        return [];
    }
}

// ── Fórmula 1: TheSportsDB ──
async function obtenerF1ApiSports() {
    try {
        const hoy = fechaHoy();
        const resp = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
            params: { d: hoy, s: 'Motorsport' },
            timeout: 10000
        });
        const events = resp.data?.events || [];
        const eventos = [];
        for (const e of events) {
            if (!e.strLeague?.includes('Formula') && !e.strLeague?.includes('F1')) continue;
            const horaStr = e.strTime;
            const fechaStr = e.dateEvent || hoy;
            if (!horaStr || horaStr === '00:00:00') continue;
            const horaUTC = moment.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'UTC');
            const horaAR  = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
            if (!horaAR.isValid()) continue;
            const nombre = (e.strEvent || '').toLowerCase();
            if (nombre.includes('practice') || nombre.includes('libre')) continue;
            eventos.push({
                deporte: 'f1', emoji: '🏎️', hora: horaAR,
                descripcion: e.strEvent || 'Gran Premio',
                liga: nombre.includes('qualifying') || nombre.includes('classif') ? 'Clasificación' : 'Carrera',
                rolMencion: 'F1'
            });
        }
        console.log(`🏎️ F1 (TSDB): ${eventos.length} sesiones`);
        return eventos;
    } catch (e) {
        console.error('⚠️ Error F1 (TheSportsDB):', e.message);
        return [];
    }
}

// ── NHL: TheSportsDB ──
async function obtenerNHLApiSports() {
    try {
        const hoy = fechaHoy();
        const resp = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
            params: { d: hoy, s: 'Ice Hockey' },
            timeout: 10000
        });
        const events = resp.data?.events || [];
        const eventos = [];
        for (const e of events) {
            if (!e.strLeague?.includes('NHL')) continue;
            const horaStr = e.strTime;
            const fechaStr = e.dateEvent || hoy;
            if (!horaStr || horaStr === '00:00:00') continue;
            const horaUTC = moment.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'UTC');
            const horaAR  = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
            if (!horaAR.isValid()) continue;
            eventos.push({
                deporte: 'nhl', emoji: '🏒', hora: horaAR,
                descripcion: `${e.strHomeTeam || '?'} vs ${e.strAwayTeam || '?'}`,
                liga: 'NHL', rolMencion: 'NHL'
            });
        }
        console.log(`🏒 NHL (TSDB): ${eventos.length} partidos`);
        return eventos;
    } catch (e) {
        console.error('⚠️ Error NHL (TheSportsDB):', e.message);
        return [];
    }
}

// ── Golf y Boxeo: se mantiene TheSportsDB (API-Sports no los cubre bien) ──
async function obtenerEventosTheSportsDB(deporte) {
    try {
        const hoy = fechaHoy();
        const resp = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
            params: { d: hoy, s: deporte },
            timeout: 10000
        });
        const eventos = resp.data?.events || [];
        return eventos.map(e => {
            const horaStr = e.strTime;
            const fechaStr = e.dateEvent || hoy;
            if (!horaStr || horaStr === '00:00:00' || horaStr === '') return null;
            const horaUTC = moment.tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'Europe/London');
            const horaAR = horaUTC.clone().tz('America/Argentina/Buenos_Aires');
            if (!horaAR.isValid()) return null;
            const esGolf = deporte === 'Golf';
            return {
                deporte: deporte.toLowerCase(),
                emoji: esGolf ? '⛳' : '🥊', hora: horaAR,
                descripcion: e.strEvent || 'Evento',
                liga: e.strLeague || '',
                rolMencion: esGolf ? 'Golf' : 'Boxeo'
            };
        }).filter(Boolean);
    } catch (e) {
        console.error(`⚠️ Error TheSportsDB (${deporte}):`, e.message);
        return [];
    }
}

// ── Refresca la caché — solo llamar desde CronJob o al arrancar ──
async function refrescarCacheAgenda() {
    console.log('📡 Refrescando caché de agenda deportiva...');
    const [mundial, futbolArg, basket, tenis, mma, f1, nhl, golf, boxeo] = await Promise.all([
        obtenerMundialOpenfootball(),
        obtenerFutbolTSDB(),
        obtenerBasketApiSports(),
        obtenerTenisApiSports(),
        obtenerMMAApiSports(),
        obtenerF1ApiSports(),
        obtenerNHLApiSports(),
        obtenerEventosTheSportsDB('Golf'),
        obtenerEventosTheSportsDB('Boxing')
    ]);
    const todos = [...mundial, ...futbolArg, ...basket, ...tenis, ...mma, ...f1, ...nhl, ...golf, ...boxeo];
    todos.sort((a, b) => a.hora.valueOf() - b.hora.valueOf());
    agendaCache = { fecha: fechaHoy(), eventos: todos };
    console.log(`✅ Caché lista: ${todos.length} eventos para hoy (${agendaCache.fecha})`);
    return todos;
}

// ── Lectura pública de eventos (lee caché; refresca solo si está vacía) ──
async function obtenerTodosLosEventosHoy() {
    const hoy = fechaHoy();
    if (agendaCache.fecha === hoy) {
        console.log(`📦 Usando caché del día (${agendaCache.eventos.length} eventos)`);
        return agendaCache.eventos;
    }
    return await refrescarCacheAgenda();
}

function formatearAgenda(eventos) {
    if (eventos.length === 0) return '📭 No hay eventos deportivos programados para hoy.';
    let texto = `📅 **AGENDA DEPORTIVA — ${moment().tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}**\n\n`;
    const grupos = {};
    for (const e of eventos) {
        if (!grupos[e.rolMencion]) grupos[e.rolMencion] = [];
        grupos[e.rolMencion].push(e);
    }
    for (const [deporte, evs] of Object.entries(grupos)) {
        texto += `**${evs[0].emoji} ${deporte.toUpperCase()}**\n`;
        for (const ev of evs) {
            texto += `> \`${ev.hora.format('HH:mm')}\` ${ev.descripcion}`;
            if (ev.liga) texto += ` *(${ev.liga})*`;
            texto += '\n';
        }
        texto += '\n';
    }
    return texto;
}

// ─────────────────────────────────────────────
// AGENDA — MENSAJE ESTÁTICO Y RECORDATORIOS
// ─────────────────────────────────────────────

async function inicializarMensajeAgenda() {
    try {
        const canal = await client.channels.fetch(CANAL_AGENDA);
        const mensajes = await canal.messages.fetch({ limit: 20 });
        const msgExistente = mensajes.find(m => m.author.id === client.user.id && m.content.includes('AGENDA DEPORTIVA DEL BURDEL'));
        if (msgExistente) {
            console.log('👍 Mensaje de agenda ya existe.');
            return;
        }

        const fila1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('agenda_ver').setLabel('📅 Ver agenda del día').setStyle(ButtonStyle.Primary)
        );
        const filaSep = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sep_notif').setLabel('🔔 Activá tus notificaciones').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        const fila2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rol_futbol').setLabel('⚽ Fútbol').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rol_tenis').setLabel('🎾 Tenis').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rol_boxeo').setLabel('🥊 Boxeo').setStyle(ButtonStyle.Secondary)
        );
        const fila3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rol_ufc').setLabel('🔴 UFC').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rol_basket').setLabel('🏀 Básquet').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rol_f1').setLabel('🏎️ F1').setStyle(ButtonStyle.Secondary)
        );
        const fila4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rol_golf').setLabel('⛳ Golf').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rol_nhl').setLabel('🏒 NHL').setStyle(ButtonStyle.Secondary)
        );

        await canal.send({
            content: '🏆 **AGENDA DEPORTIVA DEL BURDEL** 🏆',
            components: [fila1, filaSep, fila2, fila3, fila4]
        });
        console.log('📌 Mensaje de agenda creado.');
    } catch (e) {
        console.error('❌ Error inicializando agenda:', e.message);
    }
}

async function programarRecordatoriosDelDia() {
    // Cancelar recordatorios anteriores
    for (const job of recordatoriosProgramados) { try { job.stop(); } catch(e) {} }
    recordatoriosProgramados = [];

    const eventos = await obtenerTodosLosEventosHoy();
    const ahora = moment().tz('America/Argentina/Buenos_Aires');
    const canal = await client.channels.fetch(CANAL_AGENDA).catch(() => null);
    if (!canal) return;

    const guild = canal.guild;

    for (const evento of eventos) {
        const minutos = evento.hora.diff(ahora, 'minutes');
        if (minutos < 5 || minutos > 1440) continue; // solo eventos futuros del día

        const horaRecordatorio = evento.hora.clone().subtract(5, 'minutes');
        if (horaRecordatorio.isBefore(ahora)) continue;

        const cronStr = `${horaRecordatorio.seconds()} ${horaRecordatorio.minutes()} ${horaRecordatorio.hours()} * * *`;

        try {
            const job = new CronJob(cronStr, async () => {
                try {
                    // Buscar rol correspondiente
                    const nombreRol = evento.rolMencion;
                    let rol = guild.roles.cache.find(r => r.name === nombreRol);
                    const mencion = rol ? `<@&${rol.id}>` : `**${nombreRol}**`;

                    await canal.send(
                        `${evento.emoji} ${mencion} ¡En 5 minutos! **${evento.descripcion}**` +
                        (evento.liga ? ` — ${evento.liga}` : '') +
                        ` 🕐 ${evento.hora.format('HH:mm')}`
                    );
                } catch(e) { console.error('❌ Error enviando recordatorio:', e.message); }
            }, null, true, 'America/Argentina/Buenos_Aires');

            recordatoriosProgramados.push(job);
            console.log(`⏰ Recordatorio programado: ${evento.descripcion} a las ${horaRecordatorio.format('HH:mm')}`);
        } catch(e) { console.error('❌ Error programando recordatorio:', e.message); }
    }

    console.log(`✅ ${recordatoriosProgramados.length} recordatorios programados para hoy.`);
}

async function limpiarMensajesAgenda() {
    try {
        const canal = await client.channels.fetch(CANAL_AGENDA);
        const mensajes = await canal.messages.fetch({ limit: 50 });
        const aEliminar = mensajes.filter(m =>
            m.author.id === client.user.id &&
            !m.content.includes('AGENDA DEPORTIVA DEL BURDEL')
        );
        for (const msg of aEliminar.values()) {
            await msg.delete().catch(() => {});
        }
        console.log(`🧹 ${aEliminar.size} mensajes de recordatorio eliminados.`);
    } catch (e) {
        console.error('❌ Error limpiando agenda:', e.message);
    }
}

async function obtenerOCrearRol(guild, nombre, color) {
    let rol = guild.roles.cache.find(r => r.name === nombre);
    if (!rol) {
        rol = await guild.roles.create({ name: nombre, color, reason: 'Rol de agenda deportiva' });
        console.log(`✅ Rol creado: ${nombre}`);
    }
    return rol;
}

async function toggleRol(interaction, nombreRol, color) {
    try {
        const guild = interaction.guild;
        const rol = await obtenerOCrearRol(guild, nombreRol, color);
        const miembro = interaction.member;
        if (miembro.roles.cache.has(rol.id)) {
            await miembro.roles.remove(rol);
            await interaction.reply({ content: `✅ Quitaste las notificaciones de **${nombreRol}**.`, flags: [MessageFlags.Ephemeral] });
        } else {
            await miembro.roles.add(rol);
            await interaction.reply({ content: `✅ Activaste las notificaciones de **${nombreRol}**. Te avisaremos 5 min antes de cada evento.`, flags: [MessageFlags.Ephemeral] });
        }
    } catch (e) {
        console.error(`❌ Error toggling rol ${nombreRol}:`, e.message);
        await interaction.reply({ content: '❌ Error al asignar el rol.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
    }
}

// ─────────────────────────────────────────────
// INICIO DEL BOT
// ─────────────────────────────────────────────

client.once(Events.ClientReady, async () => {
    console.log("===============================================");
    console.log(`🤖 ¡BOT ONLINE EN DISCORD! Conectado como: ${client.user.tag}`);
    console.log("===============================================");
    await recuperarDesdeDiscord().catch(e => console.error("Error cargando memoria:", e));

    try {
        const canalAnuncios = await client.channels.fetch(CANAL_BOTONES);
        const mensajes = await canalAnuncios.messages.fetch({ limit: 10 }).catch(() => null);
        if (canalAnuncios && mensajes) {
            const yaTieneBotones = mensajes.some(m => m.author.id === client.user.id && m.content.includes("PANEL DE ANUNCIOS"));
            if (!yaTieneBotones) {
                const fila1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_rojo').setLabel('🔴 EL CUARTO ROJO').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_burdel').setLabel('🍻 EL BURDEL').setStyle(ButtonStyle.Primary)
                );
                const fila2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bubbaloo').setLabel('🍬 BUBBALOO TEAM').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_templo').setLabel('🛕 EL TEMPLO').setStyle(ButtonStyle.Secondary)
                );
                await canalAnuncios.send({
                    content: '🔥 **PANEL DE ANUNCIOS DE SALAS** 🔥\nPresioná el botón de tu sala para avisar que abriste. *(Límite de un aviso cada 4 hours por persona)*.',
                    components: [fila1, fila2]
                });
                console.log("📌 Botones de salas creados por primera vez.");
            } else { console.log("👍 Los botones de salas ya estaban puestos."); }
        }
    } catch (error) { console.error("❌ Alerta en canal de botones:", error.message); }

    try {
        const canalPanel = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajesPanel = await canalPanel.messages.fetch({ limit: 10 }).catch(() => null);
        if (canalPanel && mensajesPanel) {
            const yaTienePanel = mensajesPanel.some(m => m.author.id === client.user.id && m.content.includes("PANEL DE CONTROL GENERAL"));
            if (!yaTienePanel) {
                const filaControl = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('admin_ver_cumples').setLabel('🔵 VER CUMPLEAÑOS').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('admin_agregar_cumple').setLabel('🟢 AGREGAR CUMPLE').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('admin_borrar_cumple').setLabel('🔴 BORRAR CUMPLE').setStyle(ButtonStyle.Danger)
                );
                await canalPanel.send({
                    content: '🛠️ **PANEL DE CONTROL GENERAL DEL BOT** 🛠️\nManejá los cumpleaños de los chicos usando los botones interactivos de abajo.',
                    components: [filaControl]
                });
                console.log("📌 Panel de control inicializado por primera vez.");
            } else { console.log("👍 El panel de control ya estaba activo."); }
        }
    } catch (error) { console.error("❌ Alerta en canal de panel de control:", error.message); }

    // CronJob cumpleaños
    try {
        new CronJob('0 0 0 * * *', async () => {
            const hoy = moment().tz('America/Argentina/Buenos_Aires').format('DD/MM');
            const canalDestino = await client.channels.fetch(CANAL_PRINCIPAL).catch(() => null);
            if (canalDestino) {
                for (const [userId, fecha] of Object.entries(baseCumples)) {
                    if (fecha === hoy) {
                        const frase = mensajesCumple[Math.floor(Math.random() * mensajesCumple.length)];
                        await canalDestino.send(frase.replace('<@USER>', `<@${userId}>`));
                    }
                }
            }
        }, null, true, 'America/Argentina/Buenos_Aires');
    } catch(err) { console.error("❌ Error al armar el CronJob de cumpleaños:", err); }

    // Inicializar agenda deportiva
    await inicializarMensajeAgenda().catch(e => console.error('❌ Error agenda init:', e.message));

    // Llenar la caché una vez al arrancar y luego programar recordatorios
    await refrescarCacheAgenda().catch(e => console.error('❌ Error cargando agenda:', e.message));
    await programarRecordatoriosDelDia().catch(e => console.error('❌ Error programando recordatorios:', e.message));

    // Cada día a medianoche: limpiar mensajes viejos, refrescar caché y reprogramar
    try {
        new CronJob('0 1 0 * * *', async () => {
            console.log('🌙 Medianoche: limpiando agenda, refrescando caché y reprogramando...');
            await limpiarMensajesAgenda();
            await refrescarCacheAgenda();        // ← llena la caché del día nuevo (1 sola llamada a la API)
            await programarRecordatoriosDelDia(); // ← lee la caché, no la API
        }, null, true, 'America/Argentina/Buenos_Aires');
    } catch(err) { console.error("❌ Error CronJob medianoche:", err); }
});

// ─────────────────────────────────────────────
// INTERACCIONES
// ─────────────────────────────────────────────

const adminCache = new Map();

client.on(Events.InteractionCreate, async interaction => {

    // ── Botones de salas ──
    if (interaction.isButton() && interaction.customId.startsWith('btn_')) {
        const salaKey = interaction.customId.replace('btn_', '');
        if (!['rojo', 'burdel', 'bubbaloo', 'templo'].includes(salaKey)) return;
        const key = `${interaction.user.id}_${salaKey}`;
        const ahora = Date.now();
        if (cooldowns.has(key)) {
            const tiempoPasado = ahora - cooldowns.get(key);
            if (tiempoPasado < COOLDOWN_TIEMPO) {
                const restante = Math.ceil((COOLDOWN_TIEMPO - tiempoPasado) / (1000 * 60 * 60));
                await interaction.reply({ content: `⏳ Ya anunciaste esta sala hoy.\nVolvé en ${restante} horas.`, flags: [MessageFlags.Ephemeral] });
                return;
            }
        }
        cooldowns.set(key, ahora);
        try {
            const canalPrincipal = await client.channels.fetch(CANAL_PRINCIPAL);
            const mensajes = {
                rojo:     `🔴 ${interaction.user.username} abrió El Cuarto Rojo\n\n🔥 Entren acá:\n${links.rojo}`,
                burdel:   `🔥 ${interaction.user.username} abrió El Burdel\n\n🍻 Caigan:\n${links.burdel}`,
                bubbaloo: `🍬 ${interaction.user.username} abrió Bubbaloo Team\n\n✨ Entren:\n${links.bubbaloo}`,
                templo:   `🛕 ${interaction.user.username} abrió El Templo\n\n⚡ Pasen:\n${links.templo}`
            };
            await canalPrincipal.send(mensajes[salaKey]);
            await interaction.reply({ content: `✅ ¡Sala **${salaKey.toUpperCase()}** anunciada!`, flags: [MessageFlags.Ephemeral] });
        } catch (error) { console.error(error); }
        return;
    }

    // ── Botones de agenda deportiva — ver agenda ──
    if (interaction.isButton() && interaction.customId === 'agenda_ver') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        try {
            const eventos = await obtenerTodosLosEventosHoy();
            const texto = formatearAgenda(eventos);
            await interaction.editReply({ content: texto });
        } catch (e) {
            await interaction.editReply({ content: '❌ Error obteniendo la agenda. Intentá de nuevo.' });
        }
        return;
    }

    // ── Botones de autoroles deportivos ──
    if (interaction.isButton() && interaction.customId.startsWith('rol_')) {
        const roles = {
            'rol_futbol': { nombre: 'Fútbol',   color: 0x00FF00 },
            'rol_tenis':  { nombre: 'Tenis',    color: 0xFFFF00 },
            'rol_boxeo':  { nombre: 'Boxeo',    color: 0xFF0000 },
            'rol_ufc':    { nombre: 'UFC',      color: 0xFF4500 },
            'rol_basket': { nombre: 'Básquet',  color: 0xFF8C00 },
            'rol_f1':     { nombre: 'F1',       color: 0xE10600 },
            'rol_golf':   { nombre: 'Golf',     color: 0x006400 },
            'rol_nhl':    { nombre: 'NHL',      color: 0x001F5B }
        };
        const rolInfo = roles[interaction.customId];
        if (rolInfo) {
            await toggleRol(interaction, rolInfo.nombre, rolInfo.color);
        }
        return;
    }

    // ── Botones de panel de control ──
    if (interaction.isButton() && interaction.customId.startsWith('admin_')) {
        if (interaction.customId === 'admin_ver_cumples') {
            if (Object.keys(baseCumples).length === 0) return await interaction.reply({ content: "📂 No hay ningún cumpleaños cargado todavía.", flags: [MessageFlags.Ephemeral] });
            let textoLista = "🎂 **LISTA DE CUMPLEAÑOS REGISTRADOS** 🎂\n\n";
            for (const [userId, fecha] of Object.entries(baseCumples)) { textoLista += `• <@${userId}> ➔ **${fecha}**\n`; }
            textoLista += `\n*Total: ${Object.keys(baseCumples).length} chicos anotados.*`;
            return await interaction.reply({ content: textoLista, flags: [MessageFlags.Ephemeral] });
        }
        if (interaction.customId === 'admin_agregar_cumple') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const menuUsuarios = new UserSelectMenuBuilder().setCustomId('select_agregar_usuario').setPlaceholder('Seleccioná al cumpleañero...');
            return await interaction.editReply({ content: "👤 Elegí al chico:", components: [new ActionRowBuilder().addComponents(menuUsuarios)] });
        }
        if (interaction.customId === 'admin_borrar_cumple') {
            if (Object.keys(baseCumples).length === 0) return await interaction.reply({ content: "❌ No hay nadie anotado.", flags: [MessageFlags.Ephemeral] });
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const menuUsuariosBorrar = new UserSelectMenuBuilder().setCustomId('select_borrar_usuario').setPlaceholder('Seleccioná a quién eliminar...');
            return await interaction.editReply({ content: "🗑️ Seleccioná al chico:", components: [new ActionRowBuilder().addComponents(menuUsuariosBorrar)] });
        }
    }

    if (interaction.isUserSelectMenu()) {
        const usuarioSeleccionado = interaction.values[0];
        if (interaction.customId === 'select_agregar_usuario') {
            adminCache.set(interaction.user.id, usuarioSeleccionado);
            const modal = new ModalBuilder().setCustomId('modal_fecha_cumple').setTitle('Fecha de Cumpleaños');
            const entradaFecha = new TextInputBuilder().setCustomId('input_fecha').setLabel('¿Qué día cumple? (DD/MM)').setPlaceholder('Ejemplo: 15/08').setStyle(TextInputStyle.Short).setMinLength(5).setMaxLength(5).setRequired(true);
            return await interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(entradaFecha)));
        }
        if (interaction.customId === 'select_borrar_usuario') {
            if (baseCumples[usuarioSeleccionado]) {
                delete baseCumples[usuarioSeleccionado];
                await respaldarEnDiscord();
                return await interaction.reply({ content: `🗑️ Listo Seba, removido <@${usuarioSeleccionado}>.`, flags: [MessageFlags.Ephemeral] });
            } else { return await interaction.reply({ content: "⚠️ No estaba registrado.", flags: [MessageFlags.Ephemeral] }); }
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_fecha_cumple') {
        const fechaInput = interaction.fields.getTextInputValue('input_fecha');
        const usuarioGuardado = adminCache.get(interaction.user.id);
        if (!/^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])$/.test(fechaInput)) return await interaction.reply({ content: "❌ Formato incorrecto. Usá DD/MM.", flags: [MessageFlags.Ephemeral] });
        if (!usuarioGuardado) return await interaction.reply({ content: "❌ Error de sesión.", flags: [MessageFlags.Ephemeral] });
        baseCumples[usuarioGuardado] = fechaInput;
        adminCache.delete(interaction.user.id);
        await respaldarEnDiscord();
        return await interaction.reply({ content: `✅ Guardado <@${usuarioGuardado}> para el **${fechaInput}**.`, flags: [MessageFlags.Ephemeral] });
    }
});

// ─────────────────────────────────────────────
// HELPER: leer dimensiones reales de imagen
// ─────────────────────────────────────────────
function leerDimensionesImagen(buffer) {
    try {
        if (buffer[0] === 0x89 && buffer[1] === 0x50) {
            return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            let i = 2;
            while (i < buffer.length - 8) {
                if (buffer[i] === 0xFF) {
                    const marker = buffer[i + 1];
                    if (marker === 0xC0 || marker === 0xC2) {
                        return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) };
                    }
                    i += 2 + buffer.readUInt16BE(i + 2);
                } else { i++; }
            }
        }
    } catch(e) {}
    return { width: null, height: null };
}

// ─────────────────────────────────────────────
// MOTOR DE VIDEOS
// ─────────────────────────────────────────────
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const contenido = message.content;
    const igRegex = /(https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv)\/[^\s]+)/gi;
    const ttRegex = /(https?:\/\/(?:www\.)?(?:tiktok\.com\/@[^\s]+\/video\/[^\s]+|vm\.tiktok\.com\/[^\s]+|vt\.tiktok\.com\/[^\s]+))/gi;
    const twRegex = /(https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s]+\/status\/[0-9]+[^\s]*)/gi;
    const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/shorts\/[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+)[^\s]*)/gi;

    const igMatch = contenido.match(igRegex);
    const ttMatch = contenido.match(ttRegex);
    const twMatch = contenido.match(twRegex);
    const ytMatch = contenido.match(ytRegex);
    if (!igMatch && !ttMatch && !twMatch && !ytMatch) return;

    const linkOriginal = (igMatch || ttMatch || twMatch || ytMatch)[0].split('?')[0];
    const esInstagram  = !!igMatch;
    const esPost       = esInstagram && linkOriginal.includes('/p/');
    const esTwitter    = !!twMatch;
    const esYoutube    = !!ytMatch;

    await message.delete().catch(() => {});

    const msgCargando = await message.channel.send(
        `⏳ Procesando de <@${message.author.id}>...`
    );

    const botonVer = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(esInstagram ? '📸 Ver en Instagram' : esTwitter ? '🐦 Ver en X' : esYoutube ? '▶️ Ver en YouTube' : '🎵 Ver en TikTok')
            .setStyle(ButtonStyle.Link)
            .setURL(linkOriginal)
    );

    // ── Posts /p/ → descarga directa ──
    if (esPost) {
        console.log(`🖼️ Post de IG, descargando directo desde /media/?size=l`);
        try {
            const shortcode = linkOriginal.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1];
            if (!shortcode) throw new Error('No se pudo extraer shortcode');
            const mediaUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
            const imgResp = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                maxRedirects: 5,
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                }
            });
            const buffer = Buffer.from(imgResp.data);
            const { width, height } = leerDimensionesImagen(buffer);
            const adjunto = new AttachmentBuilder(buffer, { name: 'burdel_imagen.jpg' });
            if (width && height) adjunto.setDescription(`${width}x${height}`);
            await message.channel.send({
                content: `🖼️ **${message.author.displayName}** compartió una imagen:`,
                files: [adjunto],
                components: [botonVer()]
            });
            await msgCargando.delete().catch(() => {});
            console.log(`✅ Imagen subida para ${message.author.username}`);
            return;
        } catch (e) {
            console.log(`⚠️ Error descargando imagen: ${e.message}`);
        }
        await msgCargando.edit({
            content: `🖼️ **${message.author.displayName}** compartió una imagen de Instagram:`,
            components: [botonVer()]
        });
        return;
    }

    // ── TikTok → tnktok.com ──
    const esTikTok = !!ttMatch;
    if (esTikTok) {
        const tnktokUrl = linkOriginal
            .replace('www.tiktok.com', 'tnktok.com')
            .replace('vm.tiktok.com', 'tnktok.com')
            .replace('vt.tiktok.com', 'tnktok.com')
            .replace('tiktok.com', 'tnktok.com');
        console.log(`🎵 TikTok via tnktok: ${tnktokUrl}`);
        await msgCargando.edit({
            content: `🎵 **${message.author.displayName}** compartió un TikTok:\n${tnktokUrl}`,
            components: [botonVer()]
        });
        return;
    }

    // ── Reels, X, YouTube → Hugging Face con rotación ──
    const hfUrls = [
        process.env.HUGGING_FACE_URL,
        process.env.HUGGING_FACE_URL_2,
        process.env.HUGGING_FACE_URL_3
    ].filter(Boolean);

    if (hfUrls.length === 0) {
        const red = esInstagram ? 'Instagram' : esTwitter ? 'X' : esYoutube ? 'YouTube' : 'TikTok';
        const emoji = esInstagram ? '📸' : esTwitter ? '🐦' : esYoutube ? '▶️' : '🎵';
        await msgCargando.edit({ content: `${emoji} **${message.author.displayName}** compartió algo de ${red}:`, components: [botonVer()] });
        return;
    }

    let exito = false;
    for (const hfUrl of hfUrls) {
        try {
            console.log(`🔄 Intentando Hugging Face: ${hfUrl}`);
            const resp = await axios.post(`${hfUrl}/process`, { videoUrl: linkOriginal }, { timeout: 120000 });
            const resultado = resp.data;
            if (!resultado?.success) throw new Error(resultado?.error || 'Error de HF');

            if (resultado.tipo === 'imagen') {
                const buffer = Buffer.from(resultado.base64, 'base64');
                const { width, height } = leerDimensionesImagen(buffer);
                const adjunto = new AttachmentBuilder(buffer, { name: 'burdel_imagen.jpg' });
                if (width && height) adjunto.setDescription(`${width}x${height}`);
                await message.channel.send({ content: `🖼️ **${message.author.displayName}** compartió una imagen:`, files: [adjunto], components: [botonVer()] });
                await msgCargando.delete().catch(() => {});
                exito = true;
                break;
            }

            if (resultado.tipo === 'video') {
                const buffer = Buffer.from(resultado.base64Video, 'base64');
                const adjunto = new AttachmentBuilder(buffer, { name: 'burdel_video.mp4' });
                await message.channel.send({ content: `📹 **${message.author.displayName}** compartió un video:`, files: [adjunto], components: [botonVer()] });
                await msgCargando.delete().catch(() => {});
                console.log(`✅ Video subido para ${message.author.username} via ${hfUrl}`);
                exito = true;
                break;
            }
        } catch (err) {
            console.log(`⚠️ ${hfUrl} falló: ${err.message} — probando siguiente...`);
        }
    }

    if (!exito) {
        const red   = esInstagram ? 'Instagram' : esTwitter ? 'X' : esYoutube ? 'YouTube' : 'TikTok';
        const emoji = esInstagram ? '📸' : esTwitter ? '🐦' : esYoutube ? '▶️' : '🎵';
        await msgCargando.edit({ content: `${emoji} **${message.author.displayName}** compartió algo de ${red}:`, components: [botonVer()] });
    }
});

// ─────────────────────────────────────────────
// SERVIDOR HTTP
// ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("Bot online");
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor HTTP listo en el puerto ${PORT}`);
    console.log("🔍 Variables de entorno:");
    if (!process.env.TOKEN) { console.log("❌ TOKEN vacío."); }
    else { console.log(`✅ Token: "${process.env.TOKEN.substring(0, 5)}..."`); }
    if (!HUGGING_FACE_URL) { console.log("⚠️  HUGGING_FACE_URL no configurada."); }
    else { console.log(`✅ Hugging Face: ${HUGGING_FACE_URL}`); }
    console.log('🔐 Intentando client.login()...');
    client.login(process.env.TOKEN)
        .then(() => console.log('✅ client.login() resuelto correctamente'))
        .catch(err => {
            console.error("💥 ERROR AL LOGUEAR EN DISCORD:", err.message);
            console.error("💥 Stack:", err.stack);
        });
});

client.on('error', err => console.error('💥 Client error:', err.message));
client.on('warn',  msg => console.warn('⚠️  Client warn:', msg));
client.on('debug', msg => { if (msg.includes('Heartbeat') || msg.includes('identify') || msg.includes('READY')) console.log('🔧 Debug:', msg); });
