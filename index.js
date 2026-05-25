const http = require('http');
const fs = require('fs');
const path = require('path');

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
    Events,
    EmbedBuilder
} = require('discord.js');

const { CronJob } = require('cron');
const moment = require('moment-timezone');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers // Necesario para listar usuarios en el desplegable
    ]
});

// IDs DE CANALES
const CANAL_BOTONES = '1507503587008188446';
const CANAL_PRINCIPAL = '1424978392696229990'; // #| salón-principal
const CANAL_PANEL_CONTROL = '1508567294551392448'; // #panel-control

// RUTA DEL ARCHIVO DONDE SE GUARDAN LOS CUMPLES
const ARCHIVO_CUMPLES = path.join(__dirname, 'cumpleanios.json');

// Función para leer los cumpleaños guardados
function leerCumples() {
    if (!fs.existsSync(ARCHIVO_CUMPLES)) return {};
    try {
        return JSON.parse(fs.readFileSync(ARCHIVO_CUMPLES, 'utf8'));
    } catch (e) {
        return {};
    }
}

// Función para guardar los cumpleaños
function guardarCumples(datos) {
    fs.writeFileSync(ARCHIVO_CUMPLES, JSON.stringify(datos, null, 2));
}

// Lista de mensajes fiesteros y random de cumpleaños (Podés cambiar las frases que quieras aquí)
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

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);

    // 1. INICIALIZAR CANAL DE ANUNCIOS DE SALAS
    try {
        const canalAnuncios = await client.channels.fetch(CANAL_BOTONES);
        const mensajes = await canalAnuncios.messages.fetch({ limit: 10 });
        for (const msg of mensajes.values()) {
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
        console.log("📌 Botones de salas creados correctamente.");
    } catch (error) {
        console.error("❌ Error en canal de botones:", error);
    }

    // 2. INICIALIZAR CANAL DE PANEL DE CONTROL (CUMPLEAÑOS)
    try {
        const canalPanel = await client.channels.fetch(CANAL_PANEL_CONTROL);
        const mensajesPanel = await canalPanel.messages.fetch({ limit: 10 });
        for (const msg of mensajesPanel.values()) {
            await msg.delete();
        }

        const filaControl = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_ver_cumples').setLabel('🔵 VER CUMPLEAÑOS').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('admin_agregar_cumple').setLabel('🟢 AGREGAR CUMPLE').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('admin_borrar_cumple').setLabel('🔴 BORRAR CUMPLE').setStyle(ButtonStyle.Danger)
        );

        await canalPanel.send({
            content: '🛠️ **PANEL DE CONTROL GENERAL DEL BOT** 🛠️\nManejá los cumpleaños de los chicos de forma directa usando los botones de abajo.',
            components: [filaControl]
        });
        console.log("📌 Panel de control de cumpleaños inicializado.");
    } catch (error) {
        console.error("❌ Error en canal de panel de control:", error);
    }

    // 3. PROGRAMAR EL DESPERTADOR AUTOMÁTICO (00:00 HORA ARGENTINA)
    new CronJob('0 0 0 * * *', async () => {
        console.log("⏰ Reloj activado: Revisando si hoy cumple años alguien...");
        const hoy = moment().tz('America/Argentina/Buenos_Aires').format('DD/MM');
        const cumples = leerCumples();
        
        const canalDestino = await client.channels.fetch(CANAL_PRINCIPAL);
        
        for (const [userId, fecha] of Object.entries(cumples)) {
            if (fecha === hoy) {
                // Elegir un mensaje ramdom de la bolsa
                const fraseElegida = mensajesCumple[Math.floor(Math.random() * mensajesCumple.length)];
                const mensajeFinal = fraseElegida.replace('<@USER>', `<@${userId}>`);
                
                await canalDestino.send(mensajeFinal);
                console.log(`🎉 Saludo enviado para el usuario ID: ${userId}`);
            }
        }
    }, null, true, 'America/Argentina/Buenos_Aires');
});

// MAPA TEMPORAL PARA RECORDAR QUÉ SELECCIONÓ EL ADMIN ANTES DE RELLENAR EL FORMULARIO
const adminCache = new Map();

client.on(Events.InteractionCreate, async interaction => {
    
    // ----- INTERACCIONES DE LOS BOTONES DE LAS SALAS VIVAS -----
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

    // ----- INTERACCIONES DEL PANEL DE CONTROL DE CUMPLEAÑOS -----
    if (interaction.isButton() && interaction.customId.startsWith('admin_')) {
        
        // BOTÓN: VER LISTADO DE CUMPLES
        if (interaction.customId === 'admin_ver_cumples') {
            const cumples = leerCumples();
            if (Object.keys(cumples).length === 0) {
                return await interaction.reply({ content: "📂 No hay ningún cumpleaños cargado todavía.", ephemeral: true });
            }

            let textoLista = "🎂 **LISTA DE CUMPLEANIOS REGISTRADOS** 🎂\n\n";
            for (const [userId, fecha] of Object.entries(cumples)) {
                textoLista += `• <@${userId}> ➔ **${fecha}**\n`;
            }
            textoLista += `\n*Total: ${Object.keys(cumples).length} chicos anotados.*`;

            return await interaction.reply({ content: textoLista, ephemeral: true });
        }

        // BOTÓN: DESPLEGABLE PARA AGREGAR
        if (interaction.customId === 'admin_agregar_cumple') {
            const menuUsuarios = new UserSelectMenuBuilder()
                .setCustomId('select_agregar_usuario')
                .setPlaceholder('Seleccioná al cumpleañero de la lista...');

            const filaMenu = new ActionRowBuilder().addComponents(menuUsuarios);

            return await interaction.reply({
                content: "👤 Elegí al chico que querés añadir a la base de datos:",
                components: [filaMenu],
                ephemeral: true
            });
        }

        // BOTÓN: DESPLEGABLE PARA BORRAR
        if (interaction.customId === 'admin_borrar_cumple') {
            const cumples = leerCumples();
            if (Object.keys(cumples).length === 0) {
                return await interaction.reply({ content: "❌ No hay nadie anotado para borrar.", ephemeral: true });
            }

            const menuUsuariosBorrar = new UserSelectMenuBuilder()
                .setCustomId('select_borrar_usuario')
                .setPlaceholder('Seleccioná a quién querés eliminar...');

            const filaMenuBorrar = new ActionRowBuilder().addComponents(menuUsuariosBorrar);

            return await interaction.reply({
                content: "🗑️ Seleccioná al chico que querés remover de los saludos automáticos:",
                components: [filaMenuBorrar],
                ephemeral: true
            });
        }
    }

    // ----- RESPUESTA A LA SELECCIÓN DE USUARIOS (DESPLEGABLES) -----
    if (interaction.isUserSelectMenu()) {
        const usuarioSeleccionado = interaction.values[0];

        // Caso: Se eligió a quién agregar -> Abre la ventana flotante (Modal)
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

        // Caso: Se eligió a quién borrar -> Lo elimina de forma directa
        if (interaction.customId === 'select_borrar_usuario') {
            const cumples = leerCumples();
            if (cumples[usuarioSeleccionado]) {
                delete cumples[usuarioSeleccionado];
                guardarCumples(cumples);
                return await interaction.reply({ content: `🗑️ Listo Seba, removido <@${usuarioSeleccionado}> del sistema de cumpleaños.`, ephemeral: true });
            } else {
                return await interaction.reply({ content: "⚠️ Ese usuario no estaba registrado en la lista.", ephemeral: true });
            }
        }
    }

    // ----- RECEPCIÓN DEL FORMULARIO FLOTANTE (MODAL) -----
    if (interaction.isModalSubmit() && interaction.customId === 'modal_fecha_cumple') {
        const fechaInput = interaction.fields.getTextInputValue('input_fecha');
        const usuarioGuardado = adminCache.get(interaction.user.id);

        // Validar formato simple DD/MM con una expresión regular
        const formatoValido = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])$/.test(fechaInput);
        if (!formatoValido) {
            return await interaction.reply({ content: "❌ Formato incorrecto. Tenés que ponerlo exactamente como **DD/MM** (Ejemplo: `04/12`). Volvé a intentar.", ephemeral: true });
        }

        if (!usuarioGuardado) {
            return await interaction.reply({ content: "❌ Error de sesión. Volvé a elegir al usuario.", ephemeral: true });
        }

        const cumples = leerCumples();
        cumples[usuarioGuardado] = fechaInput;
        guardarCumples(cumples);
        adminCache.delete(interaction.user.id);

        return await interaction.reply({
            content: `✅ ¡Espectacular, Seba! Guardado <@${usuarioGuardado}>. Se lo saludará automáticamente cada **${fechaInput}** a las 00:00 hs.`,
            ephemeral: true
        });
    }
});

client.login(process.env.TOKEN);
