import { useState } from 'react'
import { parseRuleFromText, validateParsedRule, toDiscountRule } from '../parsers/nlParser.js'

const EXAMPLES = [
  '20% off for Natura Casa brand, stackable with other offers',
  'Rs.100 flat discount on all Amazon India items',
  '10% off if cart value is more than Rs.5000',
]

const S = {
  wrap: { marginTop: 8 },
  textarea: {
    width: '100%',
    minHeight: 88,
    resize: 'vertical',
    border: '1px solid #CECECE',
    borderRadius: 6,
    padding: '0.7rem 0.8rem',
    fontSize: 13,
    fontFamily: 'Arial, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  },
  row: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  btn: {
    background: '#131A48',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.55rem 0.9rem',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.55rem 0.9rem',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'not-allowed',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  hint: { fontSize: 11, color: '#777' },
  errorBox: {
    marginTop: 10,
    background: '#fff4f4',
    border: '1px solid #e3b7b7',
    color: '#7d1e1e',
    borderRadius: 6,
    padding: '0.7rem 0.8rem',
    fontSize: 12,
  },
  confirmBox: {
    marginTop: 10,
    background: '#f8fbff',
    border: '1px solid #cfe0f5',
    borderRadius: 6,
    padding: '0.85rem',
  },
  confirmTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: '#131A48',
    marginBottom: 8,
  },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: 10 },
  tdLabel: {
    width: 120,
    fontSize: 12,
    color: '#666',
    padding: '4px 0',
    verticalAlign: 'top',
  },
  tdVal: {
    fontSize: 12,
    color: '#131A48',
    padding: '4px 0',
    fontWeight: 600,
  },
  btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  confirmBtn: {
    background: '#1e5c2c',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.55rem 0.85rem',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  discardBtn: {
    background: '#fff',
    color: '#131A48',
    border: '1px solid #CECECE',
    borderRadius: 4,
    padding: '0.55rem 0.85rem',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
}

export default function NLRuleInput({ onRuleConfirmed, nextRuleNumber }) {
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [parsedRule, setParsedRule] = useState(null)

  async function handleParse() {
    try {
      setLoading(true)
      setErrors([])
      setParsedRule(null)

      const parsed = await parseRuleFromText(inputText)
      const validation = validateParsedRule(parsed)

      if (!validation.isValid) {
        setErrors(validation.errors)
        return
      }

      setParsedRule(parsed)
    } catch (err) {
      setErrors([err.message || 'Failed to parse rule.'])
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    const rule = toDiscountRule(parsedRule, `NL-${String(nextRuleNumber).padStart(3, '0')}`)

    onRuleConfirmed({
      scope: rule.scope,
      appliesTo: rule.appliesTo,
      type: rule.type,
      value: rule.value,
      stackable: rule.stackable,
      minCartValue: rule.minCartValue,
    })

    setParsedRule(null)
    setInputText('')
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
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {parsedRule && (
        <div style={S.confirmBox}>
          <div style={S.confirmTitle}>Confirm parsed rule</div>
          <table style={S.table}>
            <tbody>
              <tr>
                <td style={S.tdLabel}>Scope</td>
                <td style={S.tdVal}>{parsedRule.scope}</td>
              </tr>
              <tr>
                <td style={S.tdLabel}>Applies to</td>
                <td style={S.tdVal}>{parsedRule.applies_to || '(entire cart)'}</td>
              </tr>
              <tr>
                <td style={S.tdLabel}>Type</td>
                <td style={S.tdVal}>{parsedRule.type}</td>
              </tr>
              <tr>
                <td style={S.tdLabel}>Value</td>
                <td style={S.tdVal}>
                  {parsedRule.type === 'percentage'
                    ? `${parsedRule.value}%`
                    : `Rs.${parsedRule.value}`}
                </td>
              </tr>
              <tr>
                <td style={S.tdLabel}>Stackable</td>
                <td style={S.tdVal}>{parsedRule.stackable ? 'Yes' : 'No'}</td>
              </tr>
              {parsedRule.scope === 'cart' && (
                <tr>
                  <td style={S.tdLabel}>Min cart value</td>
                  <td style={S.tdVal}>
                    {parsedRule.min_cart_value != null
                      ? `Rs.${parsedRule.min_cart_value}`
                      : 'None'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={S.btnRow}>
            <button style={S.confirmBtn} onClick={handleConfirm}>
              Confirm and add rule
            </button>
            <button style={S.discardBtn} onClick={handleDiscard}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
