# Sample Data & Testing Guide

This document explains the three test scenarios included with the project and their expected results.

---

## Scenario 1: Original Assignment Data (Base Case)

**Files:**
- `rules.csv` + `cart.csv` + `cart.pdf` (all match each other)

**Purpose:** Verify the core implementation against the assignment spec.

**Rules:**
```
RULE-01: Platform "Amazon India" → 15% off (non-stackable)
RULE-02: Brand "Natura Casa" → Rs.150 flat (non-stackable)
RULE-03: Platform "Flipkart" → 10% off (stackable)
RULE-04: Cart-wide → 10% off if cart ≥ Rs.4,000
```

**Test Case:** 6 items, Rs.1,299–Rs.2,499 each

### Expected Results

| Item | Base | Rules Match | Final | Reasoning |
|---|---|---|---|---|
| ITEM-01: Cushion Cover | Rs.1,299 | RULE-01 (15% = 195) > RULE-02 (150) | **Rs.1,104** | Platform offer wins |
| ITEM-02: Bed Sheet Set | Rs.849 | RULE-02 (150) + RULE-03 stacked | **Rs.629** | Flat 150 → 699, then 10% → 629 |
| ITEM-03: Wall Shelf | Rs.599 | RULE-01 (15%) | **Rs.509** | Platform offer applied |
| ITEM-04: Ceramic Vase | Rs.2,499 | — | **Rs.2,499** | No offers available |
| ITEM-05: Cutting Board | Rs.449 | RULE-01 (15%) | **Rs.382** | Platform offer applied |
| ITEM-06: Desk Organiser | Rs.899 | RULE-03 stacked | **Rs.809** | Stackable rule applied |

**Cart Totals:**
- Subtotal (after item offers): **Rs.5,932**
- Cart offer (RULE-04: 5,932 ≥ 4,000): −**Rs.593** (10% off)
- **Final Cart Total: Rs.5,339**

**Test with:** 
1. Upload `rules.csv` + `cart.csv` → Calculate
2. Upload `rules.csv` + `cart.pdf` → Calculate (should get identical results)

---

## Scenario 2: Aggressive Brand Discounts

**Files:**
- `rules-aggressive-brands.csv`
- `cart-electronics.csv` 
- `cart-electronics.pdf` (both match)

**Purpose:** Test flat discounts beating percentage discounts at high price points, and platform stacking.

**Rules:**
```
RULE-B1: Brand "Sony Electronics" → Rs.2,000 flat (non-stackable)
RULE-B2: Brand "Apple" → 18% off (non-stackable)
RULE-B3: Platform "Best Buy" → 8% off (stackable)
RULE-B4: Cart-wide → 5% off if cart ≥ Rs.8,000
```

**Test Case:** 5 electronics items on Best Buy, Rs.499–Rs.129,999

### Expected Results

| Item | Base | Rules Match | Final | Reasoning |
|---|---|---|---|---|
| ITEM-E1: Sony TV | Rs.15,999 | RULE-B1 (2,000 flat) | **Rs.13,999** | Flat discount (non-stackable) |
| ITEM-E2: iPhone 15 Pro | Rs.129,999 | RULE-B2 (18% = 23,400) > n/a | Rs.106,599 | Then RULE-B3 (8% of 106,599 = 8,528) | **Rs.98,071** | 18% + 8% stacked |
| ITEM-E3: iPad Air | Rs.54,999 | RULE-B2 (18% = 9,900) | Rs.45,099 | Then RULE-B3 (8% of 45,099 = 3,608) | **Rs.41,491** | 18% + 8% stacked |
| ITEM-E4: Sony Headphones | Rs.34,990 | RULE-B1 (2,000) | Rs.32,990 | Then RULE-B3 (8% = 2,639) | **Rs.30,351** | Flat + 8% stacked |
| ITEM-E5: USB Cable | Rs.499 | RULE-B3 (8% = 40) | **Rs.459** | Stackable rule only |

**Cart Totals:**
- Subtotal (after item offers): **Rs.184,371**
- Cart offer (RULE-B4: 184,371 ≥ 8,000): −**Rs.9,219** (5% off)
- **Final Cart Total: Rs.175,152**

**Key Learning:** Even a Rs.2,000 flat discount beats RULE-B2's 18% (23,400) at a Rs.15,999 price point — this tests the "biggest saving in rupees" logic.

**Test with:**
1. Upload `rules-aggressive-brands.csv` + `cart-electronics.csv` → Calculate
2. Upload `rules-aggressive-brands.csv` + `cart-electronics.pdf` → Calculate (should match)
3. Try the NL rule input: `"20% off for Sony Electronics, not stackable"` and observe the engine re-run

---

## Scenario 3: Heavy Stackable Rules

**Files:**
- `rules-stackable-heavy.csv`
- `cart-appliances.csv`
- `cart-appliances.pdf` (both match)

**Purpose:** Test multiple stackable rules compounding, platform vs. brand rule selection, and near-miss cart offer.

**Rules:**
```
RULE-S1: Platform "Amazon US" → 12% off (stackable)
RULE-S2: Brand "Samsung" → 10% off (stackable)
RULE-S3: Brand "LG" → 7% off (stackable)
RULE-S4: Cart-wide → 15% off if cart ≥ Rs.5,000
RULE-S5: Platform "Walmart" → 6% off (non-stackable)
```

**Test Case:** 6 appliances items, mix of Amazon US / Walmart, Samsung / LG / Generic brands

### Expected Results

| Item | Base | Rules Match | Final | Reasoning |
|---|---|---|---|---|
| ITEM-A1: Samsung TV (Amazon) | Rs.78,900 | RULE-S1 (12%) + RULE-S2 (10%) | Rs.78,900 × 0.88 = 69,432 | Platform (12%) applied first |
| | | | → 69,432 × 0.90 = 62,489 | Then brand stacked (10% of 69,432) |
| | | | **Rs.62,489** | Both stackable |
| ITEM-A2: LG Washing Machine | Rs.42,500 | RULE-S1 (12%) + RULE-S3 (7%) | Rs.42,500 × 0.88 = 37,400 | Platform (12%) first |
| | | | → 37,400 × 0.93 = 34,782 | Brand stacked (7% of 37,400) |
| | | | **Rs.34,782** | 19% total off |
| ITEM-A3: Samsung Refrigerator | Rs.95,000 | RULE-S1 (12%) + RULE-S2 (10%) | Rs.95,000 × 0.88 = 83,600 | Both stackable |
| | | | → 83,600 × 0.90 = 75,240 | |
| | | | **Rs.75,240** | 20.8% total off |
| ITEM-A4: LG AC | Rs.28,900 | RULE-S1 (12%) + RULE-S3 (7%) | Rs.28,900 × 0.88 = 25,432 | Both stackable |
| | | | → 25,432 × 0.93 = 23,652 | |
| | | | **Rs.23,652** | 18.1% total off |
| ITEM-A5: Samsung Microwave (Walmart) | Rs.12,999 | RULE-S5 (6% non-stk) vs. RULE-S2 (10% stk) | RULE-S2 wins (10% = 1,300 > 6% = 780) | Brand rule gives bigger saving |
| | | | Rs.12,999 × 0.90 = 11,699 | Stackable can't stack with non-stk |
| | | | **Rs.11,699** | 10% off |
| ITEM-A6: Generic Mixer (Walmart) | Rs.3,499 | RULE-S5 (6%) | Rs.3,499 × 0.94 | **Rs.3,289** | Platform offer only |
| | | | | |

**Subtotal:** Rs.62,489 + Rs.34,782 + Rs.75,240 + Rs.23,652 + Rs.11,699 + Rs.3,289 = **Rs.211,151**

**Cart Offer:**
- RULE-S4 triggers (211,151 ≥ 5,000): 15% off
- Discount: Rs.211,151 × 0.15 = **−Rs.31,673**
- **Final Cart Total: Rs.179,478**

**Key Learning:**
1. Multiple stackable rules on the same item compound dramatically (12% + 10% = ~22% total, not just 12%)
2. When a non-stackable rule (RULE-S5: 6%) and stackable rule (RULE-S2: 10%) both match, the biggest saving wins, then stackable rule doesn't apply on top since a non-stackable already won
3. Cart is well above the Rs.5,000 threshold, so full 15% cart discount applies

**Test with:**
1. Upload `rules-stackable-heavy.csv` + `cart-appliances.csv` → Calculate
2. Upload `rules-stackable-heavy.csv` + `cart-appliances.pdf` → Calculate (should match)
3. Try NL: `"20% off Samsung brand, stackable with other offers"` and watch subtotal/final totals change
4. Try NL: `"If cart is over Rs.3,000 give 12% off"` to test cart rule parsing

---

## Testing NL Rule Input (Task 2)

For each scenario, try these NL inputs to test parsing + confirmation:

### Good inputs (should parse cleanly):
```
"20% off for Sony Electronics, not stackable"
"Rs.500 flat discount on all Amazon US items"
"15% off if cart total exceeds Rs.10,000"
"10% discount for Samsung brand, stackable"
```

### Ambiguous inputs (should surface unresolvable fields):
```
"Give a big discount for expensive items"
→ Error: Can't determine value, min_cart_value (too vague)

"20% off Flipkart"
→ Error: Can't determine scope (brand or platform?)

"Rs.1000 for bulk orders"
→ Error: Can't determine min_cart_value (what's "bulk"?)
```

### Edge cases (should handle gracefully):
```
"150% off everything" 
→ Error: Percentage can't exceed 100%

"Rs.-500 discount"
→ Error: Value must be positive

"Free item for all customers"
→ Error: Can't determine a numeric value
```

---

## PDF Extraction Testing

Each CSV has a matching PDF with the exact same data. Test the PDF extraction:

1. **Try uploading a PDF alone** (with rules already loaded):
   ```
   Upload rules.csv → Upload cart.pdf → Cart should populate and engine re-runs
   ```

2. **Compare CSV vs PDF results:**
   ```
   Upload rules.csv + cart.csv → Note final total
   Clear both, upload rules.csv + cart.pdf → Should get identical final total
   ```

3. **Malformed PDF test** (if you edit a PDF and break a row):
   ```
   You should see warnings like "Skipped row 3: missing price"
   Engine should still work with the valid rows
   ```

---

## Quick Sanity Checks

After each test, verify:

✓ **Item-level calculations are correct**
- A 15% discount on Rs.1,000 → Rs.850 (not Rs.151 or other rounding mistakes)
- A Rs.150 flat on Rs.1,299 → Rs.1,149 (not negative, not exceeding base)

✓ **Stackable rules really stack**
- Item with 12% + 10% should be ~22% off, not 12% off
- Calculate: 1000 × 0.88 × 0.90 = 792 (22.8% off)

✓ **Non-stackable rule selection**
- When two flat/percentage rules conflict, the one saving more rupees wins
- Rs.2,000 flat beats 18% on Rs.15,999 (saves 2,000 vs 23,400? No — 2,000 vs. 2,340? Yes, flat wins)

✓ **Cart offer only shows when triggered**
- If subtotal Rs.3,500 and threshold Rs.4,000, cart offer doesn't appear
- If you add enough items to cross Rs.4,000, it now appears

✓ **Customer-facing reasoning is clear**
- "Platform offer: 15% off" not just "RULE-01"
- "No offers available" not blank

---

## How to Use These Files

1. **Extract the project zip**
   ```bash
   unzip discount-engine-assignment.zip
   cd discount-engine-assignment-main
   ```

2. **Install and run**
   ```bash
   npm install
   cp .env.example .env.local  # add Groq key
   npm run dev
   ```

3. **Test all three scenarios**
   ```
   Scenario 1: Upload rules.csv + cart.csv → Calculate
   Scenario 2: Upload rules-aggressive-brands.csv + cart-electronics.csv → Calculate
   Scenario 3: Upload rules-stackable-heavy.csv + cart-appliances.csv → Calculate
   ```

4. **Record your Loom walkthrough** covering:
   - Load Scenario 1 (base case)
   - Show item results, cart offer row, final total
   - Test PDF upload with cart-electronics.pdf
   - Show one NL rule parse that succeeds
   - Show one ambiguous NL input that surfaces errors
   - Explain the architecture (3 parsers → 1 engine)

---

## Expected Files in sample-data/

```
rules.csv                          (original assignment data)
rules-aggressive-brands.csv        (scenario 2)
rules-stackable-heavy.csv          (scenario 3)

cart.csv                           (scenario 1)
cart-electronics.csv               (scenario 2)
cart-appliances.csv                (scenario 3)

cart.pdf                           (scenario 1 - matches cart.csv)
cart-electronics.pdf               (scenario 2 - matches cart-electronics.csv)
cart-appliances.pdf                (scenario 3 - matches cart-appliances.csv)
```
