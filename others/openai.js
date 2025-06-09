// openai.js
const OpenAI = require("openai");
const dotenv = require("dotenv");
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getOpenAIAnswerWithContext(context) {
  const { question, textResult, rawData } = context;
  try {
    console.log('getting general openAI response for context:', context);
    const systemPrompt = `You are a helpful sports assistant bot. The user is asking about sports stats, news, or results. Use the structured data below to answer helpfully. If data is missing, say so. Be concise.`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Question: ${question}\n\nStructured data: ${JSON.stringify(
          rawData,
          null,
          2
        )}\n\nParsed summary: ${textResult}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 1000,
      temperature: 0.2,
    });
    //console.log('response for context is :', response.choices[0].message.content.trim());
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error("OpenAI fallback failed:", err.message);
    return null;
  }
}

module.exports = { getOpenAIAnswerWithContext };
