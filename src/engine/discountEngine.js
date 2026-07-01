/**
 * discountEngine.js
 *
 * Pure discount calculation logic. No UI, no side effects, no network calls.
 * All functions take plain objects and return plain objects.
 *
 * This file is the single source of truth for "how a discount is calculated."
 * Every input mode (CSV, natural language, PDF) produces rules and cart items
 * in the shapes below and hands them to runEngine(). Nothing in this file
 * knows or cares where the data came from.
 *
 * Data shapes:
 *
 * DiscountRule {
 *   ruleId:       string                        — e.g. "RULE-01"
 *   scope:        "brand" | "platform" | "cart"
 *   appliesTo:    string                         — brand/platform name; "" for cart scope
 *   type:         "percentage" | "flat"
 *   value:        number                         — percentage as integer (15 = 15%), flat in rupees
 *   stackable:    boolean
 *   minCartValue: number | null                  — only meaningful for scope "cart"
 * }
 *
 * CartItem {
 *   itemId:    string       — e.g. "ITEM-01"
 *   product:   string
 *   brand:     string
 *   platform:  string
 *   basePrice: number       — in rupees
 * }
 *
 * ItemResult {
 *   itemId:        string
 *   product:       string
 *   brand:         string
 *   platform:      string
 *   basePrice:     number
 *   finalPrice:    number
 *   totalDiscount: number
 *   appliedRules:  string[]
 *   skippedRules:  string[]
 *   reasoning:     string   — customer-readable explanation
 * }
 *
 * CartResult {
 *   itemResults:  ItemResult[]
 *   subtotal:     number              — sum of item final prices, before cart offer
 *   cartOfferRule: DiscountRule | null
 *   cartDiscount: number              — rupees saved from the cart-level offer
 *   finalTotal:   number              — subtotal - cartDiscount
 *   nearMiss:     DiscountRule | null — closest cart rule the customer didn't unlock
 * }
 */

// ── Item-level discounts ────────────────────────────────────────────

/**
 * Returns true if the rule applies to this cart item.
 * Cart-scope rules never match at the item level — they are evaluated
 * separately, once, against the cart subtotal.
 */
export function ruleMatchesItem(item, rule) {
  const normalise = (s) => s.trim().toLowerCase()
  if (rule.scope === 'brand') {
    return normalise(item.brand) === normalise(rule.appliesTo)
  }
  if (rule.scope === 'platform') {
    return normalise(item.platform) === normalise(rule.appliesTo)
  }
  return false
}

/**
 * Calculates the rupee discount a rule gives on a given price.
 * Uses the provided price, not the original base price — important for stacking.
 * A flat discount is capped at the price itself so a final price never goes negative.
 */
export function calculateDiscountAmount(price, rule) {
  if (rule.type === 'percentage') {
    return Math.round((price * rule.value) / 100)
  }
  if (rule.type === 'flat') {
    return Math.min(rule.value, price)
  }
  return 0
}

/**
 * Builds the customer-facing reasoning string for an applied rule.
 */
function ruleToReasoning(rule) {
  const scopeLabel = rule.scope === 'brand' ? 'Brand' : 'Platform'
  if (rule.type === 'percentage') {
    return `${scopeLabel} offer: ${rule.value}% off`
  }
  if (rule.type === 'flat') {
    return `${scopeLabel} offer: Rs.${rule.value} off`
  }
  return `${scopeLabel} offer applied`
}

/**
 * Applies the active item-level discount rules to a single cart item.
 * Returns an ItemResult.
 *
 * Logic:
 *   1. Find all rules that match this item (brand/platform scope only).
 *   2. Among non-stackable rules, pick the one giving the largest rupee saving.
 *      Scope does not matter for this comparison — only the saving does.
 *   3. Apply any stackable rules on top of that price. A stackable rule
 *      applies on its own even if no non-stackable rule matched.
 *   4. Build the reasoning string from what was applied.
 *   5. If nothing matched at all, return the base price with a clear note.
 */
export function applyDiscounts(item, rules) {
  const matchingRules = rules.filter((r) => ruleMatchesItem(item, r))

  if (matchingRules.length === 0) {
    return {
      itemId: item.itemId,
      product: item.product,
      brand: item.brand,
      platform: item.platform,
      basePrice: item.basePrice,
      finalPrice: item.basePrice,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    }
  }

  const nonStackable = matchingRules.filter((r) => !r.stackable)
  const stackable = matchingRules.filter((r) => r.stackable)

  // Pick the non-stackable rule that gives the largest saving in rupees
  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(item.basePrice, b) -
        calculateDiscountAmount(item.basePrice, a)
    )
    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  // Apply the winning non-stackable rule first, then stack on top of that price
  let price = item.basePrice
  const appliedRules = []
  const reasoningParts = []

  if (winner) {
    price -= calculateDiscountAmount(price, winner)
    appliedRules.push(winner.ruleId)
    reasoningParts.push(ruleToReasoning(winner))
  }

  for (const rule of stackable) {
    price -= calculateDiscountAmount(price, rule)
    appliedRules.push(rule.ruleId)
    reasoningParts.push(ruleToReasoning(rule))
  }

  const finalPrice = Math.round(price)

  return {
    itemId: item.itemId,
    product: item.product,
    brand: item.brand,
    platform: item.platform,
    basePrice: item.basePrice,
    finalPrice,
    totalDiscount: item.basePrice - finalPrice,
    appliedRules,
    skippedRules: skipped.map((r) => r.ruleId),
    reasoning: reasoningParts.join(' + '),
  }
}

/**
 * Runs applyDiscounts across every item in the cart.
 * Returns an array of ItemResult objects.
 */
export function processCart(cartItems, rules) {
  return cartItems.map((item) => applyDiscounts(item, rules))
}

// ── Cart-level discount ──────────────────────────────────────────────

/**
 * Evaluates cart-scope rules against the cart subtotal (the sum of each
 * item's final price, after item-level discounts). This runs once, after
 * every item has already been discounted — never per item.
 *
 * If multiple cart rules are eligible, the one giving the largest rupee
 * saving wins (same "biggest saving wins" principle used at the item level).
 *
 * If no cart rule is eligible, we surface the nearest unmet threshold as
 * `nearMiss` so the UI can show the customer how close they are — this is
 * not required by the spec, but it's the kind of thing a real checkout
 * page would show.
 */
export function applyCartDiscount(itemResults, rules) {
  const subtotal = itemResults.reduce((sum, r) => sum + r.finalPrice, 0)
  const cartRules = rules.filter((r) => r.scope === 'cart')

  const eligible = cartRules.filter(
    (r) => r.minCartValue == null || subtotal >= r.minCartValue
  )

  if (eligible.length === 0) {
    const nearMiss = cartRules
      .filter((r) => r.minCartValue != null && subtotal < r.minCartValue)
      .sort((a, b) => a.minCartValue - b.minCartValue)[0] ?? null

    return {
      subtotal,
      cartOfferRule: null,
      cartDiscount: 0,
      finalTotal: subtotal,
      nearMiss,
    }
  }

  const withSavings = eligible.map((rule) => ({
    rule,
    saving: calculateDiscountAmount(subtotal, rule),
  }))
  withSavings.sort((a, b) => b.saving - a.saving)
  const { rule: bestRule, saving: cartDiscount } = withSavings[0]

  return {
    subtotal,
    cartOfferRule: bestRule,
    cartDiscount,
    finalTotal: subtotal - cartDiscount,
    nearMiss: null,
  }
}

/**
 * Main entry point. Runs item-level discounts, then the cart-level offer,
 * and returns the complete picture the UI needs to render.
 *
 * @param {CartItem[]} cartItems
 * @param {DiscountRule[]} rules
 * @returns {CartResult}
 */
export function runEngine(cartItems, rules) {
  const itemResults = processCart(cartItems, rules)
  const cart = applyCartDiscount(itemResults, rules)
  return { itemResults, ...cart }
}

/**
 * Sums the final prices across all item results.
 * Kept for backward compatibility / standalone use; runEngine().subtotal
 * is the same value computed as part of the full cart result.
 */
export function cartTotal(results) {
  return results.reduce((sum, r) => sum + r.finalPrice, 0)
}
