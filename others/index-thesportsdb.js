const express = require('express');
const bodyParser = require('body-parser');
// openai.js
const OpenAI = require("openai");
const dotenv = require("dotenv");
dotenv.config();
const { exec } = require('child_process');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const THESPORTSDB_KEY = '612473';

// --- UTIL: Extract JSON from Markdown-wrapped code blocks ---
function extractJsonFromMarkdown(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    return JSON.parse(match[1].trim());
  } else {
    return JSON.parse(text.trim());
  }
}

// --- UTIL: Extract curl commands from Markdown-wrapped OpenAI response ---
function extractCurlCommands(text) {
  if (text.startsWith('```')) {
    return text.replace(/```(bash|text)?/g, '').trim().split('\n');
  }
  return text.trim().split('\n');
}

// --- MAIN ROUTE ---
app.post('/webhook', async (req, res) => {
  const userQuestion = req.body.Body;
  if (!userQuestion) return res.status(400).send('Missing question');

  try {
    // 1. Extract sport-related entities
      const extractRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Extract the following from the user's sports question:
- sport
- league (if mentioned)
- teams (if any)
- players (if any)
- venue (if any)
- context (score, live, contract, stats, milestones, results, schedule, awards)
- award (if mentioned)
- season (if mentioned)

Return as JSON only. No explanation.

Question: ${userQuestion}`
      }]
    });

    //console.log('extractRes : ', extractRes);
    const extracted = extractJsonFromMarkdown(extractRes.choices[0].message.content);
    console.log('extracted : ', extracted);

    // 2. Ask OpenAI to generate thesportsdb curl commands
    const curlPrompt = `
Use thesportsdb.com API (v1 or v2) with API key ${THESPORTSDB_KEY} to get the relevant data to answer this question:
"${userQuestion}"

Entities:
${JSON.stringify(extracted, null, 2)}

Only return valid curl commands (one per line). Use v2 for live scores. Resolve team, league, or player IDs if required.
`;

      const curlRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: curlPrompt }]
    });

    const curlCommands = extractCurlCommands(curlRes.choices[0].message.content).filter(line => line.startsWith('curl'));
    console.log('curlCommands :', curlCommands);

    // 3. Execute each curl command
    const responses = await Promise.all(
      curlCommands.map(cmd =>
        new Promise((resolve) => {
          exec(cmd, (err, stdout) => {
            if (err) return resolve({ error: err.message });
            try {
              resolve(JSON.parse(stdout));
            } catch (e) {
              resolve({ raw: stdout });
            }
          });
        })
      )
    );

    // 4. Generate basic response summary
    const summary = generateSummary(userQuestion, extracted, responses);

    res.json({ extracted, curlCommands, responses, summary });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Summary Generator (MVP-aware, generic fallback) ---
function generateSummary(question, extracted, responses) {
  const ctx = extracted.context?.toLowerCase();
  const sport = extracted.sport?.toLowerCase();
  const season = extracted.season || new Date().getFullYear();

  if (ctx === 'awards' && extracted.award?.toLowerCase().includes('mvp')) {
    const playerInfo = responses.flatMap(r => r.player || r.players || [])[0];
    if (playerInfo) {
      return `🏆 Likely ${sport.toUpperCase()} MVP ${season}: ${playerInfo.strPlayer} (${playerInfo.strTeam}).`;
    }
    return `🏆 MVP info not directly found, fallback data returned.`;
  }

  if (ctx === 'schedule') {
    const events = responses.flatMap(r => r.events || []);
    const upcoming = events.slice(0, 3).map(e => `${e.strEvent} on ${e.dateEvent}`).join(', ');
    return `📅 Top 3 upcoming matches: ${upcoming}`;
  }

  if (ctx === 'live') {
    const live = responses.flatMap(r => r.teams || r.events || []);
    return `🔴 Live updates: ${live.map(e => e.strEvent || e.strTeam).join(', ')}`;
  }

  return `✅ Fetched ${ctx || 'general'} data for ${sport || 'sports'}.`;
}

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
