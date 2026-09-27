/* StellarGate dashboard.
 *
 * A thin client over the same public REST API documented in the README: it
 * holds no privileged session of its own and adds no server-side state. The
 * merchant's API key lives in the browser and is sent as a bearer token.
 *
 * Every value that originates from the API is written with textContent (or
 * via el()//setText below), never innerHTML. `webhook_url`, `memo` and the
 * event name are merchant-controlled, so interpolating them as markup would
 * be a stored-XSS vector.
 */

(function () {
  "use strict";

  var API_BASE = "/v1";
  var PAGE_SIZE = 25;
  var KEY_NAME = "stellargate.apiKey";

  var state = {
    key: null,
    status: "",
    cursor: null,
    loading: false,
  };

  // ── Tiny DOM helpers ──────────────────────────────────────────────────

  function $(id) {
    return document.getElementById(id);
  }

  /** Create an element with a class and *text* content (never markup). */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function show(node, visible) {
    node.hidden = !visible;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setError(node, message) {
    if (message) {
      node.textContent = message;
      show(node, true);
    } else {
      node.textContent = "";
      show(node, false);
    }
  }

  // ── Formatting ────────────────────────────────────────────────────────

  function fmtTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  function shortId(id) {
    return typeof id === "string" && id.length > 12 ? id.slice(0, 8) + "…" : id;
  }

  /** Map a payment or delivery status onto a pill style. */
  function pillClass(status) {
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

  // ── API ───────────────────────────────────────────────────────────────

  /**
   * Call the gateway. Resolves with the parsed body, or rejects with an Error
   * carrying the API's `error` message when one is present. A 401 drops the
   * stored key and returns to the sign-in gate, since it means the key was
   * revoked or is wrong.
   */
  function api(path, options) {
    var opts = options || {};
    var headers = { Accept: "application/json" };
    if (state.key) headers.Authorization = "Bearer " + state.key;
    if (opts.body) headers["Content-Type"] = "application/json";

    return fetch(API_BASE + path, { method: opts.method || "GET", headers: headers, body: opts.body || undefined }).then(
      function (res) {
        if (res.status === 401) {
          signOut("That API key was rejected. Please sign in again.");
          throw new Error("unauthorized");
        }
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            if (!res.ok) {
              throw new Error(body.error || "Request failed (" + res.status + ")");
            }
            return body;
          });
      }
    );
  }

  // ── Session ───────────────────────────────────────────────────────────

  function storedKey() {
    try {
      return (
        window.sessionStorage.getItem(KEY_NAME) ||
        window.localStorage.getItem(KEY_NAME)
      );
    } catch (e) {
      return null; // storage blocked; fall back to in-memory only
    }
  }

  function storeKey(key, persist) {
    try {
      (persist ? window.localStorage : window.sessionStorage).setItem(
        KEY_NAME,
        key
      );
    } catch (e) {
      /* non-fatal: the key still works for this page load */
    }
  }

  function forgetKey() {
    try {
      window.sessionStorage.removeItem(KEY_NAME);
      window.localStorage.removeItem(KEY_NAME);
    } catch (e) {
      /* nothing to do */
    }
  }

  /** Return to the sign-in form, keeping any stored key so a reload retries. */
  function showGate(message) {
    state.key = null;
    closeDetail();
    show($("app"), false);
    show($("gate"), true);
    setError($("gate-error"), message || null);
  }

  /** Return to the sign-in form AND discard the stored key.
   *
   * Only for cases where the key itself is the problem (a 401, or an explicit
   * sign-out). A transient failure must use showGate() instead: discarding a
   * perfectly good key because the network blinked forces the user to dig it
   * out again. */
  function signOut(message) {
    forgetKey();
    showGate(message);
  }

  function signIn(key, persist) {
    state.key = key;
    // Validate by making the cheapest authenticated call available.
    return api("/payments?limit=1").then(function () {
      if (persist !== null) storeKey(key, persist);
      show($("gate"), false);
      show($("app"), true);
      setError($("gate-error"), null);
      loadVersion();
      pollHealth();
      reload();
    });
  }

  // ── Payments list ─────────────────────────────────────────────────────

  function reload() {
    state.cursor = null;
    clear($("rows"));
    loadPayments();
  }

  function loadPayments() {
    if (state.loading) return;
    state.loading = true;
    setError($("list-error"), null);

    var query = "/payments?limit=" + PAGE_SIZE;
    if (state.status) query += "&status=" + encodeURIComponent(state.status);
    if (state.cursor) query += "&cursor=" + encodeURIComponent(state.cursor);

    api(query)
      .then(function (body) {
        var payments = body.payments || [];
        payments.forEach(appendRow);

        // The offset-mode response returns a cursor even on the final page, so
        // a short page is what actually signals the end.
        var more = payments.length === PAGE_SIZE && !!body.next_cursor;
        state.cursor = more ? body.next_cursor : null;
        show($("load-more"), more);
        show($("empty"), $("rows").childElementCount === 0);
      })
      .catch(function (err) {
        if (err.message !== "unauthorized") setError($("list-error"), err.message);
      })
      .then(function () {
        state.loading = false;
      });
  }

  function appendRow(p) {
    var tr = document.createElement("tr");
    tr.tabIndex = 0;

    var statusCell = document.createElement("td");
    statusCell.appendChild(el("span", pillClass(p.status), p.status));
    tr.appendChild(statusCell);

    tr.appendChild(el("td", null, p.amount + " " + p.asset));
    tr.appendChild(el("td", "mono", p.memo));
    tr.appendChild(el("td", null, fmtTime(p.created_at)));
    tr.appendChild(el("td", "mono", shortId(p.id)));

    tr.addEventListener("click", function () {
      openDetail(p.id);
    });
    tr.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openDetail(p.id);
      }
    });

    $("rows").appendChild(tr);
  }

  // ── Detail panel ──────────────────────────────────────────────────────

  function openDetail(id) {
    show($("detail"), true);
    show($("scrim"), true);

    var fields = $("detail-fields");
    clear(fields);
    clear($("deliveries"));
    setError($("deliveries-error"), null);
    show($("deliveries-empty"), false);

    api("/payments/" + encodeURIComponent(id))
      .then(function (p) {
        [
          ["Status", p.status],
          ["Amount", p.amount + " " + p.asset],
          ["Received", p.paid_amount ? p.paid_amount + " " + p.asset : "—"],
          ["Memo", p.memo],
          ["Destination", p.destination_address],
          ["Transaction", p.tx_hash || "—"],
          ["Payment ID", p.id],
          ["Merchant", p.merchant_id],
          ["Created", fmtTime(p.created_at)],
          ["Updated", fmtTime(p.updated_at)],
          ["Expires", fmtTime(p.expires_at)],
        ].forEach(function (pair) {
          fields.appendChild(el("dt", null, pair[0]));
          if (pair[0] === "Status") {
            var dd = document.createElement("dd");
            dd.appendChild(el("span", pillClass(p.status), p.status));
            fields.appendChild(dd);
          } else {
            fields.appendChild(el("dd", "mono", pair[1]));
          }
        });
      })
      .catch(function (err) {
        if (err.message !== "unauthorized") {
          fields.appendChild(el("dd", "error", err.message));
        }
      });

    loadDeliveries(id);
  }

  function loadDeliveries(paymentId) {
    api("/payments/" + encodeURIComponent(paymentId) + "/webhooks")
      .then(function (body) {
        var list = $("deliveries");
        clear(list);
        var deliveries = body.deliveries || [];
        show($("deliveries-empty"), deliveries.length === 0);
        deliveries.forEach(function (d) {
          list.appendChild(deliveryItem(paymentId, d));
        });
      })
      .catch(function (err) {
        if (err.message !== "unauthorized") {
          setError($("deliveries-error"), err.message);
        }
      });
  }

  function deliveryItem(paymentId, d) {
    var li = el("li", "delivery");

    var head = el("div", "delivery-head");
    head.appendChild(el("strong", null, d.event || "webhook"));
    head.appendChild(el("span", pillClass(d.status), d.status));
    li.appendChild(head);

    li.appendChild(el("div", "mono", d.url));
    li.appendChild(
      el(
        "div",
        "delivery-meta",
        "attempt " + d.attempts + " · last " + fmtTime(d.last_attempt)
      )
    );

    var button = el("button", "ghost", "Redeliver");
    button.addEventListener("click", function () {
      button.disabled = true;
      button.textContent = "Sending…";
      api(
        "/payments/" +
          encodeURIComponent(paymentId) +
          "/webhooks/" +
          encodeURIComponent(d.id) +
          "/redeliver",
        { method: "POST" }
      )
        .then(function () {
          loadDeliveries(paymentId);
        })
        .catch(function (err) {
          button.disabled = false;
          button.textContent = "Redeliver";
          if (err.message !== "unauthorized") {
            setError($("deliveries-error"), err.message);
          }
        });
    });
    li.appendChild(button);

    return li;
  }

  function closeDetail() {
    show($("detail"), false);
    show($("scrim"), false);
  }

  // ── Version ───────────────────────────────────────────────────────────

  /** The root route answers with "StellarGate API vX.Y.Z". */
  function loadVersion() {
    fetch("/")
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        var match = /v\d+\.\d+\.\d+/.exec(text);
        if (match) $("version").textContent = match[0];
      })
      .catch(function () {
        /* cosmetic only */
      });
  }

  // ── Health ────────────────────────────────────────────────────────────

  function pollHealth() {
    fetch("/ready", { headers: { Accept: "application/json" } })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (r) {
        var pill = $("health");
        pill.className = r.ok ? "pill pill-ok" : "pill pill-err";
        pill.textContent = r.ok ? "healthy" : r.body.reason || "unavailable";
      })
      .catch(function () {
        var pill = $("health");
        pill.className = "pill pill-err";
        pill.textContent = "unreachable";
      });
  }

  // ── New-payment dialog (#758 / #759) ─────────────────────────────────

  /** Validate amount: positive, ≤7 decimals, no exponent notation. */
  function validateAmount(val) {
    if (!val) return "Amount is required.";
    if (/[eE]/.test(val)) return "Exponent notation is not allowed.";
    if (!/^\d+(\.\d+)?$/.test(val)) return "Enter a positive number.";
    var parts = val.split(".");
    if (parts[1] && parts[1].length > 7) return "At most 7 decimal places allowed.";
    if (parseFloat(val) <= 0) return "Amount must be greater than zero.";
    return null;
  }

  /** Validate webhook_url: must be absent or an absolute https:// URL. */
  function validateWebhook(val) {
    if (!val) return null; // optional
    if (!/^https:\/\/.+/i.test(val)) return "Webhook URL must start with https://.";
    try {
      var u = new URL(val);
      if (u.protocol !== "https:") return "Webhook URL must use https://.";
    } catch (e) {
      return "Enter a valid absolute URL.";
    }
    return null;
  }

  function setFieldError(inputEl, errEl, message) {
    if (message) {
      inputEl.setAttribute("aria-invalid", "true");
      errEl.textContent = message;
      show(errEl, true);
    } else {
      inputEl.removeAttribute("aria-invalid");
      errEl.textContent = "";
      show(errEl, false);
    }
  }

  function resetDialog() {
    $("payment-form").reset();
    setFieldError($("p-amount"), $("p-amount-err"), null);
    setFieldError($("p-asset"), $("p-asset-err"), null);
    setFieldError($("p-webhook"), $("p-webhook-err"), null);
    setError($("p-form-err"), null);
    $("dialog-submit").disabled = false;
    $("dialog-submit").textContent = "Create";
  }

  function openPaymentDialog() {
    resetDialog();
    $("payment-dialog").showModal();
    $("p-amount").focus();
  }

  function closePaymentDialog() {
    $("payment-dialog").close();
  }

  /** Map a 400 API error code to the right field error element pair. */
  var FIELD_ERROR_MAP = {
    invalid_amount:       { input: "p-amount",  err: "p-amount-err"  },
    amount_out_of_range:  { input: "p-amount",  err: "p-amount-err"  },
    invalid_asset:        { input: "p-asset",   err: "p-asset-err"   },
    invalid_webhook_url:  { input: "p-webhook", err: "p-webhook-err" },
  };

  function submitPayment(ev) {
    ev.preventDefault();

    var amountVal  = $("p-amount").value.trim();
    var assetVal   = $("p-asset").value.trim();
    var webhookVal = $("p-webhook").value.trim();

    // Client-side validation (#759)
    var amountErr  = validateAmount(amountVal);
    var assetErr   = assetVal ? null : "Asset is required.";
    var webhookErr = validateWebhook(webhookVal);

    setFieldError($("p-amount"),  $("p-amount-err"),  amountErr);
    setFieldError($("p-asset"),   $("p-asset-err"),   assetErr);
    setFieldError($("p-webhook"), $("p-webhook-err"), webhookErr);

    if (amountErr || assetErr || webhookErr) {
      // Focus the first invalid field
      if (amountErr)       { $("p-amount").focus(); }
      else if (assetErr)   { $("p-asset").focus(); }
      else                 { $("p-webhook").focus(); }
      return;
    }

    $("dialog-submit").disabled = true;
    $("dialog-submit").textContent = "Creating…";
    setError($("p-form-err"), null);

    var body = { amount: amountVal, asset: assetVal };
    if (webhookVal) body.webhook_url = webhookVal;

    // Use the versioned api() helper so all requests stay under API_BASE (#758)
    api("/payments", { method: "POST", body: JSON.stringify(body) })
      .then(function (payment) {
        closePaymentDialog();
        // Insert the new payment at the top of the list (#758)
        var firstRow = $("rows").firstChild;
        appendRow(payment);
        var appended = $("rows").lastChild;
        $("rows").insertBefore(appended, firstRow || null);
        show($("empty"), false);
      })
      .catch(function (err) {
        if (err.message !== "unauthorized") {
          // Try to map structured error codes onto fields (#759)
          // api() rejects with the body.error string; re-check the response
          // by parsing it from the message when it matches a known code.
          var mapped = FIELD_ERROR_MAP[err.message];
          if (mapped) {
            setFieldError($(mapped.input), $(mapped.err), err.message);
            $(mapped.input).focus();
          } else {
            setError($("p-form-err"), err.message);
          }
        }
        $("dialog-submit").disabled = false;
        $("dialog-submit").textContent = "Create";
      });
  }

  // ── Wiring ────────────────────────────────────────────────────────────

  function init() {
    $("gate-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var key = $("api-key").value.trim();
      if (!key) return;
      setError($("gate-error"), null);
      signIn(key, $("remember").checked).catch(function (err) {
        if (err.message !== "unauthorized") setError($("gate-error"), err.message);
      });
    });

    $("sign-out").addEventListener("click", function () {
      signOut(null);
    });

    $("refresh").addEventListener("click", reload);
    $("load-more").addEventListener("click", loadPayments);
    $("detail-close").addEventListener("click", closeDetail);
    $("scrim").addEventListener("click", closeDetail);

    // New-payment dialog (#758 / #759)
    $("new-payment").addEventListener("click", openPaymentDialog);
    $("dialog-close").addEventListener("click", closePaymentDialog);
    $("dialog-cancel").addEventListener("click", closePaymentDialog);
    $("payment-form").addEventListener("submit", submitPayment);
    $("payment-dialog").addEventListener("click", function (ev) {
      // Close on backdrop click (click on the <dialog> element itself)
      if (ev.target === $("payment-dialog")) closePaymentDialog();
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeDetail();
    });

    Array.prototype.forEach.call(
      document.querySelectorAll(".chip"),
      function (chip) {
        chip.addEventListener("click", function () {
          Array.prototype.forEach.call(
            document.querySelectorAll(".chip"),
            function (c) {
              c.className = "chip";
            }
          );
          chip.className = "chip chip-on";
          state.status = chip.getAttribute("data-status") || "";
          reload();
        });
      }
    );

    window.setInterval(function () {
      if (state.key) pollHealth();
    }, 30000);

    // Resume an existing session when a key is already stored.
    /* Resume an existing session when a key is already stored. The gate is
       visible until this succeeds, so any failure here simply leaves the user
       looking at the sign-in form rather than at nothing. */
    var existing = storedKey();
    if (existing) {
      signIn(existing, null).catch(function (err) {
        /* A 401 already returned to the gate via signOut() inside api(). Every
           other failure — server down, network dropped, a proxy returning a
           login page — must land there too. Swallowing it would leave both
           panels hidden and render a blank page with no way forward. */
        if (err.message !== "unauthorized") {
          showGate("Could not restore your session: " + err.message);
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
