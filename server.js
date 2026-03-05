// server.js
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// Verify Token و Environment Variables
const VERIFY_TOKEN = "MokhtarBot123";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; 
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Menu Flow
const menu = {
  start: {
    question: "أهلاً! تحب تبدأ بأي خدمة؟",
    options: { "1": "خدمة تنظيف", "2": "خدمة صيانة", "3": "مساعدة عامة" },
    next: { "1": "cleaning", "2": "maintenance", "3": "support" }
  },
  cleaning: {
    question: "نوع التنظيف اللي محتاجه؟",
    options: { "1": "تنظيف عميق", "2": "تنظيف عادي" },
    next: { "1": "end", "2": "end" }
  },
  maintenance: {
    question: "نوع الصيانة اللي محتاجه؟",
    options: { "1": "سباكة", "2": "كهرباء" },
    next: { "1": "end", "2": "end" }
  },
  support: {
    question: "اكتب مشكلتك وأنا أحاول أساعدك.",
    options: {},
    next: { any: "end" }
  },
  end: {
    question: "شكراً لك، تم تسجيل طلبك وسيتم التواصل معك.",
    options: {},
    next: {}
  }
};

// تتبع حالة كل عميل
let sessions = {};

// Webhook verify
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// استقبال الرسائل والرد حسب Flow
app.post("/webhook", async (req, res) => {
  try {
    const messages = req.body.entry[0].changes[0].value.messages;
    if (!messages) return res.sendStatus(200);

    for (const message of messages) {
      const from = message.from;
      const text = message.text.body.trim();

      // تحديد حالة العميل
      if (!sessions[from]) sessions[from] = "start";
      let current = sessions[from];

      // تحديد السؤال القادم بناءً على اختيار العميل
      const step = menu[current];
      let nextStep = step.next[text] || step.next["any"];
      if (!nextStep) nextStep = "start"; // fallback

      sessions[from] = nextStep;
      const nextMenu = menu[nextStep];

      // تجهيز الرد
      let replyText = nextMenu.question;
      if (nextMenu.options && Object.keys(nextMenu.options).length > 0) {
        replyText += "\n";
        for (const key in nextMenu.options) {
          replyText += `${key}: ${nextMenu.options[key]}\n`;
        }
      }

      // إرسال الرد للواتساب
      await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: replyText }
        },
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing message:", error);
    res.sendStatus(500);
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
