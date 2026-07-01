/**
 * App.jsx
 *
 * Top-level component. Owns all state (rules, cart items, results) and
 * wires together every input path into the single engine:
 *
 *   CSV upload  ──┐
 *   NL text     ──┼──► rules[] + cartItems[] ──► runEngine() ──► CartResult
 *   PDF upload  ──┘
 *
 * No input component talks to the engine directly, and the engine never
 * imports a parser or a component. That separation is what lets a fourth
 * input mode be added later by only touching this file's handlers plus a
 * new parser — src/engine/discountEngine.js never changes.
 */

import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import PdfUploader from './components/PdfUploader.jsx'
import NLRuleInput from './components/NLRuleInput.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { parseRulesCSV, parseCartCSV } from './parsers/csvParser.js'
import { runEngine } from './engine/discountEngine.js'

// ── Column definitions ───────────────────────────────────────────

const RULES_COLUMNS = [
  { key: 'ruleId',    label: 'Rule ID' },
  { key: 'scope',     label: 'Scope',      render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To', render: (v, row) => v || (row.scope === 'cart' ? 'Entire cart' : '—') },
  { key: 'type',      label: 'Type',       render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) => row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  { key: 'stackable', label: 'Stackable',  render: (v) => (v ? 'Yes' : 'No') },
  {
    key: 'minCartValue',
    label: 'Min Cart Value',
    render: (v, row) => (row.scope === 'cart' && v != null ? `Rs.${v.toLocaleString('en-IN')}` : '—'),
  },
]

const CART_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'brand',     label: 'Brand' },
  { key: 'platform',  label: 'Platform' },
  { key: 'basePrice', label: 'Base Price', render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
]

const RESULTS_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'basePrice', label: 'Base Price',  render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
  { key: 'finalPrice',label: 'Final Price',
    render: (v, row) => (
      <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>Rs.{v.toLocaleString('en-IN')}</span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span style={{ color: v === 'No offers available' ? '#888' : '#131A48', fontStyle: v === 'No offers available' ? 'italic' : 'normal' }}>
        {v}
      </span>
    ),
  },
]

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page:    { minHeight: '100vh', background: '#f7f7f9', fontFamily: 'Arial, sans-serif' },
  header:  { background: '#131A48', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan:{ color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main:    { maxWidth: 980, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 6, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  subLabel: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.9rem 0 0.4rem' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn:     {
    background: '#FF5800', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 13, color: '#131A48', padding: '0.35rem 0',
  },
  cartOfferRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 13, color: '#1e5c2c', fontWeight: 700, padding: '0.35rem 0',
    background: '#f0faf2', borderRadius: 4, paddingLeft: 8, paddingRight: 8,
  },
  nearMissRow: {
    fontSize: 12, color: '#8a4a10', background: '#fff7ec', border: '1px solid #f0c987',
    borderRadius: 4, padding: '0.45rem 0.7rem', marginTop: '0.4rem',
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '1rem', marginTop: '0.6rem', paddingTop: '0.6rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
}

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules]           = useState([])
  const [rulesErrors, setRulesErr]  = useState([])
  const [rulesFileName, setRulesFileName] = useState('')
  const [nlRuleCount, setNlRuleCount] = useState(0)

  const [cartItems, setCartItems]   = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartWarnings, setCartWarnings] = useState([])
  const [cartFileName, setCartFileName]   = useState('')

  const [result, setResult] = useState(null)

  // ── Handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setResult(null) // clear stale results
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartWarnings([])
    setCartFileName(fileName)
    setResult(null)
  }

  function handlePdfCartExtracted({ data, errors, warnings, fileName }) {
    setCartItems(data)
    setCartErrors(errors)
    setCartWarnings(warnings)
    setCartFileName(fileName)
    setResult(null)
    // Re-run automatically against the existing active rules, per spec —
    // but only if we actually got usable items and rules are already loaded.
    if (data.length > 0 && rules.length > 0) {
      setResult(runEngine(data, rules))
    }
  }

function handleRuleConfirmed(newRuleCore) {
  const nextIndex = nlRuleCount + 1
  const ruleId = `NL-${String(nextIndex).padStart(3, '0')}`
  const newRule = { ...newRuleCore, ruleId }

  const updatedRules = [...rules, newRule]
  setRules(updatedRules)
  setNlRuleCount(nextIndex)
  // Re-run the engine on the current cart with the new rule included, per spec.
  if (cartItems.length > 0) {
    setResult(runEngine(cartItems, updatedRules))
  }
}

  function handleCalculate() {
    setResult(runEngine(cartItems, rules))
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>

        {/* Upload row */}
        <div style={S.grid2}>
          {/* Rules input */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
            />
            <ErrorBanner errors={rulesErrors} />

            <div style={S.subLabel}>Or describe a rule in plain English</div>
            <NLRuleInput onRuleConfirmed={handleRuleConfirmed} nextRuleNumber={nlRuleCount + 1} />

            {rules.length > 0 && (
              <div style={{ marginTop: '0.9rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
          </div>

          {/* Cart input */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartLoad}
              hasData={cartItems.length > 0}
              fileName={cartFileName}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <PdfUploader onCartExtracted={handlePdfCartExtracted} />
            </div>
            <ErrorBanner errors={cartErrors} />
            <ErrorBanner errors={cartWarnings} variant="warning" />

            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                  {cartFileName ? ` — ${cartFileName}` : ''}
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Load both rules and a cart to calculate
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Summary</div>
            <DataTable columns={RESULTS_COLUMNS} rows={result.itemResults} />

            <div style={{ marginTop: '0.9rem' }}>
              <div style={S.summaryRow}>
                <span>Subtotal (after item offers)</span>
                <span>Rs.{result.subtotal.toLocaleString('en-IN')}</span>
              </div>

              {result.cartOfferRule && (
                <div style={S.cartOfferRow}>
                  <span>
                    Cart offer: {result.cartOfferRule.value}% off ({result.cartOfferRule.ruleId})
                  </span>
                  <span>Rs.{result.cartDiscount.toLocaleString('en-IN')} saved</span>
                </div>
              )}

              {result.nearMiss && (
                <div style={S.nearMissRow}>
                  Add Rs.{(result.nearMiss.minCartValue - result.subtotal).toLocaleString('en-IN')} more to unlock{' '}
                  {result.nearMiss.value}% off your entire cart ({result.nearMiss.ruleId}).
                </div>
              )}

              <div style={S.totalRow}>
                <span style={S.totalLabel}>Final Cart Total</span>
                <span style={S.totalValue}>Rs.{result.finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
