const axios = require('axios');
require('dotenv').config();

const { SPORTSDB_API_KEY, SPORTSDB_BASE_URL } = process.env;

async function fetchStatOrNews(intent) {
    const { sport, type, metric, context, timeframe } = intent;

    // Placeholder: Add logic per sport
    if (sport === 'nba' && type === 'score') {
        const res = await axios.get(`${SPORTSDB_BASE_URL}/eventsday.php?d=2024-05-17&s=NBA`);
        const events = res.data.events || [];
        const topGame = events.reduce((max, game) => {
            return game.intHomeScore > (max?.intHomeScore || 0) ? game : max;
        }, null);
        return `🏀 Top NBA score: ${topGame.strHomeTeam} scored ${topGame.intHomeScore} vs ${topGame.strAwayTeam}`;
    }

    return "⚠️ Sorry, that sport or query type is not supported yet.";
}

module.exports = { fetchStatOrNews };
