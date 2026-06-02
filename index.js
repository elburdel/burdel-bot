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
const momentTimezone = require('moment-timezone');

const PORT = process.env.PORT || 10000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// IDs DE CANALES CONFIGURADOS
const CANAL_BOTONES = '1507503587008188446';
const CANAL_PRINCIPAL = '1424978392696229990';
const CANAL_PANEL_CONTROL = '1508567294551392448';
const CANAL_BASE_DATOS = '1508589852638052474';

// URL DE TU NUEVO COMPRESOR AUXILIAR EN HUGGING FACE
const URL_COMPRESOR = 'https://el-burdel-burdel-video-encoder.hf.space/compress';

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
        
        for (const msg of mensajesBackup.values()) {
            await msg.delete().catch(() => {});
        }
        
        const textoBackup = '||DB_CUMPLES_DATA||' + JSON.stringify(baseCumples);
        await canalBD.send({ content: textoBackup });
        console.log("💾 Datos respaldados con éxito en el canal Base de Datos.");
    } catch (e) {
        console.error("❌ Error al respaldar en Discord:", e);
    }
}

async function recuperarDesdeDiscord() {
    try {
        const canalBD = await client.channels.fetch(CANAL_BASE_DATOS);
        const mensajesBD = await canalBD.messages.fetch({ limit: 5 });
        
        const backupNuevo = mensajesBD.find(m => m.content.startsWith('||DB_CUMPLES_DATA||'));
        if (backupNuevo) {
            const jsonTexto = backupNuevo.content.replace('||DB_CUMPLES_DATA||', '');
            baseCumples = JSON.parse(jsonTexto);
            console.log("🧠 Memoria restaurada desde el nuevo canal BD. Registros cargados:", Object.keys(baseCumples).length);
            return;
        }

        const canalPanel = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajesPanel = await canalPanel.messages.fetch({ limit: 10 });
        const backupViejo = mensajesPanel.find(m => m.content.startsWith('||BACKUP_CUMPLES||'));
        
        if (backupViejo) {
            const jsonTextoViejo = backupViejo.content.replace('||BACKUP_CUMPLES||', '');
            baseCumples = JSON.parse(jsonTextoViejo);
            await respaldarEnDiscord();
            console.log("🦅 Herencia encontrada en Panel de Control. Migrado exitosamente a nuevo canal.");
        } else {
            baseCumples = {};
            console.log("📂 Sin datos previos encontrados en ningún canal. Base limpia inicializada.");
        }
    } catch (e) {
        baseCumples = {};
        console.error("❌ Error crítico en recuperación de memoria:", e);
    }
}

client.once(Events.ClientReady, async () => {
    console.log("===============================================");
    console.log(`🤖 ¡BOT ONLINE EN DISCORD! Conectado como: ${client.user.tag}`);
    console.log("===============================================");
    
    await recuperarDesdeDiscord().catch(e => console.error("Error cargando memoria inicial:", e));

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
                    content: '🔥 **PANEL DE ANUNCIOS DE SALAS** 🔥\nPresioná el botón de tu sala para avisar que abriste. *(Límite de un aviso cada 4 horas por persona)*.',
                    components: [fila1, fila2]
                });
                console.log("📌 Botones de salas creados por primera vez.");
            } else {
                console.log("👍 Los botones de salas ya estaban puestos.");
            }
        }
    } catch (error) {
        console.error("❌ Alerta en canal de botones:", error.message);
    }

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
            } else {
                console.log("👍 El panel de control ya estaba activo.");
            }
        }
    } catch (error) {
        console.error("❌ Alerta en canal de panel de control:", error.message);
    }

    try {
        new CronJob('0 0 0 * * *', async () => {
            const hoy = momentTimezone().tz('America/Argentina/Buenos_Aires').format('DD/MM');
            const canalDestino = await client.channels.fetch(CANAL_PRINCIPAL).catch(() => null);
            
            if (canalDestino) {
                for (const [userId, fecha] of Object.entries(baseCumples)) {
                    if (fecha === hoy) {
                        const fraseElegida = mensajesCumple[Math.floor(Math.random() * mensajesCumple.length)];
                        const mensajeFinal = fraseElegida.replace('<@USER>', `<@${userId}>`);
                        await canalDestino.send(mensajeFinal);
                    }
                }
            }
        }, null, true, 'America/Argentina/Buenos_Aires');
    } catch(err) {
        console.error("❌ Error al armar el CronJob de cumple:", err);
    }
});

const adminCache = new Map();

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton() && interaction.customId.startsWith('btn_')) {
        let salaKey = interaction.customId.replace('btn_', '');
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
                rojo: `🔴 ${interaction.user.username} abrió El Cuarto Rojo\n\n🔥 Entren acá:\n${links.rojo}`,
                burdel: `🔥 ${interaction.user.username} abrió El Burdel\n\n🍻 Caigan:\n${links.burdel}`,
                bubbaloo: `🍬 ${interaction.user.username} abrió Bubbaloo Team\n\n✨ Entren:\n${links.bubbaloo}`,
                templo: `🛕 ${interaction.user.username} abrió El Templo\n\n⚡ Pasen:\n${links.templo}`
            };

            await canalPrincipal.send(mensajes[salaKey]);
            await interaction.reply({ content: `✅ ¡Sala **${salaKey.toUpperCase()}** anunciada con éxito!`, flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            console.error("Error al enviar anuncio al canal principal:", error);
        }
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('admin_')) {
        if (interaction.customId === 'admin_ver_cumples') {
            if (Object.keys(baseCumples).length === 0) {
                return await interaction.reply({ content: "📂 No hay ningún cumpleaños cargado todavía.", flags: [MessageFlags.Ephemeral] });
            }
            let textoLista = "🎂 **LISTA DE CUMPLEAÑOS REGISTRADOS** 🎂\n\n";
            for (const [userId, fecha] of Object.entries(baseCumples)) {
                textoLista += `• <@${userId}> ➔ **${fecha}**\n`;
            }
            textoLista += `\n*Total: ${Object.keys(baseCumples).length} chicos anotados.*`;
            return await interaction.reply({ content: textoLista, flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'admin_agregar_cumple') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const menuUsuarios = new UserSelectMenuBuilder()
                .setCustomId('select_agregar_usuario')
                .setPlaceholder('Seleccioná al cumpleañero...');
            return await interaction.editReply({ content: "👤 Elegí al chico que querés agendar:", components: [new ActionRowBuilder().addComponents(menuUsuarios)] });
        }

        if (interaction.customId === 'admin_borrar_cumple') {
            if (Object.keys(baseCumples).length === 0) {
                return await interaction.reply({ content: "❌ No hay nadie registrado para borrar.", flags: [MessageFlags.Ephemeral] });
            }
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const menuUsuariosBorrar = new UserSelectMenuBuilder()
                .setCustomId('select_borrar_usuario')
                .setPlaceholder('Seleccioná a quién eliminar...');
            return await interaction.editReply({ content: "🗑️ Seleccioná al chico que querés remover:", components: [new ActionRowBuilder().addComponents(menuUsuariosBorrar)] });
        }
    }

    if (interaction.isUserSelectMenu()) {
        const usuarioSeleccionado = interaction.values[0];

        if (interaction.customId === 'select_agregar_usuario') {
            adminCache.set(interaction.user.id, usuarioSeleccionado);
            const modal = new ModalBuilder().setCustomId('modal_fecha_cumple').setTitle('Fecha de Cumpleaños');
            const entradaFecha = new TextInputBuilder()
                .setCustomId('input_fecha')
                .setLabel('¿Qué día cumple? (DD/MM)')
                .setPlaceholder('Ejemplo: 15/08')
                .setStyle(TextInputStyle.Short)
                .setMinLength(5)
                .setMaxLength(5)
                .setRequired(true);

            return await interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(entradaFecha)));
        }

        if (interaction.customId === 'select_borrar_usuario') {
            if (baseCumples[usuarioSeleccionado]) {
                delete baseCumples[usuarioSeleccionado];
                await respaldarEnDiscord();
                return await interaction.reply({ content: `🗑️ Listo Seba, removí a <@${usuarioSeleccionado}> de la lista de cumpleaños.`, flags: [MessageFlags.Ephemeral] });
            } else {
                return await interaction.reply({ content: "⚠️ El usuario seleccionado no estaba registrado.", flags: [MessageFlags.Ephemeral] });
            }
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_fecha_cumple') {
        const fechaInput = interaction.fields.getTextInputValue('input_fecha');
        const usuarioGuardado = adminCache.get(interaction.user.id);

        if (!/^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])$/.test(fechaInput)) {
            return await interaction.reply({ content: "❌ Formato incorrecto. Por favor ingresá la fecha como DD/MM (ejemplo: 05/12).", flags: [MessageFlags.Ephemeral] });
        }

        if (!usuarioGuardado) {
            return await interaction.reply({ content: "❌ Error de sesión al guardar. Volvé a intentarlo.", flags: [MessageFlags.Ephemeral] });
        }

        baseCumples[usuarioGuardado] = fechaInput;
        adminCache.delete(interaction.user.id);
        await respaldarEnDiscord();

        return await interaction.reply({ content: `✅ ¡Impecable! Guardé a <@${usuarioGuardado}> para el día **${fechaInput}**.`, flags: [MessageFlags.Ephemeral] });
    }
});

// ==========================================================
// INTERCEPTOR MEJORADO: NO ROMPE NADA Y ASEGURA VISUALIZACIÓN
// ==========================================================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const contenido = message.content;

    const igRegex = /(https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv)\/[^\s]+)/gi;
    const ttRegex = /(https?:\/\/(?:www\.)?(?:tiktok\.com\/@[^\s]+\/video\/[^\s]+|vm\.tiktok\.com\/[^\s]+|vt\.tiktok\.com\/[^\s]+))/gi;

    const igMatch = contenido.match(igRegex);
    const ttMatch = contenido.match(ttRegex);

    if (!igMatch && !ttMatch) return;

    const linkOriginal = (igMatch || ttMatch)[0].split('?')[0]; 
    const esInstagram = !!igMatch;

    // Generamos las URLs espejo idénticas a tu código base original para garantizar visualización nativa
    const linkEspejo = esInstagram 
        ? linkOriginal.replace(/instagram\.com/i, 'ddinstagram.com')
        : linkOriginal.replace(/tiktok\.com/i, 'vxtiktok.com');

    // Botón estético e interactivo inferior
    const botonVer = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(esInstagram ? '📸 Ver en Instagram' : '🎵 Ver en TikTok')
            .setStyle(ButtonStyle.Link)
            .setURL(linkOriginal)
    );

    // 📸 SI ES UNA FOTO FIJA (/p/), SE COLOCA AL INSTANTE COMO ANTES (VISUALIZACIÓN GARANTIZADA)
    if (esInstagram && linkOriginal.toLowerCase().includes('/p/')) {
        try {
            await message.delete().catch(() => {});
            await message.channel.send({
                content: `📸 **${message.author.displayName}** compartió una foto:\n${linkEspejo}`,
                components: [botonVer]
            });
            console.log(`🖼️ Foto de IG procesada nativamente.`);
        } catch (err) {
            console.error("❌ Error enviando foto rápida:", err.message);
        }
        return;
    }

    // 📹 SI ES UN VIDEO (REEL O TIKTOK), INTENTAMOS EL COMPRESOR DE HUGGING FACE
    let msgCargando;
    
    try {
        // En lugar de borrar el mensaje al principio, dejamos que mande el aviso temporal
        msgCargando = await message.channel.send(`⏳ Procesando y optimizando video de <@${message.author.id}>...`);
        await message.delete().catch(() => {});

        // Mandamos la orden al encoder auxiliar gratis
        const respuestaHF = await axios.post(URL_COMPRESOR, {
            videoUrl: linkOriginal
        }, {
            timeout: 45000 // Le damos 45 segundos de margen
        });

        if (respuestaHF.data && respuestaHF.data.success && respuestaHF.data.base64Video) {
            // Si Hugging Face procesó el video con éxito, incrustamos el MP4 ultra comprimido
            const videoBuffer = Buffer.from(respuestaHF.data.base64Video, 'base64');
            const adjunto = new AttachmentBuilder(videoBuffer, { name: 'burdel_video.mp4' });

            await message.channel.send({
                content: `📹 Video optimizado de **${message.author.displayName}**:`,
                files: [adjunto],
                components: [botonVer]
            });

            if (msgCargando) await msgCargando.delete().catch(() => {});
            console.log(`✅ Video incrustado exitosamente con compresión Hugging Face.`);
        } else {
            throw new Error("Respuesta inválida del servidor.");
        }

    } catch (err) {
        // 🚨 PLAN B DEFINITIVO (IGUAL A TU CODIGO ANTERIOR): Si falla Hugging Face, se visualiza al toque como antes
        console.log(`⚠️ Servidor auxiliar falló o dio 500 (${err.message}). Aplicando previsualización nativa anterior.`);
        
        if (msgCargando) {
            await msgCargando.delete().catch(() => {});
        }

        await message.channel.send({
            content: `📹 **${message.author.displayName}** compartió:\n${linkEspejo}`,
            components: [botonVer]
        });
    }
});

// ==========================================
// ARRANQUE DEL SERVIDOR HTTP (SIEMPRE AL FINAL)
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("Bot online");
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor HTTP interno listo y escuchando en el puerto ${PORT}`);
    client.login(process.env.TOKEN).catch(err => {
        console.error("💥 ERROR AL LOGUEAR EN DISCORD:", err);
    });
});
