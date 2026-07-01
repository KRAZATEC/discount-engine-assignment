import { runEngine } from './src/engine/discountEngine.js'
import { parseRulesCSV, parseCartCSV } from './src/parsers/csvParser.js'
import fs from 'fs'

console.log('============ SCENARIO 1: Original Assignment ============')
const r1CSV = fs.readFileSync('./sample-data/rules.csv', 'utf-8')
const c1CSV = fs.readFileSync('./sample-data/cart.csv', 'utf-8')
const { data: r1 } = parseRulesCSV(r1CSV)
const { data: c1 } = parseCartCSV(c1CSV)
const result1 = runEngine(c1, r1)
console.log('Final cart total:', result1.finalTotal, '(expected: 5339)')
result1.itemResults.forEach(r => {
  console.log(`  ${r.itemId}: Rs.${r.finalPrice} (save Rs.${r.totalDiscount})`)
})

console.log('\n============ SCENARIO 2: Aggressive Brands ============')
const r2CSV = fs.readFileSync('./sample-data/rules-aggressive-brands.csv', 'utf-8')
const c2CSV = fs.readFileSync('./sample-data/cart-electronics.csv', 'utf-8')
const { data: r2 } = parseRulesCSV(r2CSV)
const { data: c2 } = parseCartCSV(c2CSV)
const result2 = runEngine(c2, r2)
console.log('Final cart total:', result2.finalTotal, '(expected: ~175,152)')
console.log('Cart subtotal:', result2.subtotal)
result2.itemResults.forEach(r => {
  console.log(`  ${r.itemId}: Rs.${r.finalPrice} (save Rs.${r.totalDiscount})`)
})

console.log('\n============ SCENARIO 3: Heavy Stackable ============')
const r3CSV = fs.readFileSync('./sample-data/rules-stackable-heavy.csv', 'utf-8')
const c3CSV = fs.readFileSync('./sample-data/cart-appliances.csv', 'utf-8')
const { data: r3 } = parseRulesCSV(r3CSV)
const { data: c3 } = parseCartCSV(c3CSV)
const result3 = runEngine(c3, r3)
console.log('Final cart total:', result3.finalTotal, '(expected: ~179,478)')
console.log('Cart subtotal:', result3.subtotal)
console.log('Cart discount:', result3.cartDiscount)
result3.itemResults.forEach(r => {
  console.log(`  ${r.itemId}: Rs.${r.finalPrice} (save Rs.${r.totalDiscount}) - ${r.reasoning}`)
})
