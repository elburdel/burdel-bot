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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

const CANAL_BOTONES       = '1507503587008188446';
const CANAL_PRINCIPAL     = '1424978392696229990';
const CANAL_PANEL_CONTROL = '1508567294551392448';
const CANAL_BASE_DATOS    = '1508589852638052474';

let baseCumples = {};

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
    } catch(err) { console.error("❌ Error al armar el CronJob:", err); }
});

const adminCache = new Map();

client.on(Events.InteractionCreate, async interaction => {
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
// HELPER: descargar imagen via RapidAPI
// ─────────────────────────────────────────────
async function descargarImagenDesdeRender(url) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) {
        console.log('⚠️ RAPIDAPI_KEY no configurada');
        return null;
    }

    try {
        const shortcode = url.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1];
        if (!shortcode) return null;

        console.log(`🔍 RapidAPI buscando imagen para shortcode: ${shortcode}`);

        const resp = await axios.get(
            'https://social-media-video-downloader.p.rapidapi.com/instagram/v3/media/post/details',
            {
                params: { shortcode, renderableFormats: 'highres' },
                headers: {
                    'x-rapidapi-key': RAPIDAPI_KEY,
                    'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                },
                timeout: 15000
            }
        );

        const data = resp.data;
        console.log(`📦 RapidAPI respondió, keys:`, Object.keys(data));

        const c0 = data?.contents?.[0];
        const imgUrlRaw = c0?.images?.[0]?.url
    || c0?.display_url
    || c0?.image_url
    || c0?.thumbnail_url
    || c0?.url
    || data?.metadata?.thumbnailUrl
    || data?.display_url
    || data?.url;

if (!imgUrlRaw) {
    console.log('⚠️ RapidAPI: no se encontró URL de imagen, keys c0:', JSON.stringify(Object.keys(c0 || {})));
    return null;
}

// Limpiar parámetros de crop de Instagram para obtener imagen completa
const imgUrl = imgUrlRaw.replace(/stp=[^&]+&?/, '');
console.log(`✅ RapidAPI: imagen encontrada: ${imgUrl}`);

        console.log(`✅ RapidAPI: imagen encontrada: ${imgUrl}`);
        const imgResp = await axios.get(imgUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.instagram.com/',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            timeout: 30000
        });
        return Buffer.from(imgResp.data);

    } catch (e) {
        console.log(`⚠️ RapidAPI falló: ${e.response?.status} — ${e.message}`);
        return null;
    }
}

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

    const igMatch = contenido.match(igRegex);
    const ttMatch = contenido.match(ttRegex);
    if (!igMatch && !ttMatch) return;

    const linkOriginal = (igMatch || ttMatch)[0].split('?')[0];
    const esInstagram  = !!igMatch;
    const esPost       = esInstagram && linkOriginal.includes('/p/');

    await message.delete().catch(() => {});

    const msgCargando = await message.channel.send(
        `⏳ Procesando de <@${message.author.id}>...`
    );

    const botonVer = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(esInstagram ? '📸 Ver en Instagram' : '🎵 Ver en TikTok')
            .setStyle(ButtonStyle.Link)
            .setURL(linkOriginal)
    );

    // ── Posts /p/ → RapidAPI ──
    if (esPost) {
        console.log(`🖼️ Post de IG, usando RapidAPI: ${linkOriginal}`);
        try {
            const buffer = await descargarImagenDesdeRender(linkOriginal);
            if (buffer) {
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
            }
        } catch (e) {
            console.log(`⚠️ Error imagen: ${e.message}`);
        }
        await msgCargando.edit({
            content: `🖼️ **${message.author.displayName}** compartió una imagen de Instagram:`,
            components: [botonVer()]
        });
        return;
    }

    // ── Reels y TikTok → Hugging Face con rotación de IPs ──
    const hfUrls = [
        process.env.HUGGING_FACE_URL,
        process.env.HUGGING_FACE_URL_2,
        process.env.HUGGING_FACE_URL_3
    ].filter(Boolean);

    if (hfUrls.length === 0) {
        const red = esInstagram ? 'Instagram' : 'TikTok';
        const emoji = esInstagram ? '📸' : '🎵';
        await msgCargando.edit({
            content: `${emoji} **${message.author.displayName}** compartió algo de ${red}:`,
            components: [botonVer()]
        });
        return;
    }

    let exito = false;
    for (const hfUrl of hfUrls) {
        try {
            console.log(`🔄 Intentando Hugging Face: ${hfUrl}`);
            const resp = await axios.post(
                `${hfUrl}/process`,
                { videoUrl: linkOriginal },
                { timeout: 120000 }
            );

            const resultado = resp.data;
            if (!resultado?.success) throw new Error(resultado?.error || 'Error de HF');

            if (resultado.tipo === 'imagen') {
                const buffer = Buffer.from(resultado.base64, 'base64');
                const { width, height } = leerDimensionesImagen(buffer);
                const adjunto = new AttachmentBuilder(buffer, { name: 'burdel_imagen.jpg' });
                if (width && height) adjunto.setDescription(`${width}x${height}`);
                await message.channel.send({
                    content: `🖼️ **${message.author.displayName}** compartió una imagen:`,
                    files: [adjunto],
                    components: [botonVer()]
                });
                await msgCargando.delete().catch(() => {});
                exito = true;
                break;
            }

            if (resultado.tipo === 'video') {
                const buffer = Buffer.from(resultado.base64Video, 'base64');
                const adjunto = new AttachmentBuilder(buffer, { name: 'burdel_video.mp4' });
                await message.channel.send({
                    content: `📹 **${message.author.displayName}** compartió un video:`,
                    files: [adjunto],
                    components: [botonVer()]
                });
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
        const red   = esInstagram ? 'Instagram' : 'TikTok';
        const emoji = esInstagram ? '📸' : '🎵';
        await msgCargando.edit({
            content: `${emoji} **${message.author.displayName}** compartió algo de ${red}:`,
            components: [botonVer()]
        });
    }
});

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("Bot online");
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor HTTP listo en el puerto ${PORT}`);
    console.log("🔍 Variables de entorno:");
    if (!process.env.TOKEN) {
        console.log("❌ TOKEN vacío.");
    } else {
        console.log(`✅ Token: "${process.env.TOKEN.substring(0, 5)}..."`);
    }
    if (!HUGGING_FACE_URL) {
        console.log("⚠️  HUGGING_FACE_URL no configurada.");
    } else {
        console.log(`✅ Hugging Face: ${HUGGING_FACE_URL}`);
    }
    client.login(process.env.TOKEN).catch(err => {
        console.error("💥 ERROR AL LOGUEAR EN DISCORD:", err);
    });
});
