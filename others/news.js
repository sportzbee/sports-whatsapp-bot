// news.js
const axios = require("axios");
const OpenAI = require("openai");
require("dotenv").config();

const newsApiKey = process.env.NEWSAPI_KEY;
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getLatestSportsNews(query) {
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
      query
    )}&apiKey=${newsApiKey}&language=en&sortBy=publishedAt&pageSize=5`;

    const response = await axios.get(url);
    const articles = response.data.articles || [];
    const summaryInput = articles
      .map((a, i) => `${i + 1}. ${a.title} - ${a.description}`)
      .join("\n");

    if (!summaryInput) {
      return "No recent news found.";
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes the latest sports news from a list of headlines.",
        },
        {
          role: "user",
          content: `Summarize the following headlines and descriptions:\n${summaryInput}`,
        },
      ],
      max_tokens: 300,
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("News fetch/summarize failed:", err.message);
    return "Sorry, I couldn't fetch the latest news right now.";
  }
}

module.exports = {
  getLatestSportsNews,
};
