const http = require('http');
require('dotenv').config();

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
    Events
} = require('discord.js');

const { CronJob } = require('cron');
const moment = require('moment-timezone');

const PORT = process.env.PORT || 10000; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// IDs DE CANALES CONFIGURADOS
const CANAL_BOTONES = '1507503587008188446';
const CANAL_PRINCIPAL = '1424978392696229990'; 
const CANAL_PANEL_CONTROL = '1508567294551392448'; 
const CANAL_BASE_DATOS = '1508589852638052474'; 

let baseCumples = {};

const mensajesCumple = [
    "¡Hoy se toma fuerte! 🍻 Feliz cumpleaños <@USER>, que pases una noche tremenda en El Burdel. 🎉",
    "💥 ¡Atención comunidad! Hoy es el cumpleaños de <@USER>. Dejen su saludo y paguense una ronda. 🍾 ¡Felicidades fiera!",
    "🎂 ¡Feliz cumple <@USER>! Que arranques el día espectacular. Te mandamos un abrazo gigante de parte de toda la banda. 🎈",
    "🥳 ¡Felicidades <@USER>! Un año más viejo pero más fanchero. Que explote ese festejo hoy. 💥🥂",
    "✨ Que las narguilas y los brindis no falten hoy. ¡Muy feliz cumpleaños <@USER>! Pasala de diez loco. 🛕🔥"
];

const links = {
    rojo: 'https://web-app.voicemaker.media/room-share.html?roomId=4838650&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    burdel: 'https://web-app.voicemaker.media/room-share.html?roomId=4431474&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    bubbaloo: 'https://web-app.voicemaker.media/room-share.html?roomId=5086826&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    templo: 'https://web-app.voicemaker.media/room-share.html?roomId=4477382&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7'
};

const cooldowns = new Map();
const COOLDOWN_TIEMPO = 1000 * 60 * 60 * 4;

async function respaldarEnDiscord() {
    try {
        const canalBD = await client.channels.fetch(CANAL_BASE_DATOS);
        const mensajes = await canalBD.messages.fetch({ limit: 10 });
        const mensajesBackup = mensajes.filter(m => m.author.id === client.user.id);
        for (const msg of mensajesBackup.values()) { await msg.delete().catch(() => {}); }
        const textoBackup = '||DB_CUMPLES_DATA||' + JSON.stringify(baseCumples);
        await canalBD.send({ content: textoBackup });
        console.log("💾 Datos respaldados con éxito.");
    } catch (e) { console.error("❌ Error al respaldar:", e); }
}

async function recuperarDesdeDiscord() {
    try {
        const canalBD = await client.channels.fetch(CANAL_BASE_DATOS);
        const mensajesBD = await canalBD.messages.fetch({ limit: 5 });
        const backupNuevo = mensajesBD.find(m => m.content.startsWith('||DB_CUMPLES_DATA||'));
        if (backupNuevo) {
            const jsonTexto = backupNuevo.content.replace('||DB_CUMPLES_DATA||', '');
            baseCumples = JSON.parse(jsonTexto);
            console.log("🧠 Memoria restaurada. Registros:", Object.keys(baseCumples).length);
            return;
        }
        const canalPanel = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajesPanel = await canalPanel.messages.fetch({ limit: 10 });
        const backupViejo = mensajesPanel.find(m => m.content.startsWith('||BACKUP_CUMPLES||'));
        if (backupViejo) {
            const jsonTextoViejo = backupViejo.content.replace('||BACKUP_CUMPLES||', '');
            baseCumples = JSON.parse(jsonTextoViejo);
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

client.once(Events.ClientReady, async () => {
    console.log("===============================================");
    console.log(`🤖 ¡BOT ONLINE EN DISCORD! Conectado como: ${client.user.tag}`);
    console.log("===============================================");
    await recuperarDesdeDiscord().catch(e => console.error("Error cargando memoria:", e));
});

// Servidor HTTP básico para Render
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end("Bot online");
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor HTTP interno listo y escuchando en el puerto ${PORT}`);
  console.log("🔍 [DIAGNÓSTICO] Verificando variables de entorno de Render:");
  
  // Imprime los primeros 5 caracteres del token para comprobar si existe sin exponerlo en los logs públicos
  if (!process.env.TOKEN) {
      console.log("❌ ERROR GRAVE: process.env.TOKEN está VACÍO (undefined). El bot no tiene credenciales.");
  } else {
      console.log(`✅ Token detectado correctamente. Comienza con: "${process.env.TOKEN.substring(0, 5)}..."`);
  }

  console.log("🔑 Enviando señal de inicio de sesión a Discord...");
  client.login(process.env.TOKEN).catch(err => {
      console.error("💥 ERROR AL LOGUEAR EN DISCORD:", err);
  });
});
