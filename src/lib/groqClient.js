/**
 * groqClient.js
 *
 * Thin wrapper around Groq's OpenAI-compatible chat completions endpoint.
 * Both the natural-language rule parser and the PDF cart parser go through
 * this single function so retry/error handling only lives in one place.
 *
 * Groq docs: https://console.groq.com/docs/quickstart
 * Endpoint is OpenAI-compatible: POST /openai/v1/chat/completions
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

function getApiKey() {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key) {
    throw new Error(
      'Missing Groq API key. Add VITE_GROQ_API_KEY to your .env.local file (see .env.example) and restart the dev server.'
    )
  }
  return key
}

function getModel() {
  return import.meta.env.VITE_GROQ_MODEL || DEFAULT_MODEL
}

/**
 * Sends a system + user message pair to Groq and returns the raw text content.
 * Requests strict JSON output. If the model/account doesn't support the
 * `response_format: json_object` flag, automatically retries once without it
 * — the system prompt already instructs JSON-only output either way.
 *
 * @param {Object} opts
 * @param {string} opts.system - system prompt
 * @param {string} opts.user   - user message (the text to parse)
 * @returns {Promise<string>} raw text content from the model
 */
export async function callGroq({ system, user }) {
  const apiKey = getApiKey()
  const model = getModel()

  const baseBody = {
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }

  async function request(body) {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    return response
  }

  // First attempt: ask Groq to enforce JSON mode.
  let response = await request({ ...baseBody, response_format: { type: 'json_object' } })

  // Some models/accounts reject response_format — fall back to prompt-only JSON.
  if (!response.ok && response.status === 400) {
    response = await request(baseBody)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Groq API error (${response.status}): ${errorText || response.statusText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Groq API returned an empty response. Please try again.')
  }
  return content
}

/**
 * Strips markdown code fences a model sometimes wraps JSON in, then parses it.
 * Throws a friendly error if the result still isn't valid JSON.
 */
export function parseJsonResponse(rawText, context = 'response') {
  const cleaned = rawText.replace(/```json|```/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`The model's ${context} was not valid JSON. Please try again or rephrase your input.`)
  }
}
