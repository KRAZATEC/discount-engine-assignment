/**
 * pdfParser.js
 *
 * Converts an uploaded cart PDF into an array of CartItem objects.
 *
 * Groq's chat completion API does not accept PDF files directly (unlike
 * some vision-capable APIs), so this is a two-step pipeline:
 *
 *   1. pdf.js extracts raw text from the PDF, entirely in the browser.
 *   2. That text is handed to Groq's LLM, which is far more reliable than
 *      regex at turning a loosely-formatted table (inconsistent spacing,
 *      multi-word platform names like "Amazon India") into clean JSON.
 *
 * This is documented as a deliberate tradeoff in DECISIONS.md: an LLM step
 * costs a network call, but a regex/column-position parser breaks the
 * moment column widths shift, which real-world PDFs do constantly.
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { callGroq, parseJsonResponse } from '../lib/groqClient.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const SYSTEM_PROMPT = `You extract cart item data from raw text pulled out of a PDF order sheet.

The text may have irregular spacing because it was extracted from a PDF table — do your best
to identify the table structure regardless of exact whitespace.

The table has these columns, in this order: Product, Brand, Platform, Base Price.

Respond with ONLY a JSON object of this exact shape, no markdown, no explanation:
{"items":[{"product":"...","brand":"...","platform":"...","base_price":1299}],"warnings":["..."]}

Rules:
- base_price must be a plain number (strip "Rs.", commas, and whitespace).
- Platform and brand names can contain spaces (e.g. "Amazon India", "Natura Casa") — keep them intact, don't split them.
- If a row is missing a required value (product, brand, platform, or a parsable price), skip that row entirely and add a short note to "warnings" describing which row and why, e.g. "Skipped row 3: no price found".
- Ignore header rows, divider lines ("---" or "───"), and any order/date metadata lines — only return actual item rows.
- If you find zero valid item rows, return {"items":[],"warnings":["No item rows could be identified in this document."]}.`

/**
 * Extracts raw text from every page of a PDF file using pdf.js.
 * @param {File} file
 * @returns {Promise<string>}
 */
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    // Preserve rough line structure by joining items with their y-position groups.
    // pdf.js gives us a flat item list; simplest robust approach is to join with
    // spaces and let the LLM re-derive rows using column keywords/prices as anchors.
    const pageText = content.items.map((item) => item.str).join(' ')
    fullText += pageText + '\n'
  }
  return fullText.trim()
}

/**
 * Parses a cart PDF file into CartItem[] (same shape csvParser.js produces).
 * Returns { data, errors, warnings }.
 *
 * @param {File} file
 * @returns {Promise<{ data: Object[], errors: string[], warnings: string[] }>}
 */
export async function parseCartPDF(file) {
  if (!file || file.type !== 'application/pdf') {
    return { data: [], errors: ['Please upload a valid PDF file.'], warnings: [] }
  }

  let rawText
  try {
    rawText = await extractTextFromPDF(file)
  } catch (err) {
    return { data: [], errors: [`Could not read the PDF file: ${err.message}`], warnings: [] }
  }

  if (!rawText) {
    return { data: [], errors: ['The PDF appears to have no extractable text (it may be a scanned image).'], warnings: [] }
  }

  let parsed
  try {
    const rawResponse = await callGroq({ system: SYSTEM_PROMPT, user: rawText })
    parsed = parseJsonResponse(rawResponse, 'PDF extraction')
  } catch (err) {
    return { data: [], errors: [err.message], warnings: [] }
  }

  const items = Array.isArray(parsed.items) ? parsed.items : []
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : []

  if (items.length === 0) {
    return {
      data: [],
      errors: ['No cart items could be extracted from this PDF. Make sure it contains a table with Product, Brand, Platform, and Base Price columns.'],
      warnings,
    }
  }

  const data = []
  const errors = []

  items.forEach((item, i) => {
    const rowNum = i + 1
    const missing = []
    if (!item.product) missing.push('product')
    if (!item.brand) missing.push('brand')
    if (!item.platform) missing.push('platform')
    if (item.base_price === undefined || item.base_price === null) missing.push('base_price')

    if (missing.length > 0) {
      warnings.push(`Skipped extracted row ${rowNum}: missing ${missing.join(', ')}`)
      return
    }

    const basePrice = Number(item.base_price)
    if (isNaN(basePrice) || basePrice <= 0) {
      warnings.push(`Skipped extracted row ${rowNum}: invalid price "${item.base_price}"`)
      return
    }

    data.push({
      itemId: `PDF-ITEM-${data.length + 1}`,
      product: String(item.product).trim(),
      brand: String(item.brand).trim(),
      platform: String(item.platform).trim(),
      basePrice: Math.round(basePrice),
    })
  })

  if (data.length === 0) {
    errors.push('Every row extracted from the PDF was incomplete or invalid — nothing could be loaded.')
  }

  return { data, errors, warnings }
}
