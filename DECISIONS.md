# Design Decisions

Documenting the tradeoffs and judgment calls made while building this,
per the assignment's "Tradeoff Judgment" evaluation criterion.

## LLM provider: Groq instead of Anthropic

The brief doesn't mandate a specific LLM provider. This build uses Groq's
OpenAI-compatible chat completions endpoint (`llama-3.3-70b-versatile` by
default) for both the natural-language rule parser and the PDF extraction
step. Both features are isolated behind `src/lib/groqClient.js`, so
swapping providers later means changing one file, not the parsers that
call it.

## Rounding

Percentage discounts on prices like Rs.1,299 × 15% produce fractional
rupees (Rs.194.85). **Decision:** round to the nearest rupee at the point
each discount is subtracted (`Math.round` inside `calculateDiscountAmount`
and again on the final price), not just once at the very end. This keeps
stacked discounts consistent with the intermediate price a customer would
actually see, and matches the assignment's own expected output
(Rs.1,299 → Rs.1,104).

## Flat discounts can't exceed the price

A flat-Rs.150 rule on an item priced under Rs.150 would otherwise produce
a negative final price. **Decision:** cap a flat discount at the current
price (`Math.min(rule.value, price)`), so the worst case is a free item,
never a negative one. Not currently exercised by the sample data, but a
real catalog will eventually have a low-priced item under some brand's
flat discount, and the engine shouldn't return a negative sticker price
when that happens.

## Multiple eligible cart-level rules

If more than one `cart`-scope rule is eligible at once, **decision:**
apply whichever gives the largest rupee saving — the same "biggest saving
wins" principle already used for item-level non-stackable rules, applied
consistently one level up.

## Cart total just below the threshold

Not required by the spec, but when the subtotal is close to a cart rule's
`min_cart_value` and hasn't crossed it, the UI shows a near-miss hint
("Add Rs.X more to unlock Y% off"). This is the kind of thing a real
checkout page does to nudge conversion, and it's a natural side effect of
already knowing the nearest unmet threshold — cheap to add, meaningfully
better for the customer.

## PDF parsing: text extraction + LLM structuring, not native PDF input

Groq's chat completions API doesn't accept PDF files directly. Two options
were considered:

1. **Regex / column-position parsing** of the raw text pdf.js extracts.
2. **pdf.js extracts text → Groq structures it into JSON.**

Option 1 was tried first and discarded: pdf.js text extraction doesn't
preserve column boundaries, and multi-word values like "Amazon India" or
"Natura Casa" get freely mixed with adjacent columns depending on font
metrics and whitespace collapsing. A regex parser tuned to one PDF's
layout breaks on the next one.

**Decision:** went with option 2. It costs one extra network call per PDF
upload, but the model reliably keeps multi-word brand/platform names
intact and can skip malformed rows without a chain of increasingly
specific regexes. This is documented as a deliberate cost/robustness
tradeoff, not an oversight.

## Malformed PDF rows

If a row is missing a required field or has an unparseable price,
**decision:** skip that row and surface it in an amber "rows skipped"
banner naming which row and why, rather than either silently dropping data
or failing the whole upload. The customer/operator can see exactly what
didn't make it into the cart.

## LLM returns invalid or incomplete JSON

If Groq's response isn't valid JSON, or is missing required fields,
**decision:** never guess. `parseJsonResponse` throws a specific,
user-facing error; `validateParsedRule` checks required fields and value
ranges (e.g. percentage ≤ 100, value > 0) before the confirmation step is
ever shown. A rule that fails validation is never silently completed with
a default — the ambiguous-input case ("Give a discount for big orders")
is expected to surface as an explicit list of what's missing, not an
auto-filled guess.

## Confirmation step is mandatory, not optional

Every NL-parsed rule — even an unambiguous one — goes through the
confirm/discard step before being added to `rules[]`. This was a
deliberate choice over auto-adding "clean" parses: the spec explicitly
asks for a confirmation step, and showing it consistently (rather than
only for rules the app is "unsure" about) means the user always sees
exactly what will be evaluated against their cart, with no silent
first-parse-wins behavior.

## Environment variables and deployment

Vite inlines `VITE_*` environment variables at build time. **Decision:**
document explicitly in the README that the Groq key must be set in the
hosting platform's environment variables *before* the production build
runs there — a key that only exists in a local `.env.local` will not make
it into a Vercel/Netlify build unless it's also configured on the host.
