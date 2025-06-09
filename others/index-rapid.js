// sports-ai-bot/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const cricketHandler = require('./cricket');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function identifyMeta(question) {
  const prompt = `Extract the following from the user question:
1. Sport (e.g. cricket, football, tennis, etc.)
2. Context/Intent (e.g. live, schedule, stats, h2h, scores, news, odds)
3. Entities like player full name, team full name, event name, or date if relevant.
For cricket use cricbuzz-cricket in rapip-api only

Respond ONLY in this JSON format:
{
  "sport": "...",
  "intent": "...",
  "entities": ["..."]
}

Question:
"${question}"`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty OpenAI response for identifyMeta');

  // Try extracting JSON from code block
  const jsonMatch = content.match(/```json\s*([\s\S]+?)\s*```/i);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new Error('Malformed JSON inside code block');
    }
  }

  // Fallback: try to parse the whole response as JSON
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error('No valid JSON structure found in OpenAI response');
  }
}

async function buildRapidApiCalls(meta) {
  const { sport, intent, entities } = meta;
  const prompt = `You are a sports API orchestrator.
Given:
Sport: ${sport}
Intent: ${intent}
Entities: ${entities.join(', ')}

Generate:
1. Any necessary Axios search calls to resolve team/player/event IDs
2. Final Axios call to get the target data

Use the following keys:
- X-RapidAPI-Key: ${process.env.RAPIDAPI_KEY}
- NewsAPI Key: ${process.env.NEWSAPI_KEY}
For cricket use cricbuzz-cricket in rapip-api only

Respond ONLY in strict JSON format (no explanation or markdown), as:
{
  "idLookupAxios": ["axios.get(...)", "axios.get(...)"],
  "mainDataAxios": "axios.get(...)"
}
Do NOT include backticks or markdown or explanation.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  const jsonMatch = content.match(/```json\s*([\s\S]+?)\s*```/i);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new Error('Malformed JSON in Axios call block');
    }
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error('No valid Axios JSON returned by GPT');
  }
}

async function executeAxiosCommand(axiosCode) {
  const prompt = `Execute this Axios command and return the raw JSON result. Do not return the code:

${axiosCode}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  const jsonMatch = content.match(/```json\s*([\s\S]+?)\s*```/i);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new Error('Malformed JSON in Axios response block');
    }
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error('Could not extract JSON result');
  }
}

async function summarizeResult(question, apiResult) {
  const prompt = `Given this user question: "${question}" and API result:
${JSON.stringify(apiResult, null, 2)}
Summarize the result in a user-friendly way.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0].message.content;
}

async function handleQuestion(question) {
  console.log('Question:', question);
  const meta = await identifyMeta(question);
  console.log('Identified Meta:', meta);

  switch (meta.sport?.toLowerCase()) {
    case 'cricket':
      return cricketHandler(meta, question, openai);
    default:
      return 'Sport not supported yet.';
  }
}


app.post('/webhook', async (req, res) => {
  const question = req.body.Body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

  try {
    const answer = await handleQuestion(question);
    res.json({ answer });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Sports AI server running on http://localhost:${PORT}`);
});

module.exports = { handleQuestion };
