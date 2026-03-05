const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = "syanti_verify";

let users = {};

app.get("/webhook", (req, res) => {
if (
req.query["hub.mode"] === "subscribe" &&
req.query["hub.verify_token"] === VERIFY_TOKEN
) {
res.send(req.query["hub.challenge"]);
} else {
res.sendStatus(403);
}
});

app.post("/webhook", async (req, res) => {

try {

const message =
req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

if (!message) return res.sendStatus(200);

const phone = message.from;

if (message.type === "text") {
sendMainMenu(phone);
}

if (message.type === "interactive") {

const id = message.interactive.list_reply.id;

users[phone] = { service: id };

sendSubMenu(phone, id);

}

} catch (err) {
console.log(err);
}

res.sendStatus(200);

});

async function sendMainMenu(phone) {

await axios.post(
`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
{
messaging_product: "whatsapp",
to: phone,
type: "interactive",
interactive: {
type: "list",
body: {
text: "مرحباً بك في صيانتي 🛠\nاختر الخدمة"
},
action: {
button: "اختيار الخدمة",
sections: [
{
title: "الخدمات",
rows: [
{ id: "plumbing", title: "سباكة" },
{ id: "electric", title: "كهرباء" },
{ id: "ac", title: "تكييفات" },
{ id: "carpenter", title: "نجارة" },
{ id: "iron", title: "حدادة" },
{ id: "aluminum", title: "المونيوم" },
{ id: "garden", title: "تقليم الحديقة" },
{ id: "clean", title: "نظافة منزلية" }
]
}
]
}
}
},
{
headers: {
Authorization: `Bearer ${TOKEN}`
}
}
);

}

async function sendSubMenu(phone, service) {

let rows = [];

if (service === "plumbing") {

rows = [
{ id: "tap", title: "تغيير حنفية" },
{ id: "siphon", title: "إصلاح سيفون" },
{ id: "leak", title: "تسريب مياه" },
{ id: "drain", title: "تسليك صرف" },
{ id: "heater", title: "تركيب سخان" }
];

}

if (service === "electric") {

rows = [
{ id: "lamp", title: "تركيب نجف" },
{ id: "switch", title: "تركيب مفاتيح" },
{ id: "fan", title: "تركيب مروحة" },
{ id: "problem", title: "عطل كهرباء" }
];

}

if (service === "ac") {

rows = [
{ id: "freon", title: "شحن فريون" },
{ id: "cleanac", title: "تنظيف تكييف" },
{ id: "installac", title: "تركيب تكييف" },
{ id: "repairac", title: "صيانة تكييف" }
];

}

if (service === "clean") {

rows = [
{ id: "clean1", title: "شقة أقل من 100 متر" },
{ id: "clean2", title: "شقة 100 الى 150 متر" },
{ id: "clean3", title: "3 غرف وصالة" },
{ id: "clean4", title: "4 غرف وصالة" },
{ id: "clean5", title: "دوبلكس" },
{ id: "clean6", title: "فيلا" }
];

}

await axios.post(
`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
{
messaging_product: "whatsapp",
to: phone,
type: "interactive",
interactive: {
type: "list",
body: {
text: "اختر الخدمة المطلوبة"
},
action: {
button: "عرض الخيارات",
sections: [
{
title: "الخيارات",
rows: rows
}
]
}
}
},
{
headers: {
Authorization: `Bearer ${TOKEN}`
}
}
);

}

app.listen(3000, () => {
console.log("server running");
});
