// ============================================================================
// Configuration
// ============================================================================

// Replace with your Finnhub API key from https://finnhub.io/register
let FINNHUB_API_KEY = "YOUR_FINNHUB_API_KEY";

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
 * Show error message
 */
function showError(message) {
  document.getElementById('error-container').style.display = 'block';
  document.getElementById('error-message').textContent = '❌ ' + message;
}

/**
 * Hide error message
 */
function hideError() {
  document.getElementById('error-container').style.display = 'none';
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
    
    if (!data.stocks && !data.cash) {
      throw new Error('holdings.json must contain "stocks" and/or "cash" properties');
    }
    
    return data;
  } catch (error) {
    console.error('Error loading holdings:', error);
    showError('Failed to load holdings.json: ' + error.message);
    return { stocks: [], cash: 0 };
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
async function fetchAllQuotes(stocks) {
  const quotes = [];
  for (let i = 0; i < stocks.length; i++) {
    const quote = await fetchStockQuote(stocks[i].symbol);
    quotes.push(quote);
    
    // Rate limiting: 100ms delay between API calls
    if (i < stocks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
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
 * Create cash holding object
 */
function createCashHolding(cashAmount) {
  return {
    symbol: 'CASH',
    shares: 1,
    price: cashAmount,
    positionValue: cashAmount,
    error: false,
    type: 'cash'
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
  
  // Render cash
  if (cash) {
    const li = document.createElement('li');
    li.className = 'cash-row';
    li.innerHTML = `
      <span class="stock-symbol cash">💵 CASH</span>
      <span class="stock-price cash">-</span>
      <span class="stock-shares">-</span>
      <span class="stock-posvalue cash">${formatUSD(cash.positionValue)}</span>
    `;
    stockList.appendChild(li);
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
    const cash = data.cash || 0;
    
    if (!stocks || stocks.length === 0) {
      if (cash === 0) {
        showError('No stocks or cash found in holdings.json');
        return;
      }
    }
    
    console.log(`📦 Loaded ${stocks.length} stocks and ${formatUSD(cash)} cash`);
    
    // Fetch quotes only for stocks
    let quotes = [];
    if (stocks.length > 0) {
      console.log('💰 Fetching prices...');
      quotes = await fetchAllQuotes(stocks);
    }
    
    // Enrich and calculate
    const enrichedStocks = enrichStocks(stocks, quotes);
    
    // Add cash to portfolio
    const portfolio = [...enrichedStocks];
    if (cash > 0) {
      portfolio.push(createCashHolding(cash));
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
    showError('Error loading portfolio: ' + error.message);
  }
}

// ============================================================================
// Startup
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderPortfolio);
} else {
  renderPortfolio();
}

// Auto-refresh every 5 minutes
setInterval(renderPortfolio, 5 * 60 * 1000);