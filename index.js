const http = require('http');

// Render define el puerto en process.env.PORT de forma automática (suele ser 10000)
// Si no existe, usa el 10000 por defecto.
const PORT = process.env.PORT || 10000; 

// Servidor HTTP para que Render no se duerma
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end("Bot online");
});

// Escuchamos en el puerto asignado y en '0.0.0.0' (Esto le vuela la cabeza a Render y acepta la conexión al toque)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor HTTP interno listo y escuchando en el puerto ${PORT}`);
});

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
    Events,
    MessageFlags // <-- Sumamos las Flags para la nueva versión de Discord
} = require('discord.js');

const { CronJob } = require('cron');
const moment = require('moment-timezone');

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

// Guarda el backup eficientemente borrando solo el anterior
async function respaldarEnDiscord() {
    try {
        const canalBD = await client.channels.fetch(CANAL_BASE_DATOS);
        const mensajes = await canalBD.messages.fetch({ limit: 10 }); // Límite bajo para ahorrar RAM
        
        const mensajesBackup = mensajes.filter(m => m.author.id === client.user.id);
        for (const msg of mensajesBackup.values()) {
            await msg.delete().catch(() => {});
        }

        const textoBackup = '||DB_CUMPLES_DATA||' + JSON.stringify(baseCumples);
        await canalBD.send({ content: textoBackup });
        console.log("💾 Datos respaldados con éxito.");
    } catch (e) {
        console.error("❌ Error al respaldar:", e);
    }
}

// Carga los datos pidiendo el mínimo historial posible (Optimizado para Render Free)
async function recuperarDesdeDiscord() {
    try {
        const canalBD = await client.channels.fetch(CANAL_BASE_DATOS);
        const mensajesBD = await canalBD.messages.fetch({ limit: 5 }); // Consume nada de RAM
        const backupNuevo = mensajesBD.find(m => m.content.startsWith('||DB_CUMPLES_DATA||'));
        
        if (backupNuevo) {
            const jsonTexto = backupNuevo.content.replace('||DB_CUMPLES_DATA||', '');
            baseCumples = JSON.parse(jsonTexto);
            console.log("🧠 Memoria restaurada. Registros:", Object.keys(baseCumples).length);
            return;
        }

        // Si no hay nada, busca herencia una única vez
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
    console.log(`✅ Bot conectado como ${client.user.tag}`);

    // 1. LEER LA BASE DE DATOS OCULTA
    await recuperarDesdeDiscord();

    // 2. CONTROL INTELIGENTE DE BOTONES DE SALAS (No borra si ya existen)
    try {
        const canalAnuncios = await client.channels.fetch(CANAL_BOTONES);
        const mensajes = await canalAnuncios.messages.fetch({ limit: 10 });
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
            console.log("👍 Los botones de salas ya estaban puestos. No se gastó RAM.");
        }
    } catch (error) {
        console.error("❌ Error en canal de botones:", error);
    }

    // 3. CONTROL INTELIGENTE DEL PANEL DE CONTROL (No borra si ya existe)
    try {
        const canalPanel = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajesPanel = await canalPanel.messages.fetch({ limit: 10 });
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
            console.log("👍 El panel de control ya estaba activo. No se gastó RAM.");
        }
    } catch (error) {
        console.error("❌ Error en canal de panel de control:", error);
    }

    // 4. RELOJ DE LAS 00:00 EN ARGENTINA
    new CronJob('0 0 0 * * *', async () => {
        const hoy = moment().tz('America/Argentina/Buenos_Aires').format('DD/MM');
        const canalDestino = await client.channels.fetch(CANAL_PRINCIPAL);
        
        for (const [userId, fecha] of Object.entries(baseCumples)) {
            if (fecha === hoy) {
                const fraseElegida = mensajesCumple[Math.floor(Math.random() * mensajesCumple.length)];
                const mensajeFinal = fraseElegida.replace('<@USER>', `<@${userId}>`);
                await canalDestino.send(mensajeFinal);
            }
        }
    }, null, true, 'America/Argentina/Buenos_Aires');
});

const adminCache = new Map();

client.on(Events.InteractionCreate, async interaction => {
    
    // INTERACCIONES DE SALAS
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
                setTimeout(async () => { try { await interaction.deleteReply(); } catch (err) {} }, 30000);
                return;
            }
        }

        cooldowns.set(key, trabaja = ahora);

        try {
            const canalPrincipal = await client.channels.fetch(CANAL_PRINCIPAL);
            const mensajes = {
                rojo: `🔴 ${interaction.user.username} abrió El Cuarto Rojo\n\n🔥 Entren acá:\n${links.rojo}`,
                burdel: `🔥 ${interaction.user.username} abrió El Burdel\n\n🍻 Caigan:\n${links.burdel}`,
                bubbaloo: `🍬 ${interaction.user.username} abrió Bubbaloo Team\n\n✨ Entren:\n${links.bubbaloo}`,
                templo: `🛕 ${interaction.user.username} abrió El Templo\n\n⚡ Pasen:\n${links.templo}`
            };

            await canalPrincipal.send(mensajes[salaKey]);
            await interaction.reply({ content: `✅ ¡Sala **${salaKey.toUpperCase()}** anunciada!`, flags: [MessageFlags.Ephemeral] });
            setTimeout(async () => { try { await interaction.deleteReply(); } catch (err) {} }, 10000);
        } catch (error) {
            console.error(error);
        }
        return;
    }

    // INTERACCIONES DEL PANEL (Corregido con Formato Flags + DeferReply)
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
            // Avisamos a Discord que aguarde un toque usando el nuevo sistema de Flags
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const menuUsuarios = new UserSelectMenuBuilder()
                .setCustomId('select_agregar_usuario')
                .setPlaceholder('Seleccioná al cumpleañero de la lista...');

            const filaMenu = new ActionRowBuilder().addComponents(menuUsuarios);

            return await interaction.editReply({
                content: "👤 Elegí al chico que querés añadir:",
                components: [filaMenu]
            });
        }

        if (interaction.customId === 'admin_borrar_cumple') {
            if (Object.keys(baseCumples).length === 0) {
                return await interaction.reply({ content: "❌ No hay nadie anotado para borrar.", flags: [MessageFlags.Ephemeral] });
            }

            // Avisamos a Discord que aguarde un toque usando el nuevo sistema de Flags
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const menuUsuariosBorrar = new UserSelectMenuBuilder()
                .setCustomId('select_borrar_usuario')
                .setPlaceholder('Seleccioná a quién querés eliminar...');

            const filaMenuBorrar = new ActionRowBuilder().addComponents(menuUsuariosBorrar);

            return await interaction.editReply({
                content: "🗑️ Seleccioná al chico que querés remover:",
                components: [filaMenuBorrar]
            });
        }
    }

    // MENÚS DESPLEGABLES
    if (interaction.isUserSelectMenu()) {
        const usuarioSeleccionado = interaction.values[0];

        if (interaction.customId === 'select_agregar_usuario') {
            adminCache.set(interaction.user.id, usuarioSeleccionado);

            const modal = new ModalBuilder()
                .setCustomId('modal_fecha_cumple')
                .setTitle('Fecha de Cumpleaños');

            const entradaFecha = new TextInputBuilder()
                .setCustomId('input_fecha')
                .setLabel('¿Qué día cumple? (Formato: DD/MM)')
                .setPlaceholder('Ejemplo: 15/08')
                .setStyle(TextInputStyle.Short)
                .setMinLength(5)
                .setMaxLength(5)
                .setRequired(true);

            const filaModal = new ActionRowBuilder().addComponents(entradaFecha);
            modal.addComponents(filaModal);

            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'select_borrar_usuario') {
            if (baseCumples[usuarioSeleccionado]) {
                delete baseCumples[usuarioSeleccionado];
                await respaldarEnDiscord();
                return await interaction.reply({ content: `🗑️ Listo Seba, removido <@${usuarioSeleccionado}>.`, flags: [MessageFlags.Ephemeral] });
            } else {
                return await interaction.reply({ content: "⚠️ Ese usuario no estaba registrado.", flags: [MessageFlags.Ephemeral] });
            }
        }
    }

    // SUBMIT DEL MODAL
    if (interaction.isModalSubmit() && interaction.customId === 'modal_fecha_cumple') {
        const fechaInput = interaction.fields.getTextInputValue('input_fecha');
        const usuarioGuardado = adminCache.get(interaction.user.id);

        const formatoValido = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])$/.test(fechaInput);
        if (!formatoValido) {
            return await interaction.reply({ content: "❌ Formato incorrecto. Ponelo como **DD/MM** (Ejemplo: `04/12`).", flags: [MessageFlags.Ephemeral] });
        }

        if (!usuarioGuardado) {
            return await interaction.reply({ content: "❌ Error de sesión. Volvé a intentar.", flags: [MessageFlags.Ephemeral] });
        }

        baseCumples[usuarioGuardado] = fechaInput;
        adminCache.delete(interaction.user.id);
        
        await respaldarEnDiscord();

        return await interaction.reply({
            content: `✅ ¡Espectacular, Seba! Guardado <@${usuarioGuardado}> para el **${fechaInput}**.`,
            flags: [MessageFlags.Ephemeral]
        });
    }
});

client.login(process.env.TOKEN);
