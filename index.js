// index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// read config from environment variables
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT; // e.g. https://<your-resource>.cognitiveservices.azure.com/
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT; // e.g. blue_ai_gpt_5_mini
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
const BACKEND_SECRET = process.env.BACKEND_SECRET; // optional simple auth

// simple health
app.get('/', (req, res) => res.send('AI backend is running'));

// simple auth-check (if BACKEND_SECRET set, require header x-app-key)
function checkAppKey(req) {
  if (!BACKEND_SECRET) return true;
  const header = req.headers['x-app-key'];
  return header && header === BACKEND_SECRET;
}

app.post('/generate-narrative', async (req, res) => {
  try {
    if (!checkAppKey(req)) return res.status(401).json({ error: 'Unauthorized' });

    const { incident } = req.body;
    if (!incident) return res.status(400).json({ error: 'Missing `incident` in body' });

    if (!AZURE_OPENAI_KEY || !AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_DEPLOYMENT) {
      return res.status(500).json({ error: 'Server misconfigured (missing env vars)' });
    }

    const url = `${AZURE_OPENAI_ENDPOINT.replace(/\/+$/,'')}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

    const payload = {
      messages: [
        {
          role: 'system',
          content: 'You are a professional police incident reporter. Produce a clear, factual, chronological and detailed narrative based only on the facts provided.'
        },
        {
          role: 'user',
          content: `Generate a detailed narrative for the following incident: ${incident}`
        }
      ],
      max_completion_tokens: 1200
    };

    const resp = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY
      },
      timeout: 120000
    });

    const raw = resp.data;
    const narrative = raw?.choices?.[0]?.message?.content ?? '';
    return res.json({ narrative, raw });
  } catch (err) {
    console.error('Error calling OpenAI:', err?.response?.data ?? err.message);
    const status = err?.response?.status || 500;
    return res.status(status).json({ error: err?.response?.data ?? err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI backend listening on ${port}`));
