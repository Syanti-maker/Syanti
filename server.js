app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === "SyantiBot123") {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});
