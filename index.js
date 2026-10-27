const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');

// --- الإعدادات ---
const token = process.env.BOT_TOKEN || '6903487941:AAGFXw4074lMGMzc_HOHIeJQGuylDW6iPE4';
const bot = new TelegramBot(token, { polling: true });
const ADMIN_ID = 700217964;

// نظام تخزين محلي آمن يعتمد على ملف JSON (بدون أخطاء قاعدة البيانات)
const DB_FILE = 'database.json';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, settings: { channel: "ABOJLQ" } }, null, 2));
}

function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { users: {}, settings: { channel: "ABOJLQ" } };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function getChannel(callback) {
    const db = readDB();
    callback(db.settings.channel || null);
}

function setChannel(username, callback) {
    const db = readDB();
    const val = username && username !== "off" ? username.replace("@", "") : null;
    db.settings.channel = val;
    writeDB(db);
    if (callback) callback();
}

function getUserLang(userId, callback) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = { lang: "ar" };
        writeDB(db);
    }
    callback(db.users[userId].lang || "ar");
}

function setUserLang(userId, lang) {
    const db = readDB();
    if (!db.users[userId]) db.users[userId] = {};
    db.users[userId].lang = lang;
    writeDB(db);
}

function addUser(userId) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = { lang: "ar" };
        writeDB(db);
    }
}

function getAllUsers(callback) {
    const db = readDB();
    callback(Object.keys(db.users).map(id => Number(id)));
}

// --- النصوص والأيقونات ---
const texts = {
    "ar": {
        "start": "مرحباً بك! أرسل رابط الفيديو للتحميل 📥",
        "sub": "يجب الاشتراك في القناة أولاً 📢:",
        "btn_sub": "اشترك بالقناة ➕",
        "btn_check": "تحقق ✅",
        "btn_lang": "English 🇬🇧",
        "dev": "👤 المطور",
        "chan": "📢 القناة",
        "stats": "📊 الاحصائيات",
        "broad": "📢 إذاعة",
        "set_c": "⚙️ تغيير القناة",
        "rem_c": "🚫 إزالة القناة"
    },
    "en": {
        "start": "Welcome! Send the video link to download 📥",
        "sub": "You must join the channel first 📢:",
        "btn_sub": "Join Channel ➕",
        "btn_check": "Verify ✅",
        "btn_lang": "العربية 🇮🇶",
        "dev": "👤 Developer",
        "chan": "📢 Channel",
        "stats": "📊 Stats",
        "broad": "📢 Broadcast",
        "set_c": "⚙️ Set Channel",
        "rem_c": "🚫 Remove Channel"
    }
};

async function checkSub(userId, channel) {
    if (!channel) return true;
    try {
        const res = await bot.getChatMember(`@${channel}`, userId);
        return ['member', 'administrator', 'creator'].includes(res.status);
    } catch (e) {
        return false;
    }
}

async function sendStartMessage(chatId, userId) {
    addUser(userId);
    getUserLang(userId, async (lang) => {
        getChannel(async (channel) => {
            if (channel && !(await checkSub(userId, channel))) {
                const btn = {
                    inline_keyboard: [
                        [
                            { text: texts[lang]["btn_sub"], url: `https://t.me/${channel}` },
                            { text: texts[lang]["btn_check"], callback_data: "check" }
                        ]
                    ]
                };
                bot.sendMessage(chatId, `${texts[lang]['sub']} @${channel}`, { reply_markup: btn }).catch(() => {});
                return;
            }

            let ky = {
                inline_keyboard: [
                    [
                        { text: texts[lang]["dev"], url: 'https://t.me/ABOJL' },
                        { text: texts[lang]["chan"], url: channel ? `https://t.me/${channel}` : 'https://t.me/ABOJLQ' }
                    ],
                    [
                        { text: texts[lang]["btn_lang"], callback_data: `lang_${lang === 'ar' ? 'en' : 'ar'}` }
                    ]
                ]
            };

            if (userId === ADMIN_ID) {
                ky.inline_keyboard.push([
                    { text: texts[lang]["stats"], callback_data: 'stats' },
                    { text: texts[lang]["broad"], callback_data: 'broadcast' }
                ]);
                ky.inline_keyboard.push([
                    { text: texts[lang]["set_c"], callback_data: 'set_chan' },
                    { text: texts[lang]["rem_c"], callback_data: 'rem_chan' }
                ]);
            }

            bot.sendMessage(chatId, texts[lang]["start"], { reply_markup: ky }).catch(() => {});
        });
    });
}

const userStates = {};

bot.onText(/\/start/, (msg) => {
    delete userStates[msg.from.id];
    sendStartMessage(msg.chat.id, msg.from.id);
});

// معالجة الأزرار
bot.on('callback_query', async (call) => {
    const userId = call.from.id;
    const chatId = call.message.chat.id;
    const messageId = call.message.message_id;

    bot.answerCallbackQuery(call.id).catch(() => {});

    if (call.data.startsWith("lang_")) {
        const newLang = call.data.split("_")[1];
        setUserLang(userId, newLang);
        getChannel((channel) => {
            let ky = {
                inline_keyboard: [
                    [
                        { text: texts[newLang]["dev"], url: 'https://t.me/ABOJL' },
                        { text: texts[newLang]["chan"], url: channel ? `https://t.me/${channel}` : 'https://t.me/ABOJLQ' }
                    ],
                    [
                        { text: texts[newLang]["btn_lang"], callback_data: `lang_${newLang === 'ar' ? 'en' : 'ar'}` }
                    ]
                ]
            };
            if (userId === ADMIN_ID) {
                ky.inline_keyboard.push([
                    { text: texts[newLang]["stats"], callback_data: 'stats' },
                    { text: texts[newLang]["broad"], callback_data: 'broadcast' }
                ]);
                ky.inline_keyboard.push([
                    { text: texts[newLang]["set_c"], callback_data: 'set_chan' },
                    { text: texts[newLang]["rem_c"], callback_data: 'rem_chan' }
                ]);
            }
            bot.editMessageText(texts[newLang]["start"], { chat_id: chatId, message_id: messageId, reply_markup: ky }).catch(() => {});
        });
    } 
    else if (call.data === "rem_chan" && userId === ADMIN_ID) {
        setChannel("off", () => {
            bot.sendMessage(chatId, "تمت إزالة القناة بنجاح ✅").catch(() => {});
        });
    } 
    else if (call.data === "check") {
        getChannel(async (channel) => {
            if (await checkSub(userId, channel)) {
                bot.deleteMessage(chatId, messageId).catch(() => {});
                sendStartMessage(chatId, userId);
            } else {
                bot.answerCallbackQuery(call.id, { text: "❌ يجب الاشتراك بالقناة أولاً", show_alert: true }).catch(() => {});
            }
        });
    } 
    else if (call.data === "set_chan" && userId === ADMIN_ID) {
        userStates[userId] = 'waiting_channel';
        bot.sendMessage(chatId, "أرسل يوزر القناة الجديد (بدون @):").catch(() => {});
    } 
    else if (call.data === "stats" && userId === ADMIN_ID) {
        getAllUsers((users) => {
            bot.answerCallbackQuery(call.id, { text: `عدد المستخدمين: ${users.length}`, show_alert: true }).catch(() => {});
        });
    } 
    else if (call.data === "broadcast" && userId === ADMIN_ID) {
        userStates[userId] = 'waiting_broadcast';
        bot.sendMessage(chatId, "أرسل الرسالة للإذاعة:").catch(() => {});
    }
});

// معالجة الرسائل
bot.on('message', async (msg) => {
    if (!msg.text) return;
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (msg.text.startsWith("/")) return;

    if (userStates[userId] === 'waiting_channel' && userId === ADMIN_ID) {
        delete userStates[userId];
        setChannel(msg.text, () => {
            bot.sendMessage(chatId, "تم تحديث القناة بنجاح ✅").catch(() => {});
        });
        return;
    }

    if (userStates[userId] === 'waiting_broadcast' && userId === ADMIN_ID) {
        delete userStates[userId];
        getAllUsers((users) => {
            users.forEach((u) => {
                bot.sendMessage(u, msg.text).catch(() => {});
            });
            bot.sendMessage(chatId, "تمت الإذاعة لجميع المستخدمين بنجاح ✅").catch(() => {});
        });
        return;
    }

    getChannel(async (channel) => {
        if (!(await checkSub(userId, channel))) {
            return sendStartMessage(chatId, userId);
        }
        if (msg.text.startsWith("http")) {
            const wait = await bot.sendMessage(chatId, "⏳ جارٍ التحميل...", { reply_to_message_id: msg.message_id }).catch(() => {});
            try {
                const response = await axios.post("https://www.clipto.com/api/youtube", { url: msg.text });
                const res = response.data;
                if (res && res.medias && res.medias.length > 0) {
                    await bot.sendVideo(chatId, res.medias[0].url).catch(() => {});
                    if (wait) await bot.deleteMessage(chatId, wait.message_id).catch(() => {});
                } else {
                    if (wait) await bot.editMessageText("عذراً، لم يتم العثور على وسائط.", { chat_id: chatId, message_id: wait.message_id }).catch(() => {});
                }
            } catch (e) {
                if (wait) await bot.editMessageText("حدث خطأ أثناء تحميل الفيديو.", { chat_id: chatId, message_id: wait.message_id }).catch(() => {});
            }
        }
    });
});

process.on('uncaughtException', (err) => {
    console.error('خطأ غير متوقع:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('رفض غير معالج:', reason);
});

console.log("البوت يعمل الآن بثبات تام وبدون أخطاء...");
