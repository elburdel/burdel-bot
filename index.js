const http = require('http');
http.createServer((req, res) => {
  res.write("Bot online");
  res.end();
}).listen(process.env.PORT || 3000);

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

    bubbaloo: 'https://web-app.voicemaker.media/room-share.html?roomId=4489755&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7',

    templo: 'https://web-app.voicemaker.media/room-share.html?roomId=4925751&lang=es&shareUid=90993176&coinType=1&diamondType=2&catCoinType=7'
};

// COOLDOWN 24HS
const cooldowns = new Map();

client.once(Events.ClientReady, async () => {

    console.log(`🔥 Bot conectado como ${client.user.tag}`);

    const canal = await client.channels.fetch(CANAL_BOTONES);

    // EVITA DUPLICAR EL MENSAJE DE BOTONES
    const mensajes = await canal.messages.fetch({ limit: 10 });

    const yaExiste = mensajes.find(
        msg =>
            msg.author.id === client.user.id &&
            msg.content.includes('🔴 Salas de Vivo')
    );

    if (yaExiste) {
        console.log('✅ El panel de botones ya existe.');
        return;
    }

    const row1 = new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId('rojo')
                .setLabel('🔴 El Cuarto Rojo')
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId('burdel')
                .setLabel('🔥 El Burdel')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId('bubbaloo')
                .setLabel('🍬 Bubbaloo Team')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId('templo')
                .setLabel('🛕 El Templo')
                .setStyle(ButtonStyle.Success)
        );

    await canal.send({
        content:
`# 🔴 Salas de Vivo

Tocá un botón para compartir un vivo en el salón principal.`,
        components: [row1, row2]
    });

});

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    const sala = interaction.customId;

    const key = `${userId}-${sala}`;

    const ahora = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;

    if (cooldowns.has(key)) {

        const tiempoPasado = ahora - cooldowns.get(key);

        if (tiempoPasado < cooldown) {

            const restante = Math.ceil((cooldown - tiempoPasado) / (1000 * 60 * 60));

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

    const canalPrincipal = await client.channels.fetch(CANAL_PRINCIPAL);

    const mensajes = {

        rojo:
`🔴 ${interaction.user.username} abrió El Cuarto Rojo

🔥 Entren acá:
${links.rojo}`,

        burdel:
`🔥 ${interaction.user.username} abrió El Burdel

🍻 Caigan:
${links.burdel}`,

        bubbaloo:
`🍬 ${interaction.user.username} abrió Bubbaloo Team

✨ Entren:
${links.bubbaloo}`,

        templo:
`🛕 ${interaction.user.username} abrió El Templo

⚡ Pasen:
${links.templo}`
    };

    await canalPrincipal.send(mensajes[sala]);

    await interaction.reply({
        content: '✅ Vivo compartido en el salón principal.',
        ephemeral: true
    });

    // BORRA EL MENSAJE PRIVADO A LOS 30 SEGUNDOS
    setTimeout(async () => {
        try {
            await interaction.deleteReply();
        } catch (err) {}
    }, 30000);

});

client.login(process.env.TOKEN);
