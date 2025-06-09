// sportsDB.js
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { getOpenAIAnswerWithContext } = require("./openai");

const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY;
const BASE_URL_V1 = "https://www.thesportsdb.com/api/v1/json";
const BASE_URL_V2 = "https://www.thesportsdb.com/api/v2/json";

async function fetchFromSportsDB(parsed) {
  const { sport, intent, player, player2, team, team2, date, range, originalQuestion } = parsed;
  try {
    let rawData = null;
    let textResult = null;

    if (intent === "top_scorer" && sport.toLowerCase() === "nba") {
      const res = await axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/lookuptable.php?l=4387&s=2024-2025`);
      rawData = res.data.table;
      if (rawData && rawData.length > 0) {
        const sorted = rawData.sort((a, b) => b.intPoints - a.intPoints);
        const top = sorted[0];
        textResult = `Top scorer: ${top.strPlayer} (${top.strTeam}) with ${top.intPoints} points.`;
      }
    } else if (intent === "player_runs" && player) {
      const res = await axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/searchplayers.php?p=${encodeURIComponent(player)}`);
      rawData = res.data.player;
      if (rawData && rawData.length > 0) {
        const p = rawData[0];
        textResult = `${p.strPlayer} - Team: ${p.strTeam} | Sport: ${p.strSport}`;
      }
    } else if (intent === "team_score" && team) {
      const res = await axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/searchteams.php?t=${encodeURIComponent(team)}`);
      rawData = res.data.teams;
      if (rawData && rawData.length > 0) {
        const t = rawData[0];
        textResult = `${team} plays in ${t.strLeague} | Stadium: ${t.strStadium}`;
      }
    } else if (intent === "live_scores") {
      const res = await axios.get(`${BASE_URL_V2}/${THESPORTSDB_API_KEY}/livescore.php?s=${encodeURIComponent(sport || "soccer")}`);
      rawData = res.data.events;
      if (rawData && rawData.length > 0) {
        textResult = rawData.map(m => `${m.strEvent}: ${m.intHomeScore} - ${m.intAwayScore} (${m.strStatus})`).join("\n");
      } else {
        textResult = `No live matches for ${sport || "soccer"}`;
      }
    } else if (intent === "player_comparison" && player && player2) {
      const [res1, res2] = await Promise.all([
        axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/searchplayers.php?p=${encodeURIComponent(player)}`),
        axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/searchplayers.php?p=${encodeURIComponent(player2)}`)
      ]);
      const p1 = res1.data.player;
      const p2 = res2.data.player;
      rawData = { player1: p1, player2: p2 };
      if (p1 && p1.length > 0 && p2 && p2.length > 0) {
        textResult = `${p1[0].strPlayer} (${p1[0].strTeam}) vs ${p2[0].strPlayer} (${p2[0].strTeam})`;
      }
    } else if (intent === "team_comparison" && team && team2) {
      const [res1, res2] = await Promise.all([
        axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/searchteams.php?t=${encodeURIComponent(team)}`),
        axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/searchteams.php?t=${encodeURIComponent(team2)}`)
      ]);
      const t1 = res1.data.teams;
      const t2 = res2.data.teams;
      rawData = { team1: t1, team2: t2 };
      if (t1 && t1.length > 0 && t2 && t2.length > 0) {
        textResult = `${team}: League ${t1[0].strLeague}, Formed in ${t1[0].intFormedYear} | ${team2}: League ${t2[0].strLeague}, Formed in ${t2[0].intFormedYear}`;
      }
    } else if (intent === "head_to_head" && team && team2) {
      const res = await axios.get(`${BASE_URL_V1}/${THESPORTSDB_API_KEY}/eventsh2h.php?team1=${encodeURIComponent(team)}&team2=${encodeURIComponent(team2)}`);
      rawData = res.data?.event;
      if (rawData && rawData.length > 0) {
        const summary = rawData.map(m => `${m.dateEvent}: ${m.strEvent} - ${m.intHomeScore}:${m.intAwayScore}`).join("\n");
        textResult = `Head-to-head between ${team} and ${team2} (${rawData.length} matches):\n${summary}`;
      }
    }

    const contextData = {
      question: originalQuestion,
      rawData,
      textResult,
      intent,
      sport,
      player,
      player2,
      team,
      team2,
      date,
      range,
    };

    const finalAnswer = await getOpenAIAnswerWithContext(contextData);
    return finalAnswer || textResult || "Sorry, I couldn't find an answer to that question.";

  } catch (error) {
    console.error("Error fetching from TheSportsDB:", error.message);
    return await getOpenAIAnswerWithContext({ question: originalQuestion });
  }
}

module.exports = { fetchFromSportsDB };
