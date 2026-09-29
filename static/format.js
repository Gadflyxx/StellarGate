/* Pure formatting helpers for the StellarGate dashboard.
 *
 * This module is deliberately DOM-free: every function here is a pure
 * transformation of its arguments, so the whole file can be exercised under
 * `node --test` without a browser (issue #677). The dashboard controller in
 * `dashboard.js` imports these helpers rather than defining them inline.
 */

/** Map a payment or delivery status onto a pill style. */
export function pillClass(status) {
  switch (status) {
    case "completed":
    case "delivered":
      return "pill pill-ok";
    case "pending":
    case "underpaid":
      return "pill pill-warn";
    case "expired":
    case "failed":
      return "pill pill-err";
    default:
      return "pill pill-idle";
  }
}

/** Format a payment amount with its asset code. */
export function formatAmount(amount, asset) {
  if (!amount) return "—";
  return amount + " " + (asset || "XLM");
}

/** Return a Stellar expert explorer URL for a transaction hash. */
export function explorerTx(hash) {
  return "https://stellar.expert/explorer/public/tx/" + encodeURIComponent(hash);
}

/** Human-readable relative time (e.g. "2 min ago", "just now"). */
export function relativeTime(iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  var diffMs = Date.now() - d.getTime();
  var diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return diffSec + "s ago";
  var diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return diffMin + " min ago";
  var diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return diffHr + "h ago";
  return Math.round(diffHr / 24) + "d ago";
}

/** Human-readable countdown to an ISO timestamp (e.g. "5m 32s"). */
export function countdown(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  var diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "expired";
  var totalSec = Math.floor(diffMs / 1000);
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m " + s + "s";
  return s + "s";
}

/** Format an ISO timestamp for display, falling back to the raw value. */
export function fmtTime(iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** Shorten an identifier (payment id, tx hash) for compact display. */
export function shortId(id) {
  if (!id) return "—";
  var s = String(id);
  if (s.length <= 12) return s;
  return s.slice(0, 6) + "…" + s.slice(-4);
}
