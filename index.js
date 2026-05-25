const http = require('http');

// Servidor HTTP para que Render no se duerma
http.createServer((req, res) => {
  res.write("Bot online");
  res.end();
}).listen(process.env.PORT || 3000);

console.log("Servidor HTTP interno listo para Render.");

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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers // Clave para que indexe bien los usuarios
    ]
});

// IDs DE CANALES
const CANAL_BOTONES = '1507503587008188446';
const CANAL_PRINCIPAL = '1424978392696229990'; // #| salón-principal
const CANAL_PANEL_CONTROL = '1508567294551392448'; // #panel-control

// Memoria volátil del bot
let baseCumples = {};

// Bolsa de mensajes fiesteros random para saludar
const mensajesCumple = [
    "¡Hoy se toma fuerte! 🍻 Feliz cumpleaños <@USER>, que pases una noche tremenda en El Burdel. 🎉",
    "💥 ¡Atención comunidad! Hoy es el cumpleaños de <@USER>. Dejen su saludo y paguense una ronda. 🍾 ¡Felicidades fiera!",
    "🎂 ¡Feliz cumple <@USER>! Que arranques el día espectacular. Te mandamos un abrazo gigante de parte de toda la banda. 🎈",
    "🥳 ¡Felicidades <@USER>! Un año más viejo pero más fanchero. Que explote ese festejo hoy. 💥🥂",
    "✨ Que las narguilas y los brindis no falten hoy. ¡Muy feliz cumpleaños <@USER>! Pasala de diez loco. 🛕🔥"
];

// LINKS DE LOS VIVOS
const links = {
    rojo: 'https://web-app.voicemaker.media/room-share.html?roomId=4838650&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    burdel: 'https://web-app.voicemaker.media/room-share.html?roomId=4431474&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    bubbaloo: 'https://web-app.voicemaker.media/room-share.html?roomId=5086826&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    templo: 'https://web-app.voicemaker.media/room-share.html?roomId=4477382&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7'
};

const cooldowns = new Map();
const COOLDOWN_TIEMPO = 1000 * 60 * 60 * 4; // 4 horas

// Función para respaldar los datos en el canal de administración de Discord
async function respaldarEnDiscord() {
    try {
        const canal = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajes = await canal.messages.fetch({ limit: 50 });
        
        // Buscamos si ya existe un mensaje de backup anterior para borrarlo
        const mensajeBackup = mensajes.find(m => m.content.startsWith('||BACKUP_CUMPLES||'));
        if (mensajeBackup) {
            await mensajeBackup.delete();
        }

        // Creamos la cadena secreta de texto
        const textoBackup = '||BACKUP_CUMPLES||' + JSON.stringify(baseCumples);
        await canal.send({ content: textoBackup });
        console.log("💾 Respaldo de cumpleaños guardado con éxito en Discord.");
    } catch (e) {
        console.error("❌ Error al guardar respaldo en Discord:", e);
    }
}

// Función para recuperar los datos desde el canal de Discord
async function recuperarDesdeDiscord() {
    try {
        const canal = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajes = await canal.messages.fetch({ limit: 50 });
        const mensajeBackup = mensajes.find(m => m.content.startsWith('||BACKUP_CUMPLES||'));
        
        if (mensajeBackup) {
            const jsonTexto = mensajeBackup.content.replace('||BACKUP_CUMPLES||', '');
            baseCumples = JSON.parse(jsonTexto);
            console.log("🧠 Memoria recuperada con éxito. Cumpleaños cargados:", Object.keys(baseCumples).length);
        } else {
            baseCumples = {};
            console.log("📂 No se encontró ningún respaldo previo. Iniciando base vacía.");
        }
    } catch (e) {
        baseCumples = {};
        console.error("❌ Error al recuperar respaldo de Discord:", e);
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);

    // 1. RECUPERAR MEMORIA DE CUMPLES PRIMERO
    await recuperarDesdeDiscord();

    // 2. RECONSTRUIR BOTONES DE LAS SALAS VIVAS
    try {
        const canalAnuncios = await client.channels.fetch(CANAL_BOTONES);
        const mensajes = await canalAnuncios.messages.fetch({ limit: 10 });
        const mensajesBot = mensajes.filter(m => m.author.id === client.user.id);
        for (const msg of mensajesBot.values()) {
            await msg.delete();
        }

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
        console.log("📌 Botones de salas listos.");
    } catch (error) {
        console.error("❌ Error en canal de botones:", error);
    }

    // 3. RECONSTRUIR PANEL DE CONTROL EN TU CANAL SECRETO
    try {
        const canalPanel = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajesPanel = await canalPanel.messages.fetch({ limit: 50 });
        
        // Borramos SOLO los mensajes del bot que NO sean el backup oculto
        const mensajesAEditar = mensajesPanel.filter(m => m.author.id === client.user.id && !m.content.startsWith('||BACKUP_CUMPLES||'));
        for (const msg of mensajesAEditar.values()) {
            await msg.delete();
        }

        const filaControl = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_ver_cumples').setLabel('🔵 VER CUMPLEAÑOS').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('admin_agregar_cumple').setLabel('🟢 AGREGAR CUMPLE').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('admin_borrar_cumple').setLabel('🔴 BORRAR CUMPLE').setStyle(ButtonStyle.Danger)
        );

        await canalPanel.send({
            content: '🛠️ **PANEL DE CONTROL GENERAL DEL BOT** 🛠️\nManejá los cumpleaños de los chicos usando los botones interactivos de abajo.',
            components: [filaControl]
        });
        console.log("📌 Panel de control de cumpleaños listo.");
    } catch (error) {
        console.error("❌ Error en canal de panel de control:", error);
    }

    // 4. EL DESPERTADOR EN HORA DE ARGENTINA (00:00)
    new CronJob('0 0 0 * * *', async () => {
        console.log("⏰ Revisando si hoy cumple años alguien...");
        const hoy = moment().tz('America/Argentina/Buenos_Aires').format('DD/MM');
        
        const canalDestino = await client.channels.fetch(CANAL_PRINCIPAL);
        
        for (const [userId, fecha] of Object.entries(baseCumples)) {
            if (fecha === hoy) {
                const fraseElegida = mensajesCumple[Math.floor(Math.random() * mensajesCumple.length)];
                const mensajeFinal = fraseElegida.replace('<@USER>', `<@${userId}>`);
                await canalDestino.send(mensajeFinal);
                console.log(`🎉 Saludo enviado para el usuario ID: ${userId}`);
            }
        }
    }, null, true, 'America/Argentina/Buenos_Aires');
});

const adminCache = new Map();

client.on(Events.InteractionCreate, async interaction => {
    
    // ACCIONES DE BOTONES DE ANUNCIOS DE SALAS
    if (interaction.isButton() && interaction.customId.startsWith('btn_')) {
        let salaKey = interaction.customId.replace('btn_', '');
        if (!['rojo', 'burdel', 'bubbaloo', 'templo'].includes(salaKey)) return;

        const key = `${interaction.user.id}_${salaKey}`;
        const ahora = Date.now();

        if (cooldowns.has(key)) {
            const tiempoPasado = ahora - cooldowns.get(key);
            if (tiempoPasado < COOLDOWN_TIEMPO) {
                const restante = Math.ceil((COOLDOWN_TIEMPO - tiempoPasado) / (1000 * 60 * 60));
                await interaction.reply({ content: `⏳ Ya anunciaste esta sala hoy.\nVolvé en ${restante} horas.`, ephemeral: true });
                setTimeout(async () => { try { await interaction.deleteReply(); } catch (err) {} }, 30000);
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
            await interaction.reply({ content: `✅ ¡Sala **${salaKey.toUpperCase()}** anunciada con éxito!`, ephemeral: true });
            setTimeout(async () => { try { await interaction.deleteReply(); } catch (err) {} }, 10000);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: "❌ Hubo un error al enviar el anuncio.", ephemeral: true });
        }
        return;
    }

    // ACCIONES DEL PANEL DE CUMPLEAÑOS
    if (interaction.isButton() && interaction.customId.startsWith('admin_')) {
        
        if (interaction.customId === 'admin_ver_cumples') {
            if (Object.keys(baseCumples).length === 0) {
                return await interaction.reply({ content: "📂 No hay ningún cumpleaños cargado todavía.", ephemeral: true });
            }

            let textoLista = "🎂 **LISTA DE CUMPLEANIOS REGISTRADOS** 🎂\n\n";
            for (const [userId, fecha] of Object.entries(baseCumples)) {
                textoLista += `• <@${userId}> ➔ **${fecha}**\n`;
            }
            textoLista += `\n*Total: ${Object.keys(baseCumples).length} chicos anotados.*`;

            return await interaction.reply({ content: textoLista, ephemeral: true });
        }

        if (interaction.customId === 'admin_agregar_cumple') {
            const menuUsuarios = new UserSelectMenuBuilder()
                .setCustomId('select_agregar_usuario')
                .setPlaceholder('Seleccioná al cumpleañero de la lista...');

            const filaMenu = new ActionRowBuilder().addComponents(menuUsuarios);

            return await interaction.reply({
                content: "👤 Elegí al chico que querés añadir:",
                components: [filaMenu],
                ephemeral: true
            });
        }

        if (interaction.customId === 'admin_borrar_cumple') {
            if (Object.keys(baseCumples).length === 0) {
                return await interaction.reply({ content: "❌ No hay nadie anotado para borrar.", ephemeral: true });
            }

            const menuUsuariosBorrar = new UserSelectMenuBuilder()
                .setCustomId('select_borrar_usuario')
                .setPlaceholder('Seleccioná a quién querés eliminar...');

            const filaMenuBorrar = new ActionRowBuilder().addComponents(menuUsuariosBorrar);

            return await interaction.reply({
                content: "🗑️ Seleccioná al chico que querés remover:",
                components: [filaMenuBorrar],
                ephemeral: true
            });
        }
    }

    // MANEJO DE DESPLEGABLES
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
                await respaldarEnDiscord(); // Guardamos el cambio en Discord
                return await interaction.reply({ content: `🗑️ Listo Seba, removido <@${usuarioSeleccionado}> del sistema.`, ephemeral: true });
            } else {
                return await interaction.reply({ content: "⚠️ Ese usuario no estaba registrado.", ephemeral: true });
            }
        }
    }

    // RECEPCIÓN DEL FORMULARIO FLOTANTE (MODAL)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_fecha_cumple') {
        const fechaInput = interaction.fields.getTextInputValue('input_fecha');
        const usuarioGuardado = adminCache.get(interaction.user.id);

        const formatoValido = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])$/.test(fechaInput);
        if (!formatoValido) {
            return await interaction.reply({ content: "❌ Formato incorrecto. Ponelo como **DD/MM** (Ejemplo: `04/12`).", ephemeral: true });
        }

        if (!usuarioGuardado) {
            return await interaction.reply({ content: "❌ Error de sesión. Volvé a intentar.", ephemeral: true });
        }

        baseCumples[usuarioGuardado] = fechaInput;
        adminCache.delete(interaction.user.id);
        
        await respaldarEnDiscord(); // Guardamos el backup en Discord definitivo

        return await interaction.reply({
            content: `✅ ¡Espectacular, Seba! Guardado <@${usuarioGuardado}> para el **${fechaInput}**.`,
            ephemeral: true
        });
    }
});

client.login(process.env.TOKEN);
