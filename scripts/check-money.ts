import { sellPriceFromCost, costToPaisa, depositFor, balanceOf, maxCostFen,
         formatPkr, formatCny, formatPkrRange } from "../src/lib/money";

const S = { cnyToPkr: 41.37, markup: 2.0, depositPercent: 30 };
let bad = 0;
const ok = (label: string, got: unknown, want: unknown) => {
  const pass = String(got) === String(want);
  if (!pass) bad++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${label.padEnd(44)} got ${got}  want ${want}`);
};

console.log("=== sell price: the x2 rule on the real key cover ===");
ok("¥28 shell only",          formatPkr(sellPriceFromCost(2800, S)), "Rs 2,317");
ok("¥32 round buckle",        formatPkr(sellPriceFromCost(3200, S)), "Rs 2,648");
ok("¥33 leather strap",       formatPkr(sellPriceFromCost(3300, S)), "Rs 2,730");
ok("¥135 watch (other item)", formatPkr(sellPriceFromCost(13500, S)), "Rs 11,170");

console.log("\n=== our cost, before markup ===");
ok("¥28 costs us",            formatPkr(costToPaisa(2800, S.cnyToPkr)), "Rs 1,158");
ok("¥33 costs us",            formatPkr(costToPaisa(3300, S.cnyToPkr)), "Rs 1,365");

console.log("\n=== deposits at 30% ===");
ok("deposit on Rs 2,317",     formatPkr(depositFor(231700, 30)), "Rs 695");
ok("deposit on Rs 2,730",     formatPkr(depositFor(273000, 30)), "Rs 819");

console.log("\n=== balance ===");
ok("2,730 total, 819 paid",   formatPkr(balanceOf(273000, 81900)), "Rs 1,911");
ok("overpayment floors at 0", formatPkr(balanceOf(273000, 300000)), "Rs 0");

console.log("\n=== buy targets (market / 2) ===");
ok("TPE floor mats Rs 9,499", formatCny(maxCostFen(949900, S)), "¥114.80");
ok("key cover Rs 2,999",      formatCny(maxCostFen(299900, S)), "¥36.24");

console.log("\n=== rounding ===");
const raw = (2850 / 100) * S.cnyToPkr * S.markup;   // 23.58... -> must round UP
ok("¥28.50 -> nearest rupee", formatPkr(sellPriceFromCost(2850, S)), "Rs 2,358");
console.log(`       (unrounded was ${raw.toFixed(4)})`);

console.log("\n=== formatting ===");
ok("range collapses when flat", formatPkrRange(231700, 231700), "Rs 2,317");
ok("range renders",             formatPkrRange(231700, 273000), "Rs 2,317 – Rs 2,730");

console.log(`\n${bad === 0 ? "ALL PASS" : bad + " FAILURES"}`);
process.exit(bad === 0 ? 0 : 1);
