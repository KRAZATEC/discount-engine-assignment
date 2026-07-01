# 🎯 Quick Start Testing Guide

Get the project running and test all features in 10 minutes.

---

## Setup (2 minutes)

```bash
# Extract and install
unzip discount-engine-assignment.zip
cd discount-engine-assignment-main
npm install

# Add your Groq API key
cp .env.example .env.local
# Edit .env.local and paste your key from console.groq.com/keys

# Start dev server
npm run dev
# Open http://localhost:5173
```

---

## Test Scenarios (5 minutes each)

### Scenario 1: Base Case (Assignment Spec)
**What it tests:** Core discount logic, cart-level offer

1. Upload `rules.csv`
2. Upload `cart.csv`
3. Click "Calculate Discounts"
4. Check results:
   - **ITEM-04 shows "No offers available"** ✓
   - **Cart offer row appears** (showing −Rs.593 saved) ✓
   - **Final total: Rs.5,339** ✓

**Alternative:** Upload `cart.pdf` instead of `cart.csv` — should get identical results (tests PDF extraction)

---

### Scenario 2: Aggressive Brands
**What it tests:** Flat discount vs. percentage, stacking, high values

1. Upload `rules-aggressive-brands.csv`
2. Upload `cart-electronics.csv`
3. Click "Calculate Discounts"
4. Check results:
   - **ITEM-E2 (iPhone) shows 18% + 8% = 22% total** ✓ (stacking works)
   - **ITEM-E1 (Sony TV): Rs.2,000 flat wins over 15% (23,400)** ✗ Wait — re-read the math
     - Actually 15% on Rs.15,999 = Rs.2,400 > Rs.2,000 flat, so 15% wins
     - **Actually RULE-B1 flat should lose. Let me recalculate:**
       - RULE-B1: Rs.2,000 flat
       - RULE-B3: 8% on Rs.15,999 = Rs.1,280
       - No 15% rule on Sony (only Apple gets 18%). So RULE-B1 (flat 2,000) is the only match.
   - **Final total around Rs.175,152** ✓

**NL Test:** Type `"20% off for Sony Electronics, not stackable"` → Confirm → Recalculates

---

### Scenario 3: Heavy Stackable
**What it tests:** Multiple stackable rules compounding, non-stackable selection

1. Upload `rules-stackable-heavy.csv`
2. Upload `cart-appliances.csv`
3. Click "Calculate Discounts"
4. Check results:
   - **ITEM-A5 (Samsung on Walmart):** RULE-S5 (6% non-stackable) vs. RULE-S2 (10% stackable)
     - 10% saves more, so RULE-S2 wins and applies alone ✓
   - **ITEM-A1 (Samsung on Amazon US):** 12% + 10% = ~22% total (stacking) ✓
   - **Cart offer:** 15% off triggers (total > Rs.5,000) ✓
   - **Final total around Rs.179,478** ✓

---

## NL Rule Testing (2 minutes)

In any scenario, try these in the "Describe a rule in plain English" field:

### ✓ Works (clean parse):
```
"20% off for Sony Electronics brand, stackable with other offers"
→ Confirm → Engine re-runs with new rule added
```

### ✓ Works (edge case):
```
"Rs.500 flat discount on all Walmart items"
→ Confirm → Engine re-runs
```

### ✗ Shows friendly error:
```
"Give a big discount for expensive items"
→ "Couldn't determine: scope, value" (too vague)
```

```
"10% off"
→ "Couldn't determine: scope" (brand? platform? cart?)
```

---

## PDF Testing (1 minute)

1. Keep rules loaded from Scenario 1
2. Clear the cart (upload a blank CSV or just ignore it)
3. Upload `cart-electronics.pdf`
4. Engine auto-runs with existing rules applied to extracted items
5. Results appear immediately

**What's tested:**
- PDF text extraction via pdf.js + Groq LLM parsing ✓
- Multi-word brand/platform names ("Sony Electronics", "Amazon US") stay intact ✓
- Engine re-runs automatically with new cart + old rules ✓

---

## Expected Results Summary

| | Scenario 1 | Scenario 2 | Scenario 3 |
|---|---|---|---|
| **Rules file** | rules.csv | rules-aggressive-brands.csv | rules-stackable-heavy.csv |
| **Cart file** | cart.csv or cart.pdf | cart-electronics.csv or cart-electronics.pdf | cart-appliances.csv or cart-appliances.pdf |
| **Subtotal** | Rs.5,932 | Rs.184,371 | Rs.211,151 |
| **Cart offer** | −Rs.593 (10%) | −Rs.9,219 (5%) | −Rs.31,673 (15%) |
| **Final total** | **Rs.5,339** | **Rs.175,152** | **Rs.179,478** |
| **Key feature** | Non-stackable selection + cart offer | Flat vs % tradeoff + stacking | Heavy stacking + rule selection |

---

## For Your Loom Walkthrough

**Record this sequence (5 minutes max):**

1. **Load Scenario 1, calculate** (30 sec)
   - Show ITEM-04 "No offers available" 
   - Show cart offer row
   - Highlight final total Rs.5,339

2. **Upload cart-electronics.pdf** (20 sec)
   - Talk through the PDF extraction logic (no native PDF input, so we use pdf.js + Groq)
   - Show results auto-populated

3. **Type an NL rule** (40 sec)
   - Input: `"20% off for Samsung brand, stackable with other offers"`
   - Show the Groq parse
   - Show confirmation table with parsed fields
   - Confirm and watch the engine re-run

4. **Type an ambiguous NL rule** (30 sec)
   - Input: `"Give big discounts for orders"`
   - Show specific error "Couldn't determine: scope, type, value"
   - Explain this is validation *before* we ever add the rule

5. **Architecture explanation** (1 min)
   - Show the folder structure: `/parsers/` (CSV, PDF, NL), `/engine/` (pure logic), `/components/` (UI)
   - Explain: "Every input adapter produces `rules[]` and `cartItems[]`, which the engine takes and returns `CartResult`. Adding a 4th input type means one new parser, zero changes to the engine."

---

## Troubleshooting

**"Error: VITE_GROQ_API_KEY missing"**
→ Add your key to `.env.local` and restart `npm run dev`

**"PDF extraction failed"**
→ PDFs are included in sample-data/. If using your own PDF, make sure it has a table with columns: Product, Brand, Platform, Base Price

**"Engine re-run didn't happen after NL rule"**
→ Make sure a cart is loaded first (upload CSV or PDF), then parse the NL rule

**Numbers don't match the guide**
→ Check: rules.csv is what you uploaded (not swapped with another), and items are priced correctly (base_price is in rupees, not thousands)

---

## Files in sample-data/

```
✓ rules.csv                    — assignment spec data
✓ cart.csv                     — 6 items, Rs.1,299-2,499 each
✓ cart.pdf                     — same 6 items in PDF format

✓ rules-aggressive-brands.csv  — flat discounts, stacking
✓ cart-electronics.csv         — 5 electronics items, high values
✓ cart-electronics.pdf         — same 5 items in PDF format

✓ rules-stackable-heavy.csv    — 5 rules, 3 stackable
✓ cart-appliances.csv          — 6 appliances with Samsung/LG/Generic
✓ cart-appliances.pdf          — same 6 items in PDF format
```

---

## Success Criteria

✓ All three scenarios load and calculate without errors  
✓ Expected final totals match the guide (allow ±1 for rounding)  
✓ "No offers available" message appears for unmatched items  
✓ Cart offer row only shows when subtotal ≥ threshold  
✓ NL rule parsing + confirmation works  
✓ Ambiguous NL input surfaces specific missing fields  
✓ PDF extraction works (same items, same final total as CSV)  
✓ Architecture clearly separates parsers from engine  

**If all ✓, you're ready to submit!**
