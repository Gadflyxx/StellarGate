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

/**
 * Build a SEP-7 `web+stellar:pay` URI for a payment intent.
 *
 * The URI encodes the destination, memo, amount and asset so a SEP-7-capable
 * wallet can prefill a payment directly from a QR code scan or a tap.
 *
 * Native XLM uses no asset_code/asset_issuer parameters; issued assets use
 * both so the wallet can verify the exact token. All values are percent-encoded
 * so memo text containing spaces, commas or special characters round-trips
 * correctly. Memo type is always MEMO_TEXT to match how the gateway generates
 * and matches memos (see `generate_unique_memo` in the backend).
 *
 * @param {object} payment  A payment record from the API.
 * @returns {string}        The full web+stellar:pay URI.
 */
export function buildSep7Uri(payment) {
  var p = payment || {};
  var params = [];
  if (p.destination_address) {
    params.push("destination=" + encodeURIComponent(p.destination_address));
  }
  if (p.amount) {
    // Strip trailing zeros the same way formatAmount does, so "10.0000000"
    // becomes "10" in the URI — wallets display this value to the user.
    var n = Number(p.amount);
    var amtStr = isFinite(n)
      ? n.toFixed(7).replace(/\.?0+$/, "")
      : String(p.amount);
    params.push("amount=" + encodeURIComponent(amtStr));
  }
  var asset = String(p.asset || "XLM").toUpperCase();
  if (asset !== "XLM") {
    // Issued asset: asset_code + asset_issuer required.
    params.push("asset_code=" + encodeURIComponent(asset));
    if (p.asset_issuer) {
      params.push("asset_issuer=" + encodeURIComponent(p.asset_issuer));
    }
  }
  if (p.memo) {
    params.push("memo=" + encodeURIComponent(p.memo));
    params.push("memo_type=MEMO_TEXT");
  }
  return "web+stellar:pay?" + params.join("&");
}

/**
 * Case-insensitive filter over the rows already loaded, matching a query against
 * the memo and the payment id.
 *
 * This is deliberately client-side: it narrows what the operator can currently
 * see without another round trip, and it is what the `/` shortcut focuses.
 */
export function filterPayments(payments, query) {
  var q = String(query || "").trim().toLowerCase();
  if (!q) return payments || [];
  return (payments || []).filter(function (p) {
    return (
      String(p && p.memo ? p.memo : "")
        .toLowerCase()
        .indexOf(q) >= 0 ||
      String(p && p.id ? p.id : "")
        .toLowerCase()
        .indexOf(q) >= 0
    );
  });
}
