// ---- status elements ----
const STATUS = {
  portfolio: document.getElementById("status-portfolio"),
  prices: document.getElementById("status-prices"),
  updated: document.getElementById("status-updated"),
  log: document.getElementById("log-line"),
  ccy: document.getElementById("ccy-label"),
};

const tableBody = document.querySelector("#holdings-table tbody");
const totalValueEl = document.getElementById("total-value");

let chartInstance = null;

// ---- helpers ----
function log(msg) {
  const now = new Date().toLocaleTimeString();
  STATUS.log.innerHTML =
    '<span class="log-key">log&gt;</span> ' +
    '<span class="log-val">[' +
    now +
    "] " +
    msg +
    "</span>";
}

function setStatus(el, text, state) {
  el.textContent = text;
  el.classList.remove("ok", "error");
  if (state === "ok") el.classList.add("ok");
  if (state === "error") el.classList.add("error");
}

// ---- Finnhub config ----
// Get a free key at https://finnhub.io and paste it here.[web:12][web:15]
const API_KEY = "d6incu9r01qm7dc86cvgd6incu9r01qm7dc86d00";

// Docs: https://finnhub.io/docs/api/quote.[web:12][web:15]
async function fetchStockPrice(symbol) {
  const url =
    "https://finnhub.io/api/v1/quote?symbol=" +
    encodeURIComponent(symbol) +
    "&token=" +
    API_KEY;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }
  const data = await res.json();

  // Finnhub current price field is `c`.[web:12][web:15]
  const price = data.c;
  if (price == null) {
    throw new Error("No price in response for " + symbol);
  }
  return Number(price);
}

// ---- portfolio loading ----
async function loadPortfolio() {
  try {
    const res = await fetch("portfolio.json");
    if (!res.ok) {
      throw new Error("Unable to load portfolio.json (" + res.status + ")");
    }
    const portfolio = await res.json();
    STATUS.ccy.textContent = portfolio.currency || "USD";
    log("portfolio.json loaded, " + portfolio.holdings.length + " holdings.");
    return portfolio;
  } catch (err) {
    setStatus(STATUS.portfolio, "portfolio.json: error", "error");
    log("portfolio load failed: " + err.message);
    throw err;
  }
}

// ---- price loading ----
async function loadPrices(holdings) {
  setStatus(STATUS.prices, "prices: fetching...", null);
  const results = [];

  for (const h of holdings) {
    try {
      const price = await fetchStockPrice(h.symbol);
      results.push({ ...h, price, value: price * h.shares });
    } catch (err) {
      log("price fetch failed for " + h.symbol + ": " + err.message);
      results.push({ ...h, price: 0, value: 0, error: true });
    }
  }

  setStatus(STATUS.prices, "prices: updated", "ok");
  STATUS.updated.textContent = "updated: " + new Date().toLocaleTimeString();
  return results;
}

// ---- rendering ----
function renderTable(rows, currency) {
  tableBody.innerHTML = "";
  let total = 0;

  for (const row of rows) {
    total += row.value;

    const tr = document.createElement("tr");

    const tdSymbol = document.createElement("td");
    tdSymbol.className = "symbol";
    tdSymbol.textContent = row.symbol;

    const tdShares = document.createElement("td");
    tdShares.textContent = row.shares.toLocaleString();

    const tdPrice = document.createElement("td");
    tdPrice.className = "price";
    tdPrice.textContent = row.price
      ? row.price.toLocaleString(undefined, { style: "currency", currency })
      : "n/a";

    const tdValue = document.createElement("td");
    tdValue.textContent = row.value
      ? row.value.toLocaleString(undefined, { style: "currency", currency })
      : "n/a";

    tr.appendChild(tdSymbol);
    tr.appendChild(tdShares);
    tr.appendChild(tdPrice);
    tr.appendChild(tdValue);
    tableBody.appendChild(tr);
  }

  totalValueEl.textContent = total.toLocaleString(undefined, {
    style: "currency",
    currency,
  });
}

function renderChart(rows) {
  const ctx = document.getElementById("portfolioChart").getContext("2d");
  const labels = rows.map((r) => r.symbol);
  const data = rows.map((r) => r.value);

  const colors = [
    "#61afef",
    "#98c379",
    "#e06c75",
    "#c678dd",
    "#e5c07b",
    "#56b6c2",
    "#be5046",
    "#d19a66",
    "#46d9ff",
  ];

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          borderColor: "#05060a",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#dcdfe4",
            font: { family: "ui-monospace" },
          },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const label = ctx.label || "";
              const value = ctx.raw || 0;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? ((value / total) * 100).toFixed(1) : 0;
              return (
                label +
                ": " +
                value.toLocaleString() +
                " (" +
                pct +
                "%)"
              );
            },
          },
        },
      },
    },
  });
}

// ---- init ----
async function init() {
  try {
    const portfolio = await loadPortfolio();
    setStatus(STATUS.portfolio, "portfolio.json: loaded", "ok");

    const enriched = await loadPrices(portfolio.holdings);
    renderTable(enriched, portfolio.currency || "USD");
    renderChart(enriched);
    log("render complete.");
  } catch (err) {
    log("fatal: " + err.message);
  }
}

document.addEventListener("DOMContentLoaded", init);
