const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file. If the file doesn't exist, defaults are used.
dotenv.config();

const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies and enable CORS for development.
app.use(express.json());
app.use(cors());

// Serve static files from the "public" directory. See Express docs for details【514573958350743†L61-L84】.
app.use(express.static('public'));

// Initialize OpenAI client using the API key from environment variables.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper function to call the OpenAI Chat Completions API.
 * This function instructs the model to produce a JSON object containing
 * sentiment, intensity, complexity, agency and themes. It uses JSON mode
 * (response_format.type="json_object") so that the model's output is a valid
 * JSON object【418022867457891†L6935-L6955】. We still perform additional validation
 * on the returned content to ensure it's parsable.
 *
 * @param {string} quote The quote to analyze
 * @returns {Promise<object>} The parsed JSON object or null if an error occurs
 */
async function analyzeQuote(quote) {
  // Compose system and user messages. The system message instructs the model
  // to return only JSON with specific keys. The user message contains the
  // quote itself.
  const messages = [
    {
      role: 'system',
      content:
        'You are an assistant that analyzes famous quotes. For each quote you will produce a JSON object with the following keys: "sentiment", "intensity", "complexity", "agency" (all numbers between 0 and 1), and "themes" (an array of exactly three concise one-word themes). Output only valid JSON. Do not include any explanatory text.',
    },
    {
      role: 'user',
      content: `Analyze the following quote and return the JSON object. Quote: "${quote}"`,
    },
  ];
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 200,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }
    // Attempt to parse the content. If parsing fails, try extracting the
    // substring between the first '{' and last '}' (common failure mode) and parse that.
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const substring = content.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(substring);
      } else {
        throw err;
      }
    }
    return parsed;
  } catch (error) {
    console.error('Error analyzing quote:', error);
    return null;
  }
}

// POST endpoint to analyze one or two quotes.
app.post('/api/analyze', async (req, res) => {
  const { quotes } = req.body;
  if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of quotes.' });
  }
  // Limit to two quotes to keep the response manageable (for the stretch goal).
  const limitedQuotes = quotes.slice(0, 2);
  const results = [];
  for (const quote of limitedQuotes) {
    const analysis = await analyzeQuote(quote);
    if (analysis) {
      results.push({ quote, analysis });
    } else {
      results.push({ quote, error: 'Failed to analyze quote' });
    }
  }
  res.json({ results });
});

// Start the server.
app.listen(port, () => {
  console.log(`Quote Geometry app listening at http://localhost:${port}`);
});
