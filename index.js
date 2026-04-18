const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');
const config = require('./config.json');

// --- وضع التوكن مباشرة في الكود ---
const TOKEN = "MTQ5NDc3Nzg2NTIyMzQwOTc4NQ.GonndT.3gja0twxXUwUwMnsF_gYwGpwhcAOyn9sZU4jxk";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
    ]
});

// تسجيل أوامر السلاش (Slash Commands)
const slashCommands = [
    {
        name: 'إدارة',
        description: 'فتح قائمة الإدارة المتطورة (باند، طرد، ميوت، سجن)',
    },
    {
        name: 'اسم',
        description: 'تغيير اسم عضو بالسيرفر',
        options: [
            {
                name: 'عضو',
                type: 6, // USER
                description: 'العضو اللي تبي تغير اسمه',
                required: true
            },
            {
                name: 'الاسم',
                type: 3, // STRING
                description: 'الاسم الجديد',
                required: true
            }
        ]
    }
];

client.once('ready', async () => {
    console.log(`✅ تم تشغيل البوت: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('🚀 تم تسجيل أوامر السلاش بنجاح');
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error);
    }
});

// --- نظام الترحيب واللوجات (دخول/خروج) ---
client.on('guildMemberAdd', async (member) => {
    const welcomeChannel = member.guild.channels.cache.get(config.channels.welcome);
    const logChannel = member.guild.channels.cache.get(config.channels.logs);
    const memberCount = member.guild.memberCount;

    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('👋 عضو جديد انضم إلينا!')
            .setDescription(`أهلاً بك **${member.user.username}** في سيرفرنا!\nأنت العضو رقم **<LaTex>${memberCount}** في السيرفر.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setColor('Green')
            .setTimestamp();
        welcomeChannel.send({ content: `$</LaTex>{member}`, embeds: [welcomeEmbed] });
    }

    if (logChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle('📥 دخول عضو')
            .setColor('Green')
            .addFields(
                { name: 'العضو', value: `<LaTex>${member.user.tag} ($</LaTex>{member.id})` },
                { name: 'تاريخ الانضمام للديسكورد', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
            )
            .setTimestamp();
        logChannel.send({ embeds: [logEmbed] });
    }
});

client.on('guildMemberRemove', async (member) => {
    const logChannel = member.guild.channels.cache.get(config.channels.logs);
    if (logChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle('📤 خروج عضو')
            .setColor('Red')
            .addFields(
                { name: 'العضو', value: `${member.user.tag} (${member.id})` }
            )
            .setTimestamp();
        logChannel.send({ embeds: [logEmbed] });
    }
});

// --- نظام الحماية (Auto-Mod) ---
const userLastMessage = new Map();
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const member = message.member;
    const isImmune = member.roles.cache.has(config.roles.founder) || member.roles.cache.has(config.roles.coFounder);
    if (isImmune) return;

    // 1. منع الروابط (5 دقائق تايم أوت وحذف الرسالة)
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    if (linkRegex.test(message.content)) {
        await message.delete().catch(() => {});
        await member.timeout(config.settings.linkTimeoutMinutes * 60 * 1000, 'إرسال روابط ممنوعة').catch(() => {});
        
        const logChannel = client.channels.cache.get(config.channels.logs);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ حماية: حذف رابط')
                .setColor('Red')
                .addFields(
                    { name: 'العضو', value: `${message.author.tag} (${message.author.id})` },
                    { name: 'الرابط', value: message.content }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
        return;
    }

    // 2. منع السبام (3 ثواني تايم أوت وحذف الرسالة)
    const now = Date.now();
    const lastMsgTime = userLastMessage.get(message.author.id);
    if (lastMsgTime && (now - lastMsgTime) < 3000) {
        await message.delete().catch(() => {});
        await member.timeout(3000, 'سبام (إرسال رسائل سريعة)').catch(() => {});
        return;
    }
    userLastMessage.set(message.author.id, now);
});

// --- لوج حذف الرسائل والصور ---
client.on('messageDelete', async (message) => {
    if (message.author?.bot || !message.guild) return;
    const logChannel = client.channels.cache.get(config.channels.logs);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ رسالة محذوفة')
        .setColor('Orange')
        .addFields(
            { name: 'الكاتب', value: `${message.author.tag}`, inline: true },
            { name: 'القناة', value: `${message.channel}`, inline: true },
            { name: 'المحتوى', value: message.content || 'لا يوجد نص (ربما صورة أو ملف)' }
        )
        .setTimestamp();

    if (message.attachments.size > 0) {
        embed.addFields({ name: 'المرفقات', value: message.attachments.map(a => a.url).join('\n') });
    }
    logChannel.send({ embeds: [embed] });
});

// --- التعامل مع الأوامر (Interactions) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'إدارة') {
            const isAuthorized = interaction.member.roles.cache.has(config.roles.founder) || interaction.member.roles.cache.has(config.roles.coFounder);
            if (!isAuthorized) return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة العليا فقط.', ephemeral: true });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('admin_action')
                    .setPlaceholder('اختر الإجراء الإداري المطلوب...')
                    .addOptions([
                        { label: 'باند (Ban)', value: 'ban_action', emoji: '🔨' },
                        { label: 'طرد (Kick)', value: 'kick_action', emoji: '👢' },
                        { label: 'ميوت (Mute)', value: 'mute_action', emoji: '🔇' },
                        { label: 'سجن (Jail)', value: 'jail_action', emoji: '⛓️' }
                    ])
            );

            await interaction.reply({ content: 'يرجى اختيار الإجراء من القائمة أدناه:', components: [row] });
            setTimeout(() => interaction.deleteReply().catch(() => {}), config.settings.deleteDelayMs);
        }

        if (interaction.commandName === 'اسم') {
            const allowedRoles = [config.roles.founder, config.roles.coFounder, config.roles.v, config.roles.iii, config.roles.ii, config.roles.i];
            const hasRole = interaction.member.roles.cache.some(r => allowedRoles.includes(r.id));
            if (!hasRole) return interaction.reply({ content: '❌ ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });

            const target = interaction.options.getMember('عضو');
            const newName = interaction.options.getString('الاسم');
            try {
                const oldName = target.nickname || target.user.username;
                await target.setNickname(newName);
                await interaction.reply({ content: `✅ تم تغيير اسم **${oldName}** إلى **${newName}**` });
            } catch (err) {
                await interaction.reply({ content: '❌ فشل تغيير الاسم (تأكد من رتبة البوت).', ephemeral: true });
            }
            setTimeout(() => interaction.deleteReply().catch(() => {}), config.settings.deleteDelayMs);
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_action') {
        const action = interaction.values[0];
        await interaction.update({ content: `⚠️ تم اختيار ${action}. (يرجى استخدام الأوامر المباشرة حالياً للتنفيذ الكامل)`, components: [] });
    }
});

client.login(TOKEN);
