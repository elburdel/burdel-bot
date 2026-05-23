const http = require('http');
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
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// IDs DE CANALES
const CANAL_BOTONES = '1507503587008188446';
const CANAL_PRINCIPAL = '1424978392696229990';

// LINKS DE LOS VIVOS
const links = {
    rojo: 'https://web-app.voicemaker.media/room-share.html?roomId=4838650&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    burdel: 'https://web-app.voicemaker.media/room-share.html?roomId=4431474&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    bubbaloo: 'https://web-app.voicemaker.media/room-share.html?roomId=5086826&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',
    templo: 'https://web-app.voicemaker.media/room-share.html?roomId=4477382&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7'
};

// COOLDOWNS (Mapa para guardar el último aviso por usuario y por sala)
const cooldowns = new Map();
const COOLDOWN_TIEMPO = 1000 * 60 * 60 * 4; // 4 horas en milisegundos

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);

    try {
        const canal = await client.channels.fetch(CANAL_BOTONES);

        // Limpiar el canal antes de mandar los nuevos botones
        const mensajes = await canal.messages.fetch({ limit: 10 });
        for (const msg of mensajes.values()) {
            await msg.delete();
        }

        // Crear los botones
        const fila1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_rojo')
                .setLabel('🔴 EL CUARTO ROJO')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('btn_burdel')
                .setLabel('🍻 EL BURDEL')
                .setStyle(ButtonStyle.Primary)
        );

        const fila2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_bubbaloo')
                .setLabel('🍬 BUBBALOO TEAM')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('btn_templo')
                .setLabel('🛕 EL TEMPLO')
                .setStyle(ButtonStyle.Secondary)
        );

        await canal.send({
            content: '🔥 **PANEL DE ANUNCIOS DE SALAS** 🔥\nPresioná el botón de tu sala para avisar que abriste. *(Tené en cuenta que hay un límite de un aviso cada 4 horas por persona)*.',
            components: [fila1, fila2]
        });

        console.log("📌 Botones creados y enviados correctamente.");
    } catch (error) {
        console.error("❌ Error al inicializar el canal de botones:", error);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    let salaKey = '';
    if (interaction.customId === 'btn_rojo') salaKey = 'rojo';
    if (interaction.customId === 'btn_burdel') salaKey = 'burdel';
    if (interaction.customId === 'btn_bubbaloo') salaKey = 'bubbaloo';
    if (interaction.customId === 'btn_templo') salaKey = 'templo';

    if (!salaKey) return;

    // Validación de Cooldown por usuario y sala específica
    const key = `${interaction.user.id}_${salaKey}`;
    const ahora = Date.now();

    if (cooldowns.has(key)) {
        const tiempoPasado = ahora - cooldowns.get(key);

        if (tiempoPasado < COOLDOWN_TIEMPO) {
            const restante = Math.ceil((COOLDOWN_TIEMPO - tiempoPasado) / (1000 * 60 * 60));

            await interaction.reply({
                content: `⏳ Ya anunciaste esta sala hoy.\nVolvé en ${restante} horas.`,
                ephemeral: true
            });

            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch (err) {}
            }, 30000);

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

        await interaction.reply({
            content: `✅ ¡Sala **${salaKey.toUpperCase()}** anunciada con éxito en el canal principal!`,
            ephemeral: true
        });

        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (err) {}
        }, 10000);

    } catch (error) {
        console.error("Error al enviar el anuncio:", error);
        await interaction.reply({
            content: "❌ Hubo un error al intentar enviar el anuncio al canal principal.",
            ephemeral: true
        });
    }
});

client.login(process.env.TOKEN);
