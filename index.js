const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');

// --- الإعدادات ---
const token = process.env.BOT_TOKEN || '6903487941:AAGFXw4074lMGMzc_HOHIeJQGuylDW6iPE4';
const bot = new TelegramBot(token, { polling: true });

// قناة الاشتراك الإجباري الثابتة
const REQUIRED_CHANNEL = "ABOJLQ";

// نظام تخزين محلي بسيط وآمن
const DB_FILE = 'database.json';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
}

function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { users: {} };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function addUser(userId) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = true;
        writeDB(db);
    }
}

// --- النصوص والأيقونات ---
const texts = {
    "start": "مرحباً بك! أرسل رابط الفيديو للتحميل 📥",
    "sub": "يجب الاشتراك في القناة أولاً لتتمكن من استخدام البوت 📢:",
    "btn_sub": "اشترك بالقناة ➕",
    "btn_check": "تحقق ✅",
    "dev": "👤 المطور",
    "chan": "📢 القناة"
};

async function checkSub(userId) {
    try {
        const res = await bot.getChatMember(`@${REQUIRED_CHANNEL}`, userId);
        return ['member', 'administrator', 'creator'].includes(res.status);
    } catch (e) {
        return false;
    }
}

async function sendStartMessage(chatId, userId) {
    addUser(userId);
    
    if (!(await checkSub(userId))) {
        const btn = {
            inline_keyboard: [
                [
                    { text: texts["btn_sub"], url: `https://t.me/${REQUIRED_CHANNEL}` },
                    { text: texts["btn_check"], callback_data: "check" }
                ]
            ]
        };
        bot.sendMessage(chatId, `${texts['sub']} @${REQUIRED_CHANNEL}`, { reply_markup: btn }).catch(() => {});
        return;
    }

    let ky = {
        inline_keyboard: [
            [
                { text: texts["dev"], url: 'https://t.me/ABOJL' },
                { text: texts["chan"], url: `https://t.me/${REQUIRED_CHANNEL}` }
            ]
        ]
    };

    bot.sendMessage(chatId, texts["start"], { reply_markup: ky }).catch(() => {});
}

bot.onText(/\/start/, (msg) => {
    sendStartMessage(msg.chat.id, msg.from.id);
});

// معالجة زر التحقق من الاشتراك
bot.on('callback_query', async (call) => {
    const userId = call.from.id;
    const chatId = call.message.chat.id;
    const messageId = call.message.message_id;

    bot.answerCallbackQuery(call.id).catch(() => {});

    if (call.data === "check") {
        if (await checkSub(userId)) {
            bot.deleteMessage(chatId, messageId).catch(() => {});
            sendStartMessage(chatId, userId);
        } else {
            bot.answerCallbackQuery(call.id, { text: "❌ يجب الاشتراك بالقناة أولاً", show_alert: true }).catch(() => {});
        }
    }
});

// معالجة الرسائل وروابط التحميل مع فحص الاشتراك الإجباري
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (!(await checkSub(userId))) {
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

process.on('uncaughtException', (err) => {
    console.error('خطأ غير متوقع:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('رفض غير معالج:', reason);
});

console.log("البوت يعمل الآن بثبات تام مع تفعيل الاشتراك الإجباري...");
