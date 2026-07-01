/**
 * NLRuleInput.jsx
 *
 * Text field where a user describes a discount rule in plain English.
 * Groq parses it into a structured rule; the parsed fields are shown in a
 * confirmation step before the rule is added anywhere. Ambiguous input
 * surfaces a specific, actionable error instead of a partial/guessed rule.
 */

import { useState } from 'react'
import { parseRuleFromText, validateParsedRule, toDiscountRule } from '../parsers/nlParser.js'

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  textarea: {
    width: '100%', minHeight: 64, padding: '0.6rem 0.75rem', fontSize: 13,
    fontFamily: 'Arial, sans-serif', border: '1px solid #CECECE', borderRadius: 4,
    resize: 'vertical', boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  btn: {
    background: '#131A48', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.5rem 1.1rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.03em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.5rem 1.1rem', fontSize: 12, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.03em', textTransform: 'uppercase',
  },
  errorBox: {
    background: '#fce8e8', border: '1px solid #e57373', borderLeft: '3px solid #c0392b',
    borderRadius: 4, padding: '0.6rem 0.9rem', fontSize: 12, color: '#5a1010',
  },
  confirmBox: {
    background: '#fff7ec', border: '1px solid #f0c987', borderLeft: '3px solid #FF5800',
    borderRadius: 4, padding: '0.75rem 0.9rem',
  },
  confirmTitle: { fontWeight: 700, fontSize: 12, color: '#131A48', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' },
  table: { width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 8 },
  tdLabel: { padding: '3px 0', color: '#888', width: '40%' },
  tdVal: { padding: '3px 0', color: '#131A48', fontWeight: 600 },
  confirmActions: { display: 'flex', gap: '0.5rem' },
  btnConfirm: {
    background: '#1e5c2c', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.45rem 1rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  btnDiscard: {
    background: '#fff', color: '#8a1a1a', border: '1px solid #e57373', borderRadius: 4,
    padding: '0.45rem 1rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  hint: { fontSize: 11, color: '#888' },
}

const EXAMPLES = [
  '20% off for Natura Casa brand, stackable with other offers',
  'Rs.100 flat discount on all Flipkart items',
  '10% off if cart value is more than Rs.5,000',
]

export default function NLRuleInput({ onRuleConfirmed, nextRuleNumber }) {
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [parsedRule, setParsedRule] = useState(null)

  async function handleParse() {
    if (!inputText.trim() || loading) return
    setLoading(true)
    setErrors([])
    setParsedRule(null)

    try {
      const parsed = await parseRuleFromText(inputText)
      const { isValid, errors: validationErrors } = validateParsedRule(parsed)
      if (!isValid) {
        setErrors(validationErrors)
      } else {
        setParsedRule(parsed)
      }
    } catch (err) {
      setErrors([err.message])
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!parsedRule) return
    // App.jsx will assign the ruleId and call toDiscountRule — ID generation
    // is centralized in App.jsx to keep NL rule IDs in a single source of truth.
    onRuleConfirmed(parsedRule)
    setInputText('')
    setParsedRule(null)
    setErrors([])
  }

  function handleDiscard() {
    setParsedRule(null)
  }

  return (
    <div style={S.wrap}>
      <textarea
        style={S.textarea}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={`e.g. "${EXAMPLES[0]}"`}
        disabled={loading}
      />
      <div style={S.row}>
        <button
          style={inputText.trim() && !loading ? S.btn : S.btnDisabled}
          onClick={handleParse}
          disabled={!inputText.trim() || loading}
        >
          {loading ? 'Parsing…' : 'Parse Rule'}
        </button>
        <span style={S.hint}>Parsed by Groq — you'll confirm before it's added</span>
      </div>

      {errors.length > 0 && (
        <div style={S.errorBox}>
          <strong>Could not use this rule:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {errors.map((e, i) => >{e}</li>)}
          </ul>
        </div>
      )}

      {parsedRule && (
        <div style={S.confirmBox}>
          <div style={S.confirmTitle}>Confirm parsed rule</div>
          <table style={S.table}>
            <tbody>
              <tr><td style={S.tdLabel}>Scope</td><td style={S.tdVal}>{parsedRule.scope}</td></tr>
              <tr>
                <td style={S.tdLabel}>Applies to</td>
                <td style={S.tdVal}>{parsedRule.applies_to || '(entire cart)'}</td>
              </tr>
              <tr><td style={S.tdLabel}>Type</td><td style={S.tdVal}>{parsedRule.type}</td></tr>
              <tr>
                <td style={S.tdLabel}>Value</td>
                <td style={S.tdVal}>
                  {parsedRule.type === 'percentage' ? `${parsedRule.value}%` : `Rs.${parsedRule.value}`}
                </td>
              </tr>
              <tr><td style={S.tdLabel}>Stackable</td><td style={S.tdVal}>{parsedRule.stackable ? 'Yes' : 'No'}</td></tr>
              {parsedRule.scope === 'cart' && (
                <tr>
                  <td style={S.tdLabel}>Min cart value</td>
                  <td style={S.tdVal}>
                    {parsedRule.min_cart_value != null ? `Rs.${parsedRule.min_cart_value}` : '(none — always eligible)'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={S.confirmActions}>
            <button style={S.btnConfirm} onClick={handleConfirm}>✓ Add this rule</button>
            <button style={S.btnDiscard} onClick={handleDiscard}>✗ Discard</button>
          </div>
        </div>
      )}
    </div>
  )
}
