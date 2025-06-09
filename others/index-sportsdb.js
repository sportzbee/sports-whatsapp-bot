// sportsdbIntentRouter.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const qs = require('querystring');
const { exec } = require('child_process');
const OpenAI = require("openai");
const dotenv = require("dotenv");
dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
//const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SPORTSD_API_KEY = process.env.SPORTSDB_API_KEY || '123';

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Step 1: Extract sport, type, and filter fields
async function getIntentFromQuestion(question) {
  const systemPrompt = `Extract detailed filters from the user's sports question:
- sport (cricket, soccer, football, basketball, tennis, etc.)
- type: one of ['player_stats', 'team_stats', 'schedule', 'live_score', 'h2h', 'results', 'news']
- player: player name if any
- team: team name if any
- season: season or year if mentioned
- league: league name if any
- country: country if any
- event: event name if any
- leagueId: league ID if specified or can be inferred

Return a JSON response only with any text or quotes:
{
  "sport": "...",
  "type": "...",
  "player": "...",
  "team": "...",
  "season": "...",
  "league": "...",
  "country": "...",
  "event": "...",
  "leagueId": "..."
}

Question: ${question}`;

  const res = await callOpenAI([{ role: 'system', content: systemPrompt }]);
  return JSON.parse(res);
}

// Step 2: Build filtered cURL commands for execution
async function generateCurlChain(intent) {
  const systemPrompt = `Given the filters:
Sport: ${intent.sport}
Type: ${intent.type}
Player: ${intent.player}
Team: ${intent.team}
Season: ${intent.season}
League: ${intent.league}
Country: ${intent.country}
Event: ${intent.event}
LeagueId: ${intent.leagueId}

Generate an optimized list of thesportsdb.com API curl commands that precisely fetch data filtered by these details. For example:
- If player is specified, get player ID first
- Use leagueId or league name to filter schedules or stats
- Use season/year filter where possible
- Use country or event to narrow search

Output a JSON array of curl commands in execution order, no markdown or extra text.`;

  const res = await callOpenAI([{ role: 'system', content: systemPrompt }]);
  return JSON.parse(res);
}

// Step 3: Execute all curl commands in parallel and collect results
async function executeCurlChain(curlCmds) {
  const promises = curlCmds.map(cmd => new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout);
    });
  }));
  return Promise.all(promises);
}

// Step 4: Summarize results based on original question
async function summarizeResult(question, rawResults) {
  const combinedData = rawResults.join('\n');
  const systemPrompt = `You are a sports analyst. Based on the question:
\"${question}\"
and this data:
${combinedData}

Summarize the answer clearly, max 500 words.`;

  return await callOpenAI([{ role: 'system', content: systemPrompt }]);
}

// Call OpenAI Chat Completion API
async function callOpenAI(messages) {
  const chat = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0,
  });
  return chat.choices[0].message.content;
}

// Main controller
async function processUserQuery(question) {
  try {
    console.log("question : ", question);
    const intent = await getIntentFromQuestion(question);
    console.log("intent : ", intent);
    const curlChain = await generateCurlChain(intent);
    console.log("curlChain : ", curlChain);
    const rawResults = await executeCurlChain(curlChain);
    console.log("rawResults : ", rawResults);
    const summary = await summarizeResult(question, rawResults);
    console.log("summary : ", summary);
    return summary;
  } catch (err) {
    return `Error: ${err}`;
  }
}

// Express route for Postman
app.post('/webhook', async (req, res) => {
  const question = req.body.Body;
  if (!question) return res.status(400).json({ error: 'Missing question in body.' });

  const result = await processUserQuery(question);
  res.json({ answer: result });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

module.exports = { processUserQuery };
