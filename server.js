const express = require("express");
const axios = require("axios");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(express.json());

// ====== إعدادات WhatsApp ======
const TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = "syanti_verify";

// ====== إعدادات Google Sheets ======
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

let users = {};

// ====== Webhook Verification ======
app.get("/webhook", (req, res) => {
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
        res.send(req.query["hub.challenge"]);
    } else {
        res.sendStatus(403);
    }
});

// ====== استقبال رسائل WhatsApp ======
app.post("/webhook", async (req, res) => {
    try {
        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (!message) return res.sendStatus(200);

        const phone = message.from;

        // نص عادي
        if (message.type === "text") {
            if (users[phone]?.awaitingText) {
                // العميل كتب نص بعد اختيار "أخرى"
                const subItem = message.text.body;
                await saveOrder(phone, users[phone].service, "أخرى", users[phone].region || "", users[phone].address || "", subItem);
                await sendText(phone, `✅ تم تسجيل طلبك: ${subItem}\nسيتم التواصل معك من قسم ${getServiceName(phone)}`);
                delete users[phone];
            } else if (users[phone]?.awaitingAddress) {
                // العميل كتب العنوان بعد اختيار المنطقة
                users[phone].address = message.text.body;
                await saveOrder(phone, users[phone].service, users[phone].subItem, users[phone].region, users[phone].address);
                await sendText(phone, `✅ تم تسجيل طلبك بنجاح\nسيتم التواصل معك خلال دقائق من فريق صيانتي`);
                delete users[phone];
            } else {
                sendMainMenu(phone);
            }
        }

        // اختيارات Interactive
        if (message.type === "interactive") {
            const id = message.interactive.list_reply.id;
            handleChoice(phone, id);
        }

    } catch (err) {
        console.log(err);
    }
    res.sendStatus(200);
});

// ====== القائمة الرئيسية ======
async function sendMainMenu(phone) {
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: "مرحباً بك في صيانتي 🛠\nاختر الخدمة" },
            action: {
                button: "اختيار الخدمة",
                sections: [{
                    title: "الخدمات",
                    rows: [
                        { id: "plumbing", title: "سباكة" },
                        { id: "electric", title: "كهرباء" },
                        { id: "ac", title: "تكييفات" },
                        { id: "carpenter", title: "نجارة" },
                        { id: "iron", title: "حدادة" },
                        { id: "aluminum", title: "المونيوم" },
                        { id: "garden", title: "تقليم الحدائق" },
                        { id: "clean", title: "نظافة منزلية" }
                    ]
                }]
            }
        }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

// ====== الأقسام والبنود ======
const services = {
    plumbing: ["تغيير حنفية", "إصلاح سيفون", "تسريب مياه", "تسليك صرف", "تركيب سخان", "تركيب خلاط", "أخرى"],
    electric: ["تركيب نجف", "تركيب مفاتيح", "تركيب مروحة", "عطل كهرباء", "أخرى"],
    ac: ["شحن فريون", "تنظيف تكييف", "تركيب تكييف", "صيانة تكييف", "أخرى"],
    carpenter: ["إصلاح باب", "تركيب باب", "إصلاح دولاب", "فك وتركيب غرف", "أخرى"],
    iron: ["تركيب باب حديد", "إصلاح باب", "لحام حديد", "أخرى"],
    aluminum: ["تركيب شباك", "إصلاح شباك", "تركيب مطبخ ألومنيوم", "أخرى"],
    garden: ["تقليم أشجار", "تنظيف حديقة", "زراعة نباتات", "أخرى"],
    clean: ["شقة أقل من 100 متر","شقة 100 إلى 150 متر","3 غرف وصالة","4 غرف وصالة","دوبلكس","فيلا","أخرى"]
};

// ====== المناطق ======
const regions = ["مدينة نصر", "مصر الجديدة", "المعادي", "التجمع", "أكتوبر", "الشيخ زايد"];

// ====== التعامل مع الاختيار ======
async function handleChoice(phone, id) {

    // لو اختار قسم رئيسي
    if (services[id]) {
        sendSubMenu(phone, id);
        return;
    }

    const user = users[phone] || {};

    // لو اختار بند فرعي
    if (id === "أخرى") {
        users[phone].awaitingText = true;
        await sendText(phone, "من فضلك اكتب مشكلتك أو سجل صوتك وسيتم تحويلها للقسم المختص");
    } else if (services[user.service]?.includes(id)) {
        users[phone].subItem = id;
        // اسأل عن المنطقة
        sendRegionMenu(phone);
    }
}

// ====== القائمة الفرعية ======
async function sendSubMenu(phone, service) {
    const rows = services[service].map(item => ({ id: item, title: item }));
    users[phone] = { service };

    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: "اختر الخدمة المطلوبة" },
            action: { button: "عرض الخيارات", sections: [{ title: "الخيارات", rows }] }
        }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

// ====== قائمة المناطق ======
async function sendRegionMenu(phone) {
    const rows = regions.map(r => ({ id: r, title: r }));
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: "اختر المنطقة" },
            action: { button: "اختر المنطقة", sections: [{ title: "المناطق", rows }] }
        }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });

    users[phone].awaitingRegion = true;
}

// ====== إرسال رسالة نصية ======
async function sendText(phone, text) {
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: phone,
        text: { body: text },
        type: "text"
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

// ====== اسم القسم ======
function getServiceName(phone) {
    const service = users[phone]?.service;
    const names = {
        plumbing: "السباكة",
        electric: "الكهرباء",
        ac: "التكييفات",
        carpenter: "النجارة",
        iron: "الحدادة",
        aluminum: "المونيوم",
        garden: "تقليم الحدائق",
        clean: "النظافة المنزلية"
    };
    return names[service] || "";
}

// ====== حفظ الطلب في Google Sheet ======
async function saveOrder(phone, service, subItem, region, address, notes = "") {
    await doc.useServiceAccountAuth({ client_email: GOOGLE_CLIENT_EMAIL, private_key: GOOGLE_PRIVATE_KEY });
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({ phone, service: getServiceName({service}), subItem, region, address, notes, date: new Date().toLocaleString() });
}

// ====== تشغيل السيرفر ======
app.listen(3000, () => console.log("server running"));
