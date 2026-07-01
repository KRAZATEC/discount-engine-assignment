/**
 * PdfUploader.jsx
 *
 * Upload area for a cart PDF. On selection, hands the file to pdfParser.js
 * and reports back the extracted CartItem[] (which replaces the current
 * cart) plus any errors/warnings from rows that couldn't be parsed.
 */

import { useRef, useState } from 'react'
import { parseCartPDF } from '../parsers/pdfParser.js'

export default function PdfUploader({ onCartExtracted }) {
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    e.target.value = '' // allow re-uploading the same file
    if (!file) return

    setLoading(true)
    try {
      const { data, errors, warnings } = await parseCartPDF(file)
      onCartExtracted({ data, errors, warnings, fileName: file.name })
    } catch (err) {
      onCartExtracted({ data: [], errors: [err.message], warnings: [], fileName: file.name })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: '2px dashed #CECECE',
        borderRadius: 6,
        padding: '0.85rem 1.2rem',
        background: '#fafafa',
        cursor: loading ? 'wait' : 'pointer',
      }}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: 20 }}>{loading ? '⏳' : '📑'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#131A48' }}>Cart PDF</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {loading ? 'Extracting items with Groq…' : 'Upload a cart PDF — replaces the current cart'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FF5800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Upload
          </span>
        </div>
      </div>
    </div>
  )
}
