const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const OpenAI = require("openai");
const dotenv = require("dotenv");
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = 3000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/webhook', async (req, res) => {

  //const from = req.body.From;
  //console.log('from: ', from);

  const question = req.body.Body;
  const qqdetails = question;
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      //query: 'respond in whatsapp summary format for the question :' + question,
      query: qqdetails,
      search_depth: 'basic', // or 'advanced'
      //include_answers: true,
      include_answer: true,
      include_summary: true,
      chunks_per_source:3,
      max_results:1
    });

    const result = response.data;
    console.log('result:', result);
    const content = result.results[0].content;
    const url =result.results[0].url;
    const { answer, summary, sources } = response.data;

    // Step 2: Create WhatsApp-style summary with OpenAI
    //Time: Reformat UTC time into PST, and clarify the timezone for any dates or time.

    const context = `
    Question: ${question}
    Answer: ${answer}
    Summary: ${summary}
    Content: ${content}
    `;
    //Source: ${url}

    //Reformat all UTC date/time into PST date/time, and clarify the timezone for any dates or time.
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a WhatsApp bot that provides full summarizes for the question. Use only *single asterisks* for bold text. friendly bullet points and clear headlines. Remove unnecessary info like tickets, or prices. '
        },
        {
          role: 'user',
          content: `Convert this into a WhatsApp-friendly full summary:\n\n${context}`
        }
      ],
      temperature: 0.5,
      max_tokens: 250
    });

    const whatsapp_summary = completion.choices[0].message.content;
    const final_whatsapp_summary = `${whatsapp_summary}\n\nSource: ${url}`;
    console.log('whatsApps summary: ', final_whatsapp_summary);

    // Step 3: Return everything
    const output = final_whatsapp_summary;
    // res.json({
    //   //question,
    //   answer,
    //   //summary,
    //   whatsapp_summary,
    //   url,
    //   sources
    // });

    res.set("Content-Type", "text/plain");
    res.status(200).send(output);
    console.log('response sent');
    // res.type('text/xml');
    // res.send(`<Response><Message>Thanks! You said: ${output}</Message></Response>`);

  } catch (error) {
    console.error('Tavily API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch results from API' });
  }
});

app.get("/", (req, res) => {
  res.send("SportsBot is running!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
