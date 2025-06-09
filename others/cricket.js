// sports-ai-bot/sports/cricket.js
const axios = require('axios');

async function cricketHandler(meta, question, openai) {
  const { intent, entities } = meta;
  const playerOrTeam = entities.join(', ');

  // Ask GPT to construct the Axios config for Cricbuzz API
  const prompt = `You are a developer assistant. Based on the user's question and metadata:
Question: ${question}
Intent: ${intent}
Entities: ${playerOrTeam}

Generate a JavaScript Axios GET request using cricbuzz-cricket API from RapidAPI.
Respond ONLY in this JSON format:
{
  "idLookupAxios": [ "axios.get(...)" ],
  "mainDataAxios": "axios.get(...)"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.choices?.[0]?.message?.content?.trim();
  console.log('GPT raw response:', raw); // Debug logging

  let config;
 try {
   const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/i);
   const content = jsonMatch ? jsonMatch[1] : raw;

   // Extract only the JSON object portion from GPT response
   const firstBrace = content.indexOf('{');
   const lastBrace = content.lastIndexOf('}');
   const pureJson = content.substring(firstBrace, lastBrace + 1);

   config = JSON.parse(pureJson);
 } catch (err) {
   console.error('Error parsing GPT response:', err);
   throw new Error('No valid Axios JSON returned by GPT');
 }

 const results = [];
 for (const lookup of config.idLookupAxios || []) {
   try {
     console.log('eval request:', lookup);
     const result = await eval(lookup);
     console.log('eval response:', result);
     results.push(result.data);
   } catch (err) {
     console.warn('ID lookup failed:', err.message);
   }
 }

 let mainResult;
 try {
   console.log('main eval request:', config.mainDataAxios);
   mainResult = await eval(config.mainDataAxios);
   console.log('main eval response:', mainResult);

 } catch (err) {
   throw new Error('Main data request failed: ' + err.message);
 }

 const summaryPrompt = `User asked: ${question}

Based on this API response:
${JSON.stringify(mainResult.data)}

Summarize the answer within 500 words.`;
 const summary = await openai.chat.completions.create({
   model: 'gpt-4',
   messages: [{ role: 'user', content: summaryPrompt }],
 });

 return summary.choices?.[0]?.message?.content?.trim() || 'No summary generated.';
}

module.exports = cricketHandler;
