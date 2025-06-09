// parser.js
const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractIntentFromQuestion(question) {
  const systemPrompt = `
You are an intent detection and entity extraction engine for a sports assistant.
Given a natural language question, extract a structured JSON object with:
- intent (e.g. "player_runs", "team_score", "head_to_head", "player_comparison", "team_comparison", "live_scores", "top_scorer")
- sport (like "cricket", "football", "nba", etc.)
- player (if any)
- player2 (if comparing)
- team (if any)
- team2 (if comparing)
- date (if mentioned)
- range (e.g., "last 5 games", if present)

Respond ONLY with a valid JSON object.
`;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: ${question}` },
      ],
      max_tokens: 1000,
      temperature: 0.2,
    });

    const jsonText = chatCompletion.choices[0].message.content.trim();
    //console.error("output parse from OpenAI:", jsonText);

    return JSON.parse(jsonText);
  } catch (err) {
    console.error("Failed to parse intent from OpenAI:", err.message);
    return {
      intent: "unknown",
      sport: null,
      player: null,
      team: null,
      originalQuestion: question,
    };
  }
}

module.exports = { extractIntentFromQuestion };
