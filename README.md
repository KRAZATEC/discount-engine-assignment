# Opptra Discount Engine

A customer-facing cart pricing engine. Given a set of discount rules and a
cart, it applies the rule that gives the customer the biggest saving on each
item, stacks any stackable rules on top, applies a cart-wide offer if the
subtotal clears a threshold, and shows a plain-language breakdown of what
was applied — the way a real checkout page would.

**Live deployment:** https://discount-engine-assignment-tau.vercel.app/
**Live Recording URl:** https://www.loom.com/share/43652e0a7b054848b724989724a0ac92
---

## Run locally (3 steps)

```bash
npm install
cp .env.example .env.local   # then add your Groq API key
npm run dev
```

Open http://localhost:5173

Get a free Groq API key at **https://console.groq.com/keys**.

---

## What's implemented

| | |
|---|---|
| **Foundation** | Base engine — CSV upload for rules + cart, discount calculation, results display |
| **Task 1** | Cart-level offer — `RULE-04` (10% off if cart ≥ Rs.4,000) shown as a separate line, only when triggered |
| **Task 2** | Natural language rule input — type a rule in plain English, Groq parses it, you confirm before it's added, engine re-runs |
| **Task 3** | PDF cart upload — upload an order PDF, items are extracted and replace the current cart, engine re-runs against existing rules |

Try it with the sample data in `sample-data/`:
- `rules.csv` — the 4 sample rules, including the cart-level `RULE-04`
- `cart.csv` — the 6 sample items
- `cart.pdf` — the same 6 items as a PDF, for testing Task 3

---

## LLM provider: Groq

This project uses **Groq** (not Anthropic) for both natural-language rule
parsing and PDF item extraction, via Groq's OpenAI-compatible chat
completions endpoint. Default model is `llama-3.3-70b-versatile`.

Configure in `.env.local`:

```
VITE_GROQ_API_KEY=your-groq-api-key-here
VITE_GROQ_MODEL=llama-3.3-70b-versatile   # optional
```

See [DECISIONS.md](./DECISIONS.md) for why the PDF path uses a
text-extraction + LLM-structuring pipeline rather than a native PDF input.

---

## Architecture

```
CSV upload   ─┐
NL text      ─┼──►  rules[] + cartItems[]  ──►  runEngine()  ──►  CartResult
PDF upload   ─┘
```

```
src/
├── engine/
│   └── discountEngine.js     ← pure functions only. No UI, no API, no parsing.
│
├── parsers/                  ← "input adapters" — every one of these produces
│   ├── csvParser.js            the same two shapes: DiscountRule[] and CartItem[]
│   ├── nlParser.js             None of them import the engine's internals beyond
│   └── pdfParser.js            those shapes. The engine never imports any of them.
│
├── lib/
│   └── groqClient.js         ← single shared Groq API wrapper (used by nlParser + pdfParser)
│
├── components/
│   ├── CsvUploader.jsx        ← CSV file input (rules or cart)
│   ├── PdfUploader.jsx        ← PDF file input (cart only)
│   ├── NLRuleInput.jsx        ← text field + Groq parse + confirmation step
│   ├── DataTable.jsx          ← generic table renderer
│   └── ErrorBanner.jsx        ← error / warning banner (two variants)
│
└── App.jsx                    ← owns all state, wires inputs → engine → results
```

**Why this shape:** the assignment brief says *"the inputs should adapt to
the engine, not the other way around."* `discountEngine.js` has zero
knowledge of CSV, PDFs, or LLMs — it only knows `DiscountRule[]` and
`CartItem[]`. Adding a fourth input mode (e.g. a barcode scanner, a
different marketplace API) means writing one new file in `src/parsers/`
and wiring one new handler in `App.jsx`. The engine, and every other input
path, stays untouched.

---

## Rule scopes & CSV format

**rules.csv**

| Column | Type | Notes |
|---|---|---|
| `rule_id` | string | e.g. `RULE-01` |
| `scope` | `brand` \| `platform` \| `cart` | |
| `applies_to` | string | brand/platform name; blank for `cart` scope |
| `type` | `percentage` \| `flat` | |
| `value` | number | `15` = 15%, `150` = Rs.150 |
| `stackable` | `true` \| `false` | |
| `min_cart_value` | number | required for `cart` scope, blank otherwise |

**cart.csv**

| Column | Type | Example |
|---|---|---|
| `item_id` | string | `ITEM-01` |
| `product` | string | `Cushion Cover` |
| `brand` | string | `Natura Casa` |
| `platform` | string | `Amazon India` |
| `base_price` | number | `1299` |

---

## Discount selection logic

- **Item level:** when multiple non-stackable rules match an item, the one
  giving the largest saving **in rupees** wins — scope doesn't matter, only
  the saving does. Any `stackable: true` rule then applies on top of that
  winning price. A stackable rule applies on its own if no non-stackable
  rule matched. If nothing matches, the item keeps its base price with a
  "No offers available" note.
- **Cart level:** evaluated once, after every item's final price is known.
  If the subtotal meets a `cart`-scope rule's `min_cart_value`, that
  percentage is applied to the subtotal as a separate line, shown only when
  triggered. If the cart is short of the threshold, the UI shows how much
  more is needed to unlock it.

## Expected results for the sample data

| Item | Base Price | Final Price | Reasoning |
|---|---|---|---|
| ITEM-01 | Rs.1,299 | Rs.1,104 | Platform offer: 15% off (beats Rs.150 flat) |
| ITEM-02 | Rs.849 | Rs.629 | Brand offer: Rs.150 off + Platform offer: 10% off (stacked) |
| ITEM-03 | Rs.599 | Rs.509 | Platform offer: 15% off |
| ITEM-04 | Rs.2,499 | Rs.2,499 | No offers available |
| ITEM-05 | Rs.449 | Rs.382 | Platform offer: 15% off |
| ITEM-06 | Rs.899 | Rs.809 | Platform offer: 10% off |
| **Subtotal** | | **Rs.5,932** | |
| **Cart offer** | | **−Rs.593** | RULE-04: 10% off (Rs.5,932 ≥ Rs.4,000) |
| **Final Cart Total** | | **Rs.5,339** | |

---

## Deploying

```bash
npm run build
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host, and add
the environment variables (`VITE_GROQ_API_KEY`, optionally
`VITE_GROQ_MODEL`) in your host's dashboard before building/deploying —
Vite inlines `VITE_*` env vars at build time, so they must be present
when `npm run build` runs on the host, not just locally.

**Vercel:** Project Settings → Environment Variables → add
`VITE_GROQ_API_KEY` → redeploy.
**Netlify:** Site settings → Environment variables → add the same → redeploy.

---

## Known tradeoffs

See [DECISIONS.md](./DECISIONS.md) for the reasoning behind rounding,
PDF parsing strategy, LLM validation, and edge-case handling.
