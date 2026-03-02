const FINNHUB_API_KEY = "d6incu9r01qm7dc86cvgd6incu9r01qm7dc86d00";
const CHART_COLORS = [
  "#3794ff", "#d7ba7d", "#4ec9b0", "#ce9178", "#c586c0", "#b5cea8", "#ff8b94"
];

/**
 * Format number as USD currency
 */
function formatUSD(amount) {
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Fetch holdings from JSON file
 */
async function fetchHoldings() {
  try {
    const res = await fetch("holdings.json");
    if (!res.ok) throw new Error(`Failed to fetch holdings.json (${res.status})`);
    const data = await res.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('holdings.json must be a non-empty array');
    }
    
    return data;
  } catch (error) {
    throw new Error(`Error loading holdings: ${error.message}`);
  }
}

/**
 * Fetch current stock price from Finnhub API
 */
async function fetchStockQuote(symbol) {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`API error for ${symbol} (${res.status})`);
    }
    
    const quote = await res.json();
    
    if (!quote || quote.c === undefined || quote.c === null) {
      console.warn(`No price data for ${symbol}`);
      return 0;
    }
    
    return quote.c;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    return 0;
  }
}

/**
 * Render the entire portfolio
 */
async function renderPortfolio() {
  try {
    // Hide error initially
    document.getElementById('error-message').style.display = "none";
    
    // Update timestamp
    document.getElementById("last-updated").textContent =
      "Last updated: " + new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

    console.log('📊 Loading portfolio...');
    
    // Load holdings
    const holdings = await fetchHoldings();
    console.log(`✅ Loaded ${holdings.length} holdings`);

    // Fetch prices for all stocks with rate limiting
    const details = [];
    let totalValue = 0;
    
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      console.log(`💰 Fetching ${h.symbol}...`);
      
      const price = await fetchStockQuote(h.symbol);
      const value = price * h.shares;
      
      details.push({
        symbol: h.symbol,
        shares: h.shares,
        price: price,
        value: value
      });
      
      totalValue += value;
      
      // Rate limiting: add delay between API calls
      if (i < holdings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ Total portfolio value: ${formatUSD(totalValue)}`);

    // Prepare chart data
    const labels = details.map(d => d.symbol);
    const values = details.map(d => d.value);
    const colors = CHART_COLORS.slice(0, labels.length);

    // Render pie chart
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.portfolioChart instanceof Chart) {
      window.portfolioChart.destroy();
    }
    
    window.portfolioChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#23272e',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: "#d4d4d4",
              font: { 
                family: "'Fira Mono', 'Courier New', monospace",
                weight: 'bold'
              },
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: '#252526',
            titleColor: '#3794ff',
            bodyColor: '#d4d4d4',
            borderColor: '#3e3e42',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const i = context.dataIndex;
                const percent = totalValue === 0 ? 0 : (values[i] / totalValue * 100);
                return `${labels[i]}: ${formatUSD(values[i])} (${percent.toFixed(1)}%)`;
              }
            }
          }
        }
      }
    });

    // Render stock list
    const list = document.getElementById('stock-list');
    list.innerHTML = "";
    
    details.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="stock-symbol">${item.symbol}</span>
         <span class="stock-price">${formatUSD(item.price)}</span>
         <span class="stock-shares">×${item.shares}</span>
         <span class="stock-value">${formatUSD(item.value)}</span>`;
      list.appendChild(li);
    });

    // Render total value
    document.getElementById('total-value').textContent =
      "Total: " + formatUSD(totalValue);

    console.log('✅ Portfolio rendered successfully');

  } catch (err) {
    console.error('❌ Error:', err);
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = '❌ ' + err.message;
    errorDiv.style.display = "block";
  }
}

// Load on page load
document.addEventListener('DOMContentLoaded', renderPortfolio);

// Auto-refresh every 5 minutes
setInterval(renderPortfolio, 5 * 60 * 1000);// ============================================================================
// Configuration
// ============================================================================

let FINNHUB_API_KEY = "d6incu9r01qm7dc86cvgd6incu9r01qm7dc86d00";

const CHART_COLORS = [
  "#3794ff", "#d7ba7d", "#4ec9b0", "#ce9178", "#c586c0", "#b5cea8",
  "#ff6b6b", "#ffd93d", "#6bcf7f", "#ff8b94"
];

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Get API key from URL parameters
 */
function getApiKeyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('api_key');
  console.log('API Key from URL:', key ? '✅ Found' : '❌ Not found');
  return key;
}

/**
 * Validate API key format
 */
function isValidApiKey(key) {
  if (!key) return false;
  // Finnhub API keys are typically alphanumeric
  return /^[a-zA-Z0-9]{10,}$/.test(key);
}

/**
 * Initialize API key on page load
 */
function initializeApiKey() {
  const apiKey = getApiKeyFromUrl();
  
  if (!apiKey) {
    showError('❌ No API key provided. Use: ?api_key=YOUR_FINNHUB_API_KEY');
    console.error('API key missing from URL parameters');
    return false;
  }
  
  if (!isValidApiKey(apiKey)) {
    showError('❌ Invalid API key format');
    console.error('API key format invalid');
    return false;
  }
  
  FINNHUB_API_KEY = apiKey;
  console.log('✅ API Key configured successfully');
  hideError();
  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format number as USD currency
 */
function formatUSD(amount) {
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format number as HKD currency
 */
function formatHKD(amount) {
  return 'HK$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Show error message
 */
function showError(message) {
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  
  if (errorContainer && errorMessage) {
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
  }
  console.error(message);
}

/**
 * Hide error message
 */
function hideError() {
  const errorContainer = document.getElementById('error-container');
  if (errorContainer) {
    errorContainer.style.display = 'none';
  }
}

/**
 * Update last updated timestamp
 */
function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (el) {
    const now = new Date();
    el.textContent = 'Last updated: ' + now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Load holdings from JSON file
 */
async function fetchHoldings() {
  try {
    const res = await fetch('holdings.json');
    if (!res.ok) throw new Error('Failed to load holdings.json (404)');
    
    const data = await res.json();
    console.log('Raw holdings data:', data);
    
    // Validate the new format: should have "stocks" and/or "cash"
    if (!data || (typeof data !== 'object')) {
      throw new Error('holdings.json must be a valid JSON object');
    }
    
    // Check if it has the new format
    const hasStocks = Array.isArray(data.stocks) && data.stocks.length > 0;
    const hasCash = data.cash && (typeof data.cash === 'object') && 
                    (data.cash.USD > 0 || data.cash.HKD > 0);
    
    if (!hasStocks && !hasCash) {
      throw new Error('holdings.json must contain either "stocks" array or "cash" object with USD/HKD');
    }
    
    return {
      stocks: data.stocks || [],
      cash: data.cash || { USD: 0, HKD: 0 }
    };
  } catch (error) {
    console.error('Error loading holdings:', error);
    showError('❌ Failed to load holdings.json: ' + error.message);
    return { stocks: [], cash: { USD: 0, HKD: 0 } };
  }
}

/**
 * Fetch stock price from Finnhub API
 */
async function fetchStockQuote(symbol) {
  if (!FINNHUB_API_KEY) {
    console.error('API Key not set. Cannot fetch prices.');
    return { symbol, price: 0, error: true };
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    console.log(`🔄 Fetching ${symbol}...`);
    
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.c && data.c !== 0) {
      console.warn(`⚠️ No price data for ${symbol}`);
      return { symbol, price: 0, error: true };
    }
    
    const price = data.c || 0;
    console.log(`✅ ${symbol}: ${formatUSD(price)}`);
    
    return { symbol, price, error: false };
  } catch (error) {
    console.error(`❌ Error fetching ${symbol}:`, error.message);
    return { symbol, price: 0, error: true };
  }
}

/**
 * Fetch all stock quotes with rate limiting
 */
async function fetchAllQuotes(stocks) {
  if (!FINNHUB_API_KEY) {
    console.error('API Key not set. Cannot fetch any stock prices.');
    return stocks.map(s => ({ symbol: s.symbol, price: 0, error: true }));
  }

  console.log('💰 Starting to fetch stock prices...');
  const quotes = [];
  
  for (let i = 0; i < stocks.length; i++) {
    const quote = await fetchStockQuote(stocks[i].symbol);
    quotes.push(quote);
    
    // Rate limiting: 100ms delay between API calls
    if (i < stocks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('✅ All stock prices fetched');
  return quotes;
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Merge stocks with prices and calculate position values
 */
function enrichStocks(stocks, quotes) {
  return stocks.map(stock => {
    const quote = quotes.find(q => q.symbol === stock.symbol) || { price: 0, error: true };
    const positionValue = quote.price * stock.shares;
    
    return {
      symbol: stock.symbol,
      shares: stock.shares,
      price: quote.price,
      positionValue: positionValue,
      error: quote.error,
      type: 'stock'
    };
  });
}

/**
 * Create combined cash holding object
 * Combines USD and HKD into a single entry for pie chart
 */
function createCombinedCashHolding(cashObj) {
  // Ensure we have valid numbers
  const usd = Number(cashObj.USD) || 0;
  const hkd = Number(cashObj.HKD) || 0;
  
  // For pie chart, we only show the total value (in USD equivalent)
  const totalValue = usd + hkd; // Simple sum, you can add conversion if needed
  
  return {
    symbol: 'CASH',
    shares: 1,
    price: totalValue,
    positionValue: totalValue,
    error: false,
    type: 'cash',
    breakdown: {
      USD: usd,
      HKD: hkd
    }
  };
}

/**
 * Calculate portfolio percentages
 */
function calculatePercentages(portfolio) {
  const totalValue = portfolio.reduce((sum, h) => sum + h.positionValue, 0);
  
  return {
    holdings: portfolio.map(e => ({
      ...e,
      percent: totalValue > 0 ? (e.positionValue / totalValue) * 100 : 0
    })),
    totalValue: totalValue
  };
}

// ============================================================================
// DOM Rendering
// ============================================================================

/**
 * Render pie chart with percentage labels
 */
function renderPieChart(portfolio, totalValue) {
  const canvasEl = document.getElementById('portfolioChart');
  if (!canvasEl) return;
  
  const ctx = canvasEl.getContext('2d');
  
  // Destroy existing chart
  if (window.portfolioChart instanceof Chart) {
    window.portfolioChart.destroy();
  }
  
  const labels = portfolio.map(e => e.symbol);
  const values = portfolio.map(e => e.positionValue);
  const percents = portfolio.map(e => e.percent);
  
  // Use special color for CASH
  const colors = portfolio.map((h, i) => {
    if (h.symbol === 'CASH') return '#b5cea8';
    return CHART_COLORS[i % CHART_COLORS.length];
  });
  
  window.portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#23272e',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        // Percentage labels on pie slices
        datalabels: {
          color: '#d4d4d4',
          font: {
            family: "'Courier New', 'Fira Mono', monospace",
            weight: 'bold',
            size: 13
          },
          formatter: (value, context) => {
            const i = context.dataIndex;
            return percents[i].toFixed(1) + '%';
          },
          anchor: 'center',
          align: 'center',
          offset: 0
        },
        // Legend
        legend: {
          position: 'bottom',
          labels: {
            color: '#d4d4d4',
            font: {
              family: "'Courier New', 'Fira Mono', monospace",
              weight: 'bold'
            },
            padding: 15,
            usePointStyle: true
          }
        },
        // Tooltip on hover
        tooltip: {
          backgroundColor: '#252526',
          titleColor: '#3794ff',
          bodyColor: '#d4d4d4',
          borderColor: '#3e3e42',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(context) {
              const i = context.dataIndex;
              const symbol = labels[i];
              const value = formatUSD(values[i]);
              const percent = percents[i].toFixed(1);
              return `${symbol}: ${value} (${percent}%)`;
            }
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

/**
 * Render stock list with price and position values
 */
function renderStockList(portfolio) {
  const stockList = document.getElementById('stock-list');
  stockList.innerHTML = '';
  
  // Separate stocks and cash
  const stocks = portfolio.filter(h => h.type === 'stock');
  const cash = portfolio.find(h => h.type === 'cash');
  
  // Render stocks
  stocks.forEach(holding => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="stock-symbol">${holding.symbol}</span>
      <span class="stock-price">${formatUSD(holding.price)}</span>
      <span class="stock-shares">×${holding.shares}</span>
      <span class="stock-posvalue">${formatUSD(holding.positionValue)}</span>
    `;
    stockList.appendChild(li);
  });
  
  // Render combined cash with breakdown
  if (cash && (cash.breakdown.USD > 0 || cash.breakdown.HKD > 0)) {
    const mainCashLi = document.createElement('li');
    mainCashLi.className = 'cash-row';
    mainCashLi.innerHTML = `
      <span class="stock-symbol cash">💵 CASH</span>
      <span class="stock-price cash">-</span>
      <span class="stock-shares">-</span>
      <span class="stock-posvalue cash">${formatUSD(cash.breakdown.USD + cash.breakdown.HKD)}</span>
    `;
    stockList.appendChild(mainCashLi);
    
    // Add USD breakdown
    if (cash.breakdown.USD > 0) {
      const usdLi = document.createElement('li');
      usdLi.className = 'cash-sub-row';
      usdLi.innerHTML = `
        <span class="stock-symbol cash-usd">├─ USD</span>
        <span class="stock-price cash-sub">-</span>
        <span class="stock-shares">-</span>
        <span class="stock-posvalue cash-sub">${formatUSD(cash.breakdown.USD)}</span>
      `;
      stockList.appendChild(usdLi);
    }
    
    // Add HKD breakdown
    if (cash.breakdown.HKD > 0) {
      const hkdLi = document.createElement('li');
      hkdLi.className = 'cash-sub-row';
      hkdLi.innerHTML = `
        <span class="stock-symbol cash-hkd">└─ HKD</span>
        <span class="stock-price cash-sub">-</span>
        <span class="stock-shares">-</span>
        <span class="stock-posvalue cash-sub">${formatHKD(cash.breakdown.HKD)}</span>
      `;
      stockList.appendChild(hkdLi);
    }
  }
}

/**
 * Render portfolio total
 */
function renderPortfolioTotal(totalValue) {
  const totalEl = document.getElementById('portfolio-total');
  totalEl.textContent = `Total Portfolio Value: ${formatUSD(totalValue)}`;
}

// ============================================================================
// Main Application
// ============================================================================

/**
 * Initialize and render portfolio
 */
async function renderPortfolio() {
  try {
    hideError();
    console.log('📊 Loading portfolio...');
    
    // Load holdings
    const data = await fetchHoldings();
    const stocks = data.stocks || [];
    const cashObj = data.cash || { USD: 0, HKD: 0 };
    
    console.log('Stocks:', stocks);
    console.log('Cash:', cashObj);
    
    // Check if we have any data
    const hasStocks = Array.isArray(stocks) && stocks.length > 0;
    const hasCash = (Number(cashObj.USD) > 0 || Number(cashObj.HKD) > 0);
    
    if (!hasStocks && !hasCash) {
      showError('❌ No stocks or cash found in holdings.json. Please check the file format.');
      return;
    }
    
    const usdAmount = Number(cashObj.USD) || 0;
    const hkdAmount = Number(cashObj.HKD) || 0;
    console.log(`📦 Loaded ${stocks.length} stocks, ${formatUSD(usdAmount)} USD cash, ${formatHKD(hkdAmount)} HKD cash`);
    
    // Fetch quotes only for stocks
    let quotes = [];
    if (stocks.length > 0) {
      console.log('💰 Fetching prices from Finnhub API...');
      quotes = await fetchAllQuotes(stocks);
    }
    
    // Enrich and calculate
    const enrichedStocks = enrichStocks(stocks, quotes);
    
    // Add combined cash to portfolio
    const portfolio = [...enrichedStocks];
    const combinedCash = createCombinedCashHolding(cashObj);
    if (combinedCash.positionValue > 0) {
      portfolio.push(combinedCash);
    }
    
    const { holdings, totalValue } = calculatePercentages(portfolio);
    
    // Show portfolio containers
    document.getElementById('chart-container').style.display = 'flex';
    document.getElementById('positions-container').style.display = 'block';
    
    // Render
    renderPieChart(holdings, totalValue);
    renderStockList(holdings);
    renderPortfolioTotal(totalValue);
    updateTimestamp();
    
    console.log('✅ Portfolio loaded successfully');
  } catch (error) {
    console.error('Error:', error);
    showError('❌ Error loading portfolio: ' + error.message);
  }
}

// ============================================================================
// Startup
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize API key first
    if (initializeApiKey()) {
      // Only render portfolio if API key is valid
      renderPortfolio();
      // Auto-refresh every 5 minutes
      setInterval(renderPortfolio, 5 * 60 * 1000);
    }
  });
} else {
  // Initialize API key first
  if (initializeApiKey()) {
    // Only render portfolio if API key is valid
    renderPortfolio();
    // Auto-refresh every 5 minutes
    setInterval(renderPortfolio, 5 * 60 * 1000);
  }
}
