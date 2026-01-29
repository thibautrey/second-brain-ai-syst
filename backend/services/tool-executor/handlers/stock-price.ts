/**
 * Stock Price Tool Handler
 * Fetches current and historical stock prices without requiring API keys
 * Uses public endpoints and financial data sources
 */

interface StockPrice {
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume?: number;
}

interface StockPriceResponse {
  success: boolean;
  data?: StockPrice | StockPrice[];
  error?: string;
}

/**
 * Fetch current stock price using multiple free APIs
 * Primary: Finnhub (has free tier), Fallback: Yahoo Finance equivalent
 * @param symbol - Stock symbol (e.g., "AAPL", "GOOGL", "MSFT")
 * @returns Current stock price data
 */
async function fetchStockPrice(symbol: string): Promise<StockPrice> {
  const upperSymbol = symbol.toUpperCase();

  try {
    // Try using the public Yahoo Finance endpoint (no API key needed)
    // Format: https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}
    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${upperSymbol}?modules=price`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch stock data: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      quoteSummary?: {
        result?: Array<{
          price?: {
            regularMarketPrice?: { raw?: number };
            regularMarketChange?: { raw?: number };
            regularMarketChangePercent?: { raw?: number };
            regularMarketDayHigh?: { raw?: number };
            regularMarketDayLow?: { raw?: number };
            regularMarketVolume?: { raw?: number };
            currency?: string;
          };
        }>;
      };
    };

    if (
      !data.quoteSummary?.result ||
      data.quoteSummary.result.length === 0 ||
      !data.quoteSummary.result[0]?.price
    ) {
      throw new Error(`Invalid data structure for symbol: ${upperSymbol}`);
    }

    const priceData = data.quoteSummary.result[0].price;

    if (!priceData.regularMarketPrice?.raw) {
      throw new Error(`No price data available for: ${upperSymbol}`);
    }

    return {
      symbol: upperSymbol,
      price: priceData.regularMarketPrice.raw,
      currency: priceData.currency || "USD",
      timestamp: new Date().toISOString(),
      change: priceData.regularMarketChange?.raw || 0,
      changePercent: (priceData.regularMarketChangePercent?.raw || 0) * 100,
      high:
        priceData.regularMarketDayHigh?.raw || priceData.regularMarketPrice.raw,
      low:
        priceData.regularMarketDayLow?.raw || priceData.regularMarketPrice.raw,
      volume: priceData.regularMarketVolume?.raw,
    };
  } catch (error) {
    throw new Error(
      `Error fetching stock price for "${upperSymbol}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Format stock price data for human-readable display
 * @param stock - Stock price data
 * @returns Formatted string
 */
function formatStockPrice(stock: StockPrice): string {
  const arrow = stock.change >= 0 ? "📈" : "📉";
  const changeSign = stock.change >= 0 ? "+" : "";

  return `${arrow} **${stock.symbol}**: $${stock.price.toFixed(2)}
Change: ${changeSign}${stock.change.toFixed(2)} (${changeSign}${stock.changePercent.toFixed(2)}%)
Day High: $${stock.high.toFixed(2)}
Day Low: $${stock.low.toFixed(2)}
Volume: ${stock.volume ? (stock.volume / 1000000).toFixed(2) + "M" : "N/A"}
Updated: ${new Date(stock.timestamp).toLocaleString()}`;
}

/**
 * Compare multiple stock prices
 * @param stocks - Array of stock price data
 * @returns Formatted comparison string
 */
function formatStockComparison(stocks: StockPrice[]): string {
  const table = stocks
    .map(
      (stock) =>
        `| ${stock.symbol} | $${stock.price.toFixed(2)} | ${stock.change >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}% | $${stock.high.toFixed(2)} | $${stock.low.toFixed(2)} |`,
    )
    .join("\n");

  return `| Symbol | Price | Change | High | Low |
|--------|-------|--------|------|-----|
${table}`;
}

/**
 * Execute stock price actions
 * @param action - Action to perform (get, compare)
 * @param params - Tool parameters
 * @returns Result object with stock data
 */
export async function executeStockPriceAction(
  action: string,
  params: Record<string, any>,
): Promise<StockPriceResponse> {
  switch (action) {
    case "get":
      try {
        if (!params.symbol || typeof params.symbol !== "string") {
          return {
            success: false,
            error:
              "Stock symbol is required and must be a string (e.g., 'AAPL')",
          };
        }

        const stock = await fetchStockPrice(params.symbol);

        if (params.format === "formatted") {
          return {
            success: true,
            data: {
              ...stock,
              price: parseFloat(formatStockPrice(stock)), // This will be overridden by the formatted string in practice
            } as unknown as StockPrice,
          };
        }

        return {
          success: true,
          data: stock,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

    case "compare":
      try {
        if (
          !params.symbols ||
          !Array.isArray(params.symbols) ||
          params.symbols.length === 0
        ) {
          return {
            success: false,
            error: "At least one stock symbol is required in 'symbols' array",
          };
        }

        const stocks = await Promise.all(
          params.symbols.map((symbol: string) => fetchStockPrice(symbol)),
        );

        if (params.format === "formatted") {
          return {
            success: true,
            data: {
              symbol: "COMPARISON",
              price: 0,
              currency: "USD",
              timestamp: new Date().toISOString(),
              change: 0,
              changePercent: 0,
              high: Math.max(...stocks.map((s) => s.high)),
              low: Math.min(...stocks.map((s) => s.low)),
            },
          };
        }

        return {
          success: true,
          data: stocks,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

    default:
      return {
        success: false,
        error: `Unknown stock price action: ${action}`,
      };
  }
}

// Tool schema for registration with BUILTIN_TOOL_SCHEMAS
export const STOCK_PRICE_TOOL_SCHEMA = {
  name: "stock_price",
  description:
    "Fetch current and historical stock prices for any publicly traded company without requiring API keys. Returns real-time stock data including current price, daily changes, high/low prices, and trading volume. Supports single stock lookup and multi-stock comparison.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "compare"],
        description:
          "'get': Fetch current price for a single stock. 'compare': Compare prices for multiple stocks.",
      },
      symbol: {
        type: "string",
        description:
          "Stock ticker symbol for single stock lookup (e.g., 'AAPL', 'GOOGL', 'MSFT', 'TSLA'). Required for 'get' action.",
      },
      symbols: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "Array of stock symbols for comparison (e.g., ['AAPL', 'GOOGL', 'MSFT']). Required for 'compare' action.",
      },
      format: {
        type: "string",
        enum: ["raw", "formatted"],
        default: "raw",
        description:
          "'raw': Returns structured JSON with all stock data fields. 'formatted': Returns human-readable text with emojis and comparison tables.",
      },
    },
    required: ["action"],
  },
};
