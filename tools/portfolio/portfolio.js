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
    return {};
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
    
    return data.c;
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
    
    if (data.quote && data.quote.USD) {
      return data.quote.USD;
    } else if (data.USD) {
      return data.USD;
    }
    
    console.warn('Could not fetch HKD/USD rate, using approximate rate');
    return 0.128;
  } catch (error) {
    console.error('Error fetching HKD/USD rate:', error);
    return 0.128;
  }
}

// Get CSS variable colors for a class
function getClassColors(className) {
  const root = document.documentElement;
  const cssClassName = className.replace(/\s+/g, ''); // Remove spaces: "U.S. Bond" → "USBond"
  const colors = {
    dominant: getComputedStyle(root).getPropertyValue(`--color-${cssClassName}-dominant`).trim(),
    subColors: []
  };
  
  for (let i = 0; i < 11; i++) {
    const color = getComputedStyle(root).getPropertyValue(`--color-${cssClassName}-sub${i}`).trim();
    if (color) colors.subColors.push(color);
  }
  
  return colors;
}

// Main function to build portfolio
async function buildPortfolio() {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const holdingsData = await fetchHoldings();
  if (Object.keys(holdingsData).length === 0) return;

  let portfolio = [];
  let chartLabels = [];
  let chartData = [];
  let chartColors = [];
  let chartBorders = [];
  let valueByClass = {};
  let totalValue = 0;

  // Class names in order
  const classNames = ['Cash', 'ETFs', 'Playground', 'U.S. Bond'];

  // Process each main class
  for (const className of classNames) {
    const entries = holdingsData[className] || [];
    const classColorConfig = getClassColors(className);
    let classValue = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      let itemValue = 0;
      let price = 0;

      if (entry.type === 'stock') {
        price = await fetchStockPrice(entry.symbol, apiKey);
        itemValue = price * entry.units;
        portfolio.push({
          className,
          symbol: entry.symbol,
          price: price,
          units: entry.units,
          totalValue: itemValue,
          type: 'stock'
        });
      } else if (entry.type === 'cash' && entry.symbol === 'USD') {
        itemValue = entry.amount;
        price = 1.00;
        portfolio.push({
          className,
          symbol: 'USD',
          price: price,
          units: entry.amount,
          totalValue: itemValue,
          type: 'cash'
        });
      } else if (entry.type === 'cash' && entry.symbol === 'HKD') {
        const hkdRate = await fetchHkdToUsd(apiKey);
        itemValue = entry.amount * hkdRate;
        price = hkdRate;
        portfolio.push({
          className,
          symbol: 'HKD',
          price: price,
          units: entry.amount,
          totalValue: itemValue,
          type: 'cash',
          originalAmount: entry.amount
        });
      }

      // Add to chart
      chartLabels.push(entry.symbol);
      chartData.push(parseFloat(itemValue.toFixed(2)));
      chartColors.push(classColorConfig.subColors[i % classColorConfig.subColors.length]);
      chartBorders.push(classColorConfig.dominant);

      classValue += itemValue;
      totalValue += itemValue;
    }

    valueByClass[className] = classValue;
  }

  // Add percentages
  portfolio.forEach(item => {
    item.percentage = ((item.totalValue / totalValue) * 100).toFixed(2);
  });

  // Render everything
  renderTable(portfolio, totalValue);
  renderChart(chartLabels, chartData, chartColors, chartBorders);
  updateSummary(totalValue, valueByClass);
}

// Render holdings table
function renderTable(portfolio, totalValue) {
  const tbody = document.getElementById('holdings-body');
  tbody.innerHTML = '';

  // Group by class
  const grouped = {};
  portfolio.forEach(item => {
    if (!grouped[item.className]) grouped[item.className] = [];
    grouped[item.className].push(item);
  });

  // Class names in order
  const classNames = ['Cash', 'ETFs', 'Playground', 'U.S. Bond'];

  // Render each class
  for (const className of classNames) {
    const items = grouped[className] || [];
    if (items.length === 0) continue;

    // Class header row
    const headerRow = document.createElement('tr');
    headerRow.className = `class-header-${className.replace(/\s+/g, '')}`;
    headerRow.innerHTML = `<td colspan="5">${className}</td>`;
    tbody.appendChild(headerRow);

    // Items in this class
    items.forEach(item => {
      const row = document.createElement('tr');
      
      let priceDisplay = `$${item.price.toFixed(2)}`;
      let unitsDisplay = item.units.toFixed(2);

      if (item.symbol === 'HKD') {
        priceDisplay = `$${item.price.toFixed(4)} (HKD/USD)`;
        unitsDisplay = `HK$${item.units.toFixed(0)}`;
      } else if (item.symbol === 'USD') {
        unitsDisplay = `$${item.units.toFixed(2)}`;
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
  }

  // Total row
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

// Render pie chart with class outlines
function renderChart(labels, data, colors, borders) {
  const ctx = document.getElementById('portfolioChart').getContext('2d');
  
  if (window.portfolioChart instanceof Chart) {
    window.portfolioChart.destroy();
  }

  window.portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 3
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
                text: `${label}: $${data.datasets[0].data[i].toFixed(2)}`,
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
          callbacks: {
            label: function(context) {
              return `$${context.parsed.toFixed(2)}`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// Update summary with class breakdown
function updateSummary(totalValue, valueByClass) {
  const summaryDiv = document.querySelector('.summary');
  let summaryHtml = `
    <div class="summary-item total">
      <span class="label">Total Portfolio Value:</span>
      <span class="value" id="total-value">$${totalValue.toFixed(2)}</span>
    </div>
  `;

  const classNames = ['Cash', 'ETFs', 'Playground', 'U.S. Bond'];
  
  for (const className of classNames) {
    const value = valueByClass[className] || 0;
    const percentage = ((value / totalValue) * 100).toFixed(2);
    const classKey = className.replace(/\s+/g, '');
    summaryHtml += `
      <div class="summary-item class-${classKey}">
        <span class="label">${className}:</span>
        <span class="value">$${value.toFixed(2)} (${percentage}%)</span>
      </div>
    `;
  }

  summaryDiv.innerHTML = summaryHtml;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  buildPortfolio();
});
