// Get API key from URL query parameters
function getApiKey() {
  const params = new URLSearchParams(window.location.search);
  const apiKey = params.get('apikey');
  
  if (!apiKey) {
    showError('❌ API Key Missing! Add ?apikey=YOUR_KEY to the URL');
    return null;
  }
  
  return apiKey;
}

// Show error message
function showError(message) {
  const container = document.querySelector('.container');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  container.insertBefore(errorDiv, container.firstChild);
}

// Show info message
function showInfo(message) {
  const container = document.querySelector('.container');
  const infoDiv = document.createElement('div');
  infoDiv.className = 'info';
  infoDiv.textContent = message;
  container.insertBefore(infoDiv, container.querySelector('header').nextSibling);
}

// Fetch holdings from JSON file
async function fetchHoldings() {
  try {
    const response = await fetch('holdings.json');
    if (!response.ok) {
      throw new Error('Cannot load holdings.json - Make sure it exists in the same directory');
    }
    return await response.json();
  } catch (error) {
    showError('❌ Error loading holdings: ' + error.message);
    return [];
  }
}

// Fetch stock price from Finnhub API
async function fetchStockPrice(symbol, apiKey) {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
    );
    const data = await response.json();
    
    if (data.c === undefined) {
      throw new Error(`Invalid symbol or API response: ${symbol}`);
    }
    
    return data.c; // Current price
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return 0;
  }
}

// Fetch HKD to USD exchange rate
async function fetchHkdToUsd(apiKey) {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/forex/rates?base=HKD&token=${apiKey}`
    );
    const data = await response.json();
    
    // Check if USD rate exists in the response
    if (data.quote && data.quote.USD) {
      return data.quote.USD;
    } else if (data.USD) {
      return data.USD;
    }
    
    // Fallback: use approximate rate if API doesn't return it
    console.warn('Could not fetch HKD/USD rate, using approximate rate');
    return 0.128; // Approximate HKD to USD rate
  } catch (error) {
    console.error('Error fetching HKD/USD rate:', error);
    return 0.128; // Fallback rate
  }
}

// Main function to build portfolio
async function buildPortfolio() {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const holdings = await fetchHoldings();
  if (holdings.length === 0) return;

  let portfolio = [];
  let hkdAmount = 0;
  let usdAmount = 0;

  // Separate stocks and cash
  const stocks = holdings.filter(h => h.type === 'stock');
  const cashHoldings = holdings.filter(h => h.type === 'cash');

  // Process cash holdings
  for (const cash of cashHoldings) {
    if (cash.symbol === 'HKD') {
      hkdAmount += cash.amount;
    } else if (cash.symbol === 'USD') {
      usdAmount += cash.amount;
    }
  }

  // Fetch HKD to USD rate if there's HKD cash
  let hkdToUsdRate = 1;
  if (hkdAmount > 0) {
    hkdToUsdRate = await fetchHkdToUsd(apiKey);
  }

  // Convert HKD to USD
  const hkdValueInUsd = hkdAmount * hkdToUsdRate;

  // Fetch stock prices
  for (const stock of stocks) {
    const price = await fetchStockPrice(stock.symbol, apiKey);
    const totalValue = price * stock.units;

    portfolio.push({
      symbol: stock.symbol,
      price: price,
      units: stock.units,
      totalValue: totalValue,
      type: 'stock'
    });
  }

  // Add USD cash to portfolio
  if (usdAmount > 0) {
    portfolio.push({
      symbol: 'USD Cash',
      price: 1.00,
      units: usdAmount,
      totalValue: usdAmount,
      type: 'cash'
    });
  }

  // Add HKD cash (converted to USD) to portfolio
  if (hkdAmount > 0) {
    portfolio.push({
      symbol: 'HKD Cash',
      price: hkdToUsdRate,
      units: hkdAmount,
      totalValue: hkdValueInUsd,
      type: 'cash',
      originalAmount: hkdAmount
    });
  }

  // Calculate total value
  const totalValue = portfolio.reduce((sum, item) => sum + item.totalValue, 0);

  // Calculate percentages
  portfolio.forEach(item => {
    item.percentage = ((item.totalValue / totalValue) * 100).toFixed(2);
  });

  // Render the portfolio
  renderTable(portfolio, totalValue);
  renderChart(portfolio, totalValue);
  updateSummary(totalValue);
}

// Render holdings table
function renderTable(portfolio, totalValue) {
  const tbody = document.getElementById('holdings-body');
  tbody.innerHTML = '';

  portfolio.forEach(item => {
    const row = document.createElement('tr');
    
    let priceDisplay = `$${item.price.toFixed(2)}`;
    let unitsDisplay = item.units.toFixed(2);

    // Format HKD cash display
    if (item.symbol === 'HKD Cash') {
      priceDisplay = `$${item.price.toFixed(4)} (HKD/USD)`;
      unitsDisplay = `HK$${item.units.toFixed(0)}`;
    }

    row.innerHTML = `
      <td>${item.symbol}</td>
      <td>${priceDisplay}</td>
      <td>${unitsDisplay}</td>
      <td>$${item.totalValue.toFixed(2)}</td>
      <td>${item.percentage}%</td>
    `;
    
    tbody.appendChild(row);
  });

  // Add total row
  const totalRow = document.createElement('tr');
  totalRow.style.fontWeight = '700';
  totalRow.style.backgroundColor = '#0d1117';
  totalRow.style.borderTop = '2px solid #30363d';
  totalRow.innerHTML = `
    <td>TOTAL</td>
    <td></td>
    <td></td>
    <td>$${totalValue.toFixed(2)}</td>
    <td>100.00%</td>
  `;
  tbody.appendChild(totalRow);
}

// Render pie chart
function renderChart(portfolio, totalValue) {
  const labels = portfolio.map(item => item.symbol);
  const data = portfolio.map(item => parseFloat(item.percentage));
  
  const colors = [
    '#58a6ff',
    '#79c0ff',
    '#1f6feb',
    '#238636',
    '#3fb950',
    '#7ee787',
    '#d1aaff',
    '#f0883e',
    '#fb8500',
    '#f85149',
    '#ffa198',
    '#ff7b72'
  ];

  const ctx = document.getElementById('portfolioChart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (window.portfolioChart instanceof Chart) {
    window.portfolioChart.destroy();
  }

  window.portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#0d1117',
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
            color: '#c9d1d9',
            font: {
              family: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'monospace'",
              size: 12,
              weight: '500'
            },
            padding: 15,
            generateLabels: function(chart) {
              const data = chart.data;
              return data.labels.map((label, i) => ({
                text: `${label}: ${data.datasets[0].data[i]}%`,
                fillStyle: data.datasets[0].backgroundColor[i],
                hidden: false,
                index: i
              }));
            }
          }
        },
        tooltip: {
          backgroundColor: '#161b22',
          titleColor: '#58a6ff',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1,
          titleFont: {
            family: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'monospace'",
            size: 13,
            weight: '600'
          },
          bodyFont: {
            family: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'monospace'",
            size: 12
          },
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed}%`;
            }
          }
        }
      }
    }
  });
}

// Update summary section
function updateSummary(totalValue) {
  document.getElementById('total-value').textContent = `$${totalValue.toFixed(2)}`;
}

// Initialize portfolio on page load
document.addEventListener('DOMContentLoaded', () => {
  buildPortfolio();
});