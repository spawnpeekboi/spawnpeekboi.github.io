// ============================================================================
// Configuration & Initialization
// ============================================================================

let FINNHUB_API_KEY = null;
const PIE_COLORS = [
  "#3794ff", "#4ec9b0", "#d7ba7d", "#ce9178", "#c586c0", "#b5cea8",
  "#ff6b6b", "#ffd93d", "#6bcf7f", "#ff8b94"
];

/**
 * Get API key from URL parameters
 */
function getApiKeyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('api_key');
}

/**
 * Validate API key format
 */
function isValidApiKey(key) {
  if (!key) return false;
  // Finnhub API keys are typically alphanumeric, at least 10 chars
  return /^[a-zA-Z0-9]{10,}$/.test(key);
}

/**
 * Show setup message
 */
function showSetupMessage(message, type = 'loading') {
  const statusEl = document.getElementById('api-status');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
}

/**
 * Initialize application with API key
 */
function initializeApp(apiKey) {
  FINNHUB_API_KEY = apiKey;
  
  // Hide setup panel
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('chart-container').style.display = 'flex';
  document.getElementById('holdings-list-container').style.display = 'block';
  
  console.log('✅ API Key configured. Loading portfolio...');
  renderPortfolio();
}

/**
 * Check API key on page load
 */
function checkApiKey() {
  const apiKey = getApiKeyFromUrl();
  
  if (!apiKey) {
    showSetupMessage('❌ No API key provided. Add ?api_key=YOUR_KEY to URL', 'error');
    return false;
  }
  
  if (!isValidApiKey(apiKey)) {
    showSetupMessage('❌ Invalid API key format', 'error');
    return false;
  }
  
  showSetupMessage('✅ API Key validated. Initializing...', 'success');
  setTimeout(() => initializeApp(apiKey), 500);
  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format number to USD currency
 */
function formatUSD(amount) {
  return '$' + Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
  console.error(message);
}

/**
 * Clear error message
 */
function clearError() {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.style.display = 'none';
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
    const res = await fetch("holdings.json");
    if (!res.ok) throw new Error('Failed to load holdings.json');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Holdings file must contain a non-empty array');
    }
    return data;
  } catch (error) {
    showError(`Error loading holdings: ${error.message}`);
    return [];
  }
}

/**
 * Fetch stock price from Finnhub API
 */
async function fetchStockQuote(symbol) {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }
    
    const data = await res.json();
    
    // Check for error in response
    if (data.error) {
      throw new Error(data.error);
    }
    
    const price = data.c || 0;
    
    return { symbol, price, error: false };
  } catch (error) {
    console.warn(`Error fetching ${symbol}:`, error.message);
    return { symbol, price: 0, error: true };
  }
}

/**
 * Fetch all stock quotes with rate limiting
 */
async function fetchAllQuotes(holdings) {
  const quotes = [];
  for (let i = 0; i < holdings.length; i++) {
    const quote = await fetchStockQuote(holdings[i].symbol);
    quotes.push(quote);
    
    // Rate limiting delay (100ms between requests to avoid API limits)
    if (i < holdings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return quotes;
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Merge holdings with prices and calculate percentages
 */
function enrichHoldings(holdings, quotes) {
  return holdings.map(holding => {
    const quote = quotes.find(q => q.symbol === holding.symbol) || { price: 0, error: true };
    const value = quote.price * holding.shares;
    return {
      symbol: holding.symbol,
      shares: holding.shares,
      price: quote.price,
      value: value,
      error: quote.error
    };
  });
}

/**
 * Calculate portfolio percentages
 */
function calculatePercentages(enriched) {
  const totalValue = enriched.reduce((sum, h) => sum + h.value, 0);
  return enriched.map(e => ({
    ...e,
    totalValue: totalValue,
    percent: totalValue > 0 ? (e.value / totalValue) * 100 : 0
  }));
}

// ============================================================================
// DOM Rendering
// ============================================================================

/**
 * Render pie chart
 */
function renderPieChart(portfolio) {
  const ctx = document.getElementById('portfolioChart').getContext('2d');
  
  if (window.portfolioChart instanceof Chart) {
    window.portfolioChart.destroy();
  }
  
  const labels = portfolio.map(e => e.symbol);
  const values = portfolio.map(e => e.value);
  const percents = portfolio.map(e => e.percent);
  const colors = PIE_COLORS.slice(0, labels.length);
  
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
        legend: {
          position: 'bottom',
          labels: {
            color: '#d4d4d4',
            font: { family: "'Fira Mono', monospace", size: 12, weight: 'bold' },
            padding: 15,
            usePointStyle: true
          }
        },
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
              return `${labels[i]}: ${formatUSD(values[i])} (${percents[i].toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Render holdings list
 */
function renderHoldingsList(portfolio) {
  const list = document.getElementById('stock-list');
  list.innerHTML = "";
  
  portfolio.forEach(holding => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <span class="stock-symbol">${holding.symbol}</span>
        <span class="stock-shares">×${holding.shares} shares</span>
      </div>
      <div class="stock-percent">${holding.percent.toFixed(1)}%</div>
    `;
    list.appendChild(li);
  });
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
// Main Application
// ============================================================================

/**
 * Initialize and render portfolio
 */
async function renderPortfolio() {
  try {
    clearError();
    console.log('📊 Loading portfolio...');
    
    // Load holdings
    const holdings = await fetchHoldings();
    if (!holdings || holdings.length === 0) return;
    
    console.log(`📦 Loaded ${holdings.length} holdings`);
    
    // Fetch quotes
    console.log('💰 Fetching prices...');
    const quotes = await fetchAllQuotes(holdings);
    
    // Enrich and calculate
    const enriched = enrichHoldings(holdings, quotes);
    const portfolio = calculatePercentages(enriched);
    
    // Render
    renderPieChart(portfolio);
    renderHoldingsList(portfolio);
    updateTimestamp();
    
    console.log('✅ Portfolio loaded successfully');
  } catch (error) {
    showError(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

// ============================================================================
// Startup
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkApiKey);
} else {
  checkApiKey();
}

// Auto-refresh every 5 minutes (only if API key is set)
setInterval(() => {
  if (FINNHUB_API_KEY) {
    renderPortfolio();
  }
}, 5 * 60 * 1000);