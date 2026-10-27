const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// --- الإعدادات ---
const token = process.env.BOT_TOKEN || '6903487941:AAGFXw4074lMGMzc_HOHIeJQGuylDW6iPE4';
const bot = new TelegramBot(token, { polling: true });
const ADMIN_ID = 700217964;

// --- تهيئة قاعدة البيانات (مع الحفاظ على البيانات القديمة) ---
const db = new sqlite3.Database('users.db', (err) => {
    if (err) console.error('خطأ في فتح قاعدة البيانات:', err.message);
});

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY)');
    db.run('ALTER TABLE users ADD COLUMN lang TEXT DEFAULT "ar"', (err) => { });
    db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
    db.run('INSERT OR IGNORE INTO settings VALUES ("channel", "ABOJLQ")');
});

function getChannel(callback) {
    db.get('SELECT value FROM settings WHERE key="channel"', [], (err, row) => {
        callback(row ? row.value : null);
    });
}

function setChannel(username, callback) {
    const val = username !== "off" ? username.replace("@", "") : null;
    db.run('UPDATE settings SET value = ? WHERE key = "channel"', [val], () => {
        if (callback) callback();
    });
}

function getUserLang(userId, callback) {
    db.get('SELECT lang FROM users WHERE user_id = ?', [userId], (err, row) => {
        callback(row && row.lang ? row.lang : "ar");
    });
}

function setUserLang(userId, lang) {
    db.run('UPDATE users SET lang = ? WHERE user_id = ?', [lang, userId]);
}

// تم إصلاح هذه الدالة لمنع أي خطأ تكرار في قاعدة البيانات
function addUser(userId) {
    db.run('INSERT OR IGNORE INTO users (user_id) VALUES (?)', [userId]);
}

function getAllUsers(callback) {
    db.all('SELECT user_id FROM users', [], (err, rows) => {
        callback(rows ? rows.map(r => r.user_id) : []);
    });
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
        const status = (await bot.getChatMember(`@${channel}`, userId)).status;
        return ['member', 'administrator', 'creator'].includes(status);
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
                bot.sendMessage(chatId, `${texts[lang]['sub']} @${channel}`, { reply_markup: btn });
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

            bot.sendMessage(chatId, texts[lang]["start"], { reply_markup: ky });
        });
    });
}

bot.onText(/\/start/, (msg) => {
    sendStartMessage(msg.chat.id, msg.from.id);
});

bot.on('callback_query', async (call) => {
    const userId = call.from_user.id;
    const chatId = call.message.chat.id;
    const messageId = call.message.message_id;

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
            bot.editMessageText(texts[newLang]["start"], { chat_id: chatId, message_id: messageId, reply_markup: ky });
        });
    } else if (call.data === "rem_chan" && userId === ADMIN_ID) {
        setChannel("off", () => {
            bot.answerCallbackQuery(call.id, { text: "تمت إزالة القناة بنجاح ✅", show_alert: true });
        });
    } else if (call.data === "check") {
        getChannel(async (channel) => {
            if (await checkSub(userId, channel)) {
                bot.deleteMessage(chatId, messageId);
                sendStartMessage(chatId, userId);
            } else {
                bot.answerCallbackQuery(call.id, { text: "❌", show_alert: true });
            }
        });
    } else if (call.data === "set_chan" && userId === ADMIN_ID) {
        bot.sendMessage(chatId, "أرسل يوزر القناة الجديد (بدون @):").then((sentMsg) => {
            const listener = (msg) => {
                if (msg.from.id === userId) {
                    setChannel(msg.text, () => {
                        bot.sendMessage(chatId, "تم التحديث ✅");
                    });
                    bot.removeListener("message", listener);
                }
            };
            bot.on("message", listener);
        });
    } else if (call.data === "stats" && userId === ADMIN_ID) {
        getAllUsers((users) => {
            bot.answerCallbackQuery(call.id, { text: `عدد المستخدمين: ${users.length}`, show_alert: true });
        });
    } else if (call.data === "broadcast" && userId === ADMIN_ID) {
        bot.sendMessage(chatId, "أرسل الرسالة:").then(() => {
            const listener = (msg) => {
                if (msg.from.id === userId) {
                    getAllUsers((users) => {
                        users.forEach((u) => {
                            bot.sendMessage(u, msg.text).catch(() => {});
                        });
                        bot.sendMessage(chatId, "تمت الإذاعة ✅");
                    });
                    bot.removeListener("message", listener);
                }
            };
            bot.on("message", listener);
        });
    }
});

bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    getChannel(async (channel) => {
        if (!(await checkSub(userId, channel))) {
            return sendStartMessage(chatId, userId);
        }
        if (msg.text.startsWith("http")) {
            const wait = await bot.sendMessage(chatId, "⏳", { reply_to_message_id: msg.message_id });
            try {
                const response = await axios.post("https://www.clipto.com/api/youtube", { url: msg.text });
                const res = response.data;
                if (res && res.medias && res.medias.length > 0) {
                    await bot.sendVideo(chatId, res.medias[0].url);
                    await bot.deleteMessage(chatId, wait.message_id);
                } else {
                    await bot.editMessageText("Error", { chat_id: chatId, message_id: wait.message_id });
                }
            } catch (e) {
                await bot.editMessageText("Error", { chat_id: chatId, message_id: wait.message_id });
            }
        }
    });
});

console.log("البوت يعمل الآن...");
