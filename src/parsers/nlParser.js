/**
 * nlParser.js
 *
 * Converts a plain-English discount rule description into a structured
 * DiscountRule object using Groq's LLM API. This is an input adapter,
 * same contract as csvParser.js and pdfParser.js — it produces objects
 * shaped for the engine, but never touches the engine itself.
 *
 * Flow:
 *   parseRuleFromText(text)   → calls Groq, returns a raw parsed object
 *   validateParsedRule(parsed) → checks it's usable, returns { isValid, errors }
 *   toDiscountRule(parsed, ruleId) → converts to the exact shape the engine expects
 */

import { callGroq, parseJsonResponse } from '../lib/groqClient.js'

const SYSTEM_PROMPT = `You are a discount rule parser for an e-commerce checkout system.

Parse the user's natural language description of a discount rule into a structured JSON object.

Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation before or after.

Required fields:
- "scope": one of "brand", "platform", "cart"
- "applies_to": string — the brand or platform name this rule targets. Use "" (empty string) for "cart" scope.
- "type": one of "percentage", "flat"
- "value": number — 15 means 15%, 150 means Rs.150. Must be a plain positive number, no currency symbols.
- "stackable": boolean — true if this rule can apply on top of another rule, false otherwise. Default to false if not mentioned.
- "min_cart_value": number or null — only used when scope is "cart" (the minimum cart total in rupees required to unlock this offer). null for brand/platform scope, or if no threshold was mentioned for a cart rule.
- "unresolvable": array of strings — list the field names you could NOT confidently determine from the input. Empty array if everything was clear.

Rules for judgment:
- If the input does not name a specific brand or platform for a "brand"/"platform" rule, add "applies_to" to unresolvable.
- If the input gives no discount amount or percentage at all, add "value" and "type" to unresolvable.
- If scope itself is unclear (not obviously about a brand, a platform, or the whole cart), add "scope" to unresolvable.
- A cart-scope rule with no mentioned minimum value is valid — set min_cart_value to null and do NOT mark it unresolvable, unless the phrase implies a threshold should exist but doesn't state one.
- Never guess a numeric value that wasn't stated in the input.

Example input: "20% off for Natura Casa brand, stackable with other offers"
Example output:
{"scope":"brand","applies_to":"Natura Casa","type":"percentage","value":20,"stackable":true,"min_cart_value":null,"unresolvable":[]}

Example input: "Rs.100 flat discount on all Flipkart items"
Example output:
{"scope":"platform","applies_to":"Flipkart","type":"flat","value":100,"stackable":false,"min_cart_value":null,"unresolvable":[]}

Example input: "10% off if cart value is more than Rs.5,000"
Example output:
{"scope":"cart","applies_to":"","type":"percentage","value":10,"stackable":false,"min_cart_value":5000,"unresolvable":[]}

Example input: "Give a discount for big orders"
Example output:
{"scope":"cart","applies_to":"","type":null,"value":null,"stackable":false,"min_cart_value":null,"unresolvable":["type","value","min_cart_value"]}`

/**
 * Calls Groq to parse a natural-language rule description.
 * @param {string} userInput
 * @returns {Promise<Object>} raw parsed fields (snake_case, as the model returns them)
 */
export async function parseRuleFromText(userInput) {
  if (!userInput || !userInput.trim()) {
    throw new Error('Please describe a discount rule before parsing.')
  }

  const rawText = await callGroq({ system: SYSTEM_PROMPT, user: userInput.trim() })
  return parseJsonResponse(rawText, 'rule parse')
}

const REQUIRED_FIELDS = ['scope', 'type', 'value']
const VALID_SCOPES = ['brand', 'platform', 'cart']
const VALID_TYPES = ['percentage', 'flat']

/**
 * Validates a raw parsed rule before it's shown to the user for confirmation.
 * Returns { isValid, errors }. Errors are written to be directly user-facing.
 */
export function validateParsedRule(parsed) {
  const errors = []

  if (Array.isArray(parsed.unresolvable) && parsed.unresolvable.length > 0) {
    errors.push(
      `Couldn't determine: ${parsed.unresolvable.join(', ')}. Try being more specific — e.g. name the brand or platform, and state a percentage or Rs. amount.`
    )
  }

  for (const field of REQUIRED_FIELDS) {
    const val = parsed[field]
    const alreadyFlagged = errors.some((e) => e.includes(field))
    if ((val === null || val === undefined || val === '') && !alreadyFlagged) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  if (parsed.scope && !VALID_SCOPES.includes(parsed.scope)) {
    errors.push(`Unrecognised scope "${parsed.scope}" — expected brand, platform, or cart.`)
  }

  if (parsed.type && !VALID_TYPES.includes(parsed.type)) {
    errors.push(`Unrecognised discount type "${parsed.type}" — expected percentage or flat.`)
  }

  if (typeof parsed.value === 'number') {
    if (parsed.value <= 0) {
      errors.push('Discount value must be greater than zero.')
    }
    if (parsed.type === 'percentage' && parsed.value > 100) {
      errors.push('Percentage discount cannot exceed 100%.')
    }
  }

  if ((parsed.scope === 'brand' || parsed.scope === 'platform') && !parsed.applies_to) {
    errors.push(`A "${parsed.scope}" rule needs a specific ${parsed.scope} name.`)
  }

  if (parsed.scope === 'cart' && parsed.min_cart_value != null && parsed.min_cart_value < 0) {
    errors.push('Minimum cart value cannot be negative.')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Converts a validated, confirmed parsed rule into the exact DiscountRule
 * shape the engine expects (camelCase, matching csvParser.js output).
 * @param {Object} parsed - raw parsed fields
 * @param {string} ruleId - generated ID for this rule, e.g. "RULE-NL-1"
 */
export function toDiscountRule(parsed, ruleId) {
  return {
    ruleId,
    scope: parsed.scope,
    appliesTo: parsed.applies_to || '',
    type: parsed.type,
    value: Number(parsed.value),
    stackable: Boolean(parsed.stackable),
    minCartValue:
      parsed.scope === 'cart' && parsed.min_cart_value != null
        ? Number(parsed.min_cart_value)
        : null,
  }
}
