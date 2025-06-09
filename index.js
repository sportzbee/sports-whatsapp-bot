// index.js
const express = require("express");
const bodyParser = require("body-parser");
const { fetchFromSportsDB } = require("./sportsDB");
const { extractIntentFromQuestion } = require("./parser");
const { getLatestSportsNews } = require("./news");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Webhook endpoint for Twilio WhatsApp
app.post("/webhook", async (req, res) => {
  console.log(`postman request: `, req);

  const incomingMsg = req.body.Body;
  const from = req.body.From;

  if (!incomingMsg) return res.sendStatus(400);

  console.log(`Incoming from ${from}: ${incomingMsg}`);

  // Step 1: Extract structured intent/entities
  const parsed = await extractIntentFromQuestion(incomingMsg);
  console.log('extracted intent:', parsed);


  // Step 2: Add original question
  parsed.originalQuestion = incomingMsg;

  // Step 3: Fetch results
  const answer = await fetchFromSportsDB(parsed);
  console.log('fetchFromSportsDB response:', answer);

  // step 4 : nothing found get latest news
  const summary = '';
  if (answer.includes("Sorry, I")) {
        summary = await getLatestSportsNews(parsed || incomingMsg);
        console.log('news API response:', summary);
      }

  res.set("Content-Type", "text/plain");
  res.send(summary);
});

app.get("/", (req, res) => {
  res.send("SportsBot is running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
