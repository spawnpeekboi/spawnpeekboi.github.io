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
  const container = document.querySelector('.widget-container');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  container.insertBefore(errorDiv, container.querySelector('.widget-header'));
}

// Fetch holdings from JSON file
async function fetchHoldings() {
  try {
    const response = await fetch('holdings.json');
    if (!response.ok) {
      throw new Error('Cannot load holdings.json');
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
      throw new Error(`Invalid symbol: ${symbol}`);
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
    
    return 0.128;
  } catch (error) {
    console.error('Error fetching HKD/USD rate:', error);
    return 0.128;
  }
}

// Get CSS variable colors for a class
function getClassColors(className) {
  const root = document.documentElement;
  const colors = {
    dominant: getComputedStyle(root).getPropertyValue(`--color-${className}-dominant`).trim(),
    subColors: []
  };
  
  for (let i = 0; i < 11; i++) {
    const color = getComputedStyle(root).getPropertyValue(`--color-${className}-sub${i}`).trim();
    if (color) colors.subColors.push(color);
  }
  
  return colors;
}

// Map internal class name to display name
const classDisplayName = {
  'Cash': 'Cash',
  'ETFs': 'ETFs',
  'Playground': 'Playground',
  'Bond': 'U.S. Bond'
};

// Main function to build widget portfolio
async function buildWidgetPortfolio() {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const holdingsData = await fetchHoldings();
  if (Object.keys(holdingsData).length === 0) return;

  let portfolio = [];
  let chartLabels = [];
  let chartData = [];
  let chartColors = [];
  let chartBorders = [];
  let chartBorderWidths = [];
  let chartPercentages = [];
  let valueByClass = {};
  let totalValue = 0;

  // Class names in order
  const classNames = ['Cash', 'ETFs', 'Playground', 'Bond'];
  
  // Process each main class
  for (const className of classNames) {
    const entries = holdingsData[className] || [];
    const classColorConfig = getClassColors(className);
    let classValue = 0;
    let isFirstSegmentInClass = true;

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
      
      // First segment of class gets thicker border
      if (isFirstSegmentInClass) {
        chartBorderWidths.push(6);
        isFirstSegmentInClass = false;
      } else {
        chartBorderWidths.push(3);
      }
      
      classValue += itemValue;
      totalValue += itemValue;
    }

    valueByClass[className] = classValue;
  }

  // Calculate percentages
  portfolio.forEach(item => {
    item.percentage = ((item.totalValue / totalValue) * 100).toFixed(2);
  });

  chartPercentages = portfolio.map(item => item.percentage);

  // Render widget
  renderWidgetChart(chartLabels, chartData, chartColors, chartBorders, chartBorderWidths, chartPercentages);
  renderChartLabels(chartLabels, chartData, chartPercentages, chartColors);
  renderValueWidget(totalValue, valueByClass);
}

// Render pie chart
function renderWidgetChart(labels, data, colors, borders, borderWidths, percentages) {
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
        borderWidth: borderWidths
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#161b22',
          titleColor: '#58a6ff',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              return `$${context.parsed.toFixed(2)} (${percentages[index]}%)`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// Render always-visible chart labels with percentages
function renderChartLabels(labels, data, percentages, colors) {
  const labelsContainer = document.getElementById('chartLabels');
  labelsContainer.innerHTML = '';

  labels.forEach((label, index) => {
    const labelItem = document.createElement('div');
    labelItem.className = 'chart-label-item';
    labelItem.innerHTML = `
      <span class="chart-label-color" style="background-color: ${colors[index]}"></span>
      <span class="chart-label-text">${label}</span>
      <span class="chart-label-percent">${percentages[index]}%</span>
    `;
    labelsContainer.appendChild(labelItem);
  });
}

// Render total value widget with class breakdown
function renderValueWidget(totalValue, valueByClass) {
  document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;

  const breakdownContainer = document.getElementById('classBreakdown');
  breakdownContainer.innerHTML = '';

  const classNames = ['Cash', 'ETFs', 'Playground', 'Bond'];
  
  for (const className of classNames) {
    const value = valueByClass[className] || 0;
    const percentage = ((value / totalValue) * 100).toFixed(2);
    
    const breakdownItem = document.createElement('div');
    breakdownItem.className = `breakdown-item class-${className}`;
    breakdownItem.innerHTML = `
      <span class="breakdown-item-label">${classDisplayName[className]}</span>
      <span class="breakdown-item-value">$${value.toFixed(2)}</span>
    `;
    breakdownContainer.appendChild(breakdownItem);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  buildWidgetPortfolio();
});