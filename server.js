// server.js
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// ضع هنا نفس Verify Token اللي هتحطه في Meta
const VERIFY_TOKEN = "MokhtarBot123";

// قراءة متغيرات البيئة (Access Token و Phone Number ID)
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // من Render
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // من Meta

// Endpoint للتحقق من Webhook
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

// Endpoint لاستقبال الرسائل
app.post("/webhook", async (req, res) => {
  try {
    const entries = req.body.entry;
    if (!entries) return res.sendStatus(400);

    for (const entry of entries) {
      const changes = entry.changes;
      for (const change of changes) {
        const messages = change.value.messages;
        if (messages) {
          for (const message of messages) {
            const from = message.from; // رقم المرسل
            const text = message.text.body; // نص الرسالة
            console.log(`Message from ${from}: ${text}`);

            // مثال على الرد الذكي
            let reply = "شكراً على رسالتك، هرد عليك قريباً!";
            if (text.toLowerCase().includes("سلام")) {
              reply = "وعليكم السلام 👋";
            }

            // إرسال الرد للواتساب
            await axios.post(
              `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
              {
                messaging_product: "whatsapp",
                to: from,
                text: { body: reply },
              },
              {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
              }
            );
          }
        }
      }
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
