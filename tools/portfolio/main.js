// ============================================================================
// Configuration
// ============================================================================

let FINNHUB_API_KEY = null;

const CHART_COLORS = [
  "#3794ff", "#d7ba7d", "#4ec9b0", "#ce9178", "#c586c0", "#b5cea8",
  "#ff6b6b", "#ffd93d", "#6bcf7f", "#ff8b94"
];

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
 * Get API key from URL parameters
 */
function getApiKeyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('api_key');
}

/**
 * Check if API key is valid
 */
function isValidApiKey(key) {
  if (!key) return false;
  return /^[a-zA-Z0-9]{10,}$/.test(key);
}

/**
 * Show setup panel
 */
function showSetupPanel() {
  document.getElementById('api-setup').style.display = 'block';
  document.getElementById('chart-container').style.display = 'none';
  document.getElementById('positions-container').style.display = 'none';
}

/**
 * Hide setup panel and show portfolio
 */
function hideSetupPanel() {
  document.getElementById('api-setup').style.display = 'none';
  document.getElementById('chart-container').style.display = 'flex';
  document.getElementById('positions-container').style.display = 'block';
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
    if (!res.ok) throw new Error('Failed to load holdings.json');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Holdings file is empty');
    }
    return data;
  } catch (error) {
    console.error('Error loading holdings:', error);
    alert('Error loading holdings.json: ' + error.message);
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
    
    // Rate limiting: 100ms delay between API calls
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
 * Merge holdings with prices and calculate position values
 */
function enrichHoldings(holdings, quotes) {
  return holdings.map(holding => {
    const quote = quotes.find(q => q.symbol === holding.symbol) || { price: 0, error: true };
    const positionValue = quote.price * holding.shares;
    
    return {
      symbol: holding.symbol,
      shares: holding.shares,
      price: quote.price,
      positionValue: positionValue,
      error: quote.error
    };
  });
}

/**
 * Calculate portfolio percentages
 */
function calculatePercentages(enriched) {
  const totalValue = enriched.reduce((sum, h) => sum + h.positionValue, 0);
  
  return {
    holdings: enriched.map(e => ({
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
  const colors = CHART_COLORS.slice(0, portfolio.length);
  
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
  
  portfolio.forEach(holding => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="stock-symbol">${holding.symbol}</span>
      <span class="stock-price">${formatUSD(holding.price)}</span>
      <span class="stock-shares">×${holding.shares}</span>
      <span class="stock-posvalue">${formatUSD(holding.positionValue)}</span>
    `;
    stockList.appendChild(li);
  });
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
    const { holdings: portfolio, totalValue } = calculatePercentages(enriched);
    
    // Render
    renderPieChart(portfolio, totalValue);
    renderStockList(portfolio);
    renderPortfolioTotal(totalValue);
    updateTimestamp();
    
    console.log('✅ Portfolio loaded successfully');
  } catch (error) {
    console.error('Error:', error);
    alert('Error loading portfolio: ' + error.message);
  }
}

/**
 * Initialize application
 */
function initializeApp() {
  const apiKey = getApiKeyFromUrl();
  
  if (!apiKey) {
    console.warn('No API key provided');
    showSetupPanel();
    return;
  }
  
  if (!isValidApiKey(apiKey)) {
    console.warn('Invalid API key format');
    showSetupPanel();
    return;
  }
  
  // API key is valid
  FINNHUB_API_KEY = apiKey;
  hideSetupPanel();
  renderPortfolio();
}

// ============================================================================
// Startup
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Auto-refresh every 5 minutes (only if API key is set)
setInterval(() => {
  if (FINNHUB_API_KEY) {
    renderPortfolio();
  }
}, 5 * 60 * 1000);
