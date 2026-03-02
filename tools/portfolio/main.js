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
setInterval(renderPortfolio, 5 * 60 * 1000);
