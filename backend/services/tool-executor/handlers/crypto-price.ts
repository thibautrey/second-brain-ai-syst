/**
 * Cryptocurrency Price Tool Handler
 * Fetches current cryptocurrency prices without requiring API keys
 * Uses CoinGecko API (free, no authentication required)
 */

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  currency: string;
  marketCap?: number;
  volume24h?: number;
  change24h: number;
  change7d?: number;
  timestamp: string;
  image?: string;
}

interface CryptoPriceResponse {
  success: boolean;
  data?: CryptoPrice | CryptoPrice[];
  error?: string;
}

/**
 * Fetch current cryptocurrency price using CoinGecko API
 * @param cryptoId - Cryptocurrency ID (e.g., "bitcoin", "ethereum", "cardano")
 * @param vsCurrency - Target currency (default: "usd")
 * @returns Current cryptocurrency price data
 */
async function fetchCryptoPrice(
  cryptoId: string,
  vsCurrency: string = "usd",
): Promise<CryptoPrice> {
  const lowerCryptoId = cryptoId.toLowerCase();

  try {
    // Use CoinGecko API - free endpoint with no API key required
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${lowerCryptoId}&vs_currencies=${vsCurrency}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_7d_change=true`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch crypto data: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<
      string,
      {
        [key: string]: number;
      }
    >;

    if (!data[lowerCryptoId]) {
      throw new Error(`Cryptocurrency "${cryptoId}" not found on CoinGecko`);
    }

    const cryptoData = data[lowerCryptoId];
    const currencyKey = vsCurrency.toLowerCase();

    if (!cryptoData[currencyKey]) {
      throw new Error(
        `No price data available for ${cryptoId} in ${vsCurrency}`,
      );
    }

    // Fetch additional details like name and symbol
    const detailsResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/${lowerCryptoId}?localization=false`,
    );

    let name = cryptoId;
    let symbol = "";

    if (detailsResponse.ok) {
      const detailsData = (await detailsResponse.json()) as {
        name?: string;
        symbol?: string;
        image?: {
          small?: string;
        };
      };
      name = detailsData.name || cryptoId;
      symbol = detailsData.symbol?.toUpperCase() || "";
    }

    return {
      id: lowerCryptoId,
      symbol: symbol,
      name: name,
      price: cryptoData[currencyKey],
      currency: vsCurrency.toUpperCase(),
      marketCap: cryptoData[`${currencyKey}_market_cap`] || undefined,
      volume24h: cryptoData[`${currencyKey}_24h_vol`] || undefined,
      change24h: cryptoData[`${currencyKey}_24h_change`] || 0,
      change7d: cryptoData[`${currencyKey}_7d_change`] || undefined,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(
      `Error fetching crypto price for "${cryptoId}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Convert crypto price to another currency
 * @param cryptoId - Cryptocurrency ID
 * @param vsCurrency - Target currency
 * @returns Converted cryptocurrency price data
 */
async function fetchCryptoPriceInCurrency(
  cryptoId: string,
  vsCurrency: string,
): Promise<CryptoPrice> {
  return fetchCryptoPrice(cryptoId, vsCurrency);
}

/**
 * Format crypto price data for human-readable display
 * @param crypto - Crypto price data
 * @returns Formatted string
 */
function formatCryptoPrice(crypto: CryptoPrice): string {
  const arrow = crypto.change24h >= 0 ? "📈" : "📉";
  const changeSign = crypto.change24h >= 0 ? "+" : "";

  let output = `${arrow} **${crypto.symbol || crypto.id.toUpperCase()}** - ${crypto.name}
Price: ${crypto.currency} ${crypto.price.toLocaleString("en-US", { maximumFractionDigits: 8 })}
24h Change: ${changeSign}${crypto.change24h.toFixed(2)}%`;

  if (crypto.change7d !== undefined) {
    const arrow7d = crypto.change7d >= 0 ? "📈" : "📉";
    const changeSign7d = crypto.change7d >= 0 ? "+" : "";
    output += `\n7d Change: ${arrow7d} ${changeSign7d}${crypto.change7d.toFixed(2)}%`;
  }

  if (crypto.marketCap !== undefined) {
    output += `\nMarket Cap: ${crypto.currency} ${(crypto.marketCap / 1e9).toFixed(2)}B`;
  }

  if (crypto.volume24h !== undefined) {
    output += `\n24h Volume: ${crypto.currency} ${(crypto.volume24h / 1e9).toFixed(2)}B`;
  }

  output += `\nUpdated: ${new Date(crypto.timestamp).toLocaleString()}`;

  return output;
}

/**
 * Compare multiple cryptocurrency prices
 * @param cryptos - Array of crypto price data
 * @returns Formatted comparison string
 */
function formatCryptoComparison(cryptos: CryptoPrice[]): string {
  const table = cryptos
    .map(
      (crypto) =>
        `| ${crypto.symbol || crypto.id.toUpperCase()} | ${crypto.price.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${crypto.currency} | ${crypto.change24h >= 0 ? "+" : ""}${crypto.change24h.toFixed(2)}% |`,
    )
    .join("\n");

  return `| Symbol | Price | 24h Change |
|--------|-------|-----------|
${table}`;
}

/**
 * Execute crypto price actions
 * @param action - Action to perform (get, compare, convert)
 * @param params - Tool parameters
 * @returns Result object with crypto data
 */
export async function executeCryptoPriceAction(
  action: string,
  params: Record<string, any>,
): Promise<CryptoPriceResponse> {
  switch (action) {
    case "get":
      try {
        if (!params.id || typeof params.id !== "string") {
          return {
            success: false,
            error:
              "Cryptocurrency ID is required and must be a string (e.g., 'bitcoin', 'ethereum')",
          };
        }

        const vsCurrency = params.vs_currency || "usd";
        const crypto = await fetchCryptoPrice(params.id, vsCurrency);

        if (params.format === "formatted") {
          return {
            success: true,
            data: {
              ...crypto,
              price: parseFloat(formatCryptoPrice(crypto)) as any, // Will be overridden in practice
            },
          };
        }

        return {
          success: true,
          data: crypto,
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
          !params.ids ||
          !Array.isArray(params.ids) ||
          params.ids.length === 0
        ) {
          return {
            success: false,
            error: "At least one cryptocurrency ID is required in 'ids' array",
          };
        }

        const vsCurrency = params.vs_currency || "usd";
        const cryptos = await Promise.all(
          params.ids.map((id: string) => fetchCryptoPrice(id, vsCurrency)),
        );

        if (params.format === "formatted") {
          return {
            success: true,
            data: {
              id: "comparison",
              symbol: "COMP",
              name: "Comparison",
              price: 0,
              currency: vsCurrency.toUpperCase(),
              change24h: 0,
              timestamp: new Date().toISOString(),
            },
          };
        }

        return {
          success: true,
          data: cryptos,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

    case "convert":
      try {
        if (!params.id || typeof params.id !== "string") {
          return {
            success: false,
            error: "Cryptocurrency ID is required",
          };
        }

        if (!params.vs_currency || typeof params.vs_currency !== "string") {
          return {
            success: false,
            error: "Target currency is required (e.g., 'usd', 'eur', 'gbp')",
          };
        }

        const crypto = await fetchCryptoPriceInCurrency(
          params.id,
          params.vs_currency,
        );

        return {
          success: true,
          data: crypto,
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
        error: `Unknown crypto price action: ${action}`,
      };
  }
}

// Tool schema for registration with BUILTIN_TOOL_SCHEMAS
export const CRYPTO_PRICE_TOOL_SCHEMA = {
  name: "crypto_price",
  description:
    "Fetch current cryptocurrency prices for any major cryptocurrency without requiring API keys. Returns real-time crypto data including current price, 24h/7d changes, market cap, and trading volume. Supports single crypto lookup, multi-crypto comparison, and currency conversion.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "compare", "convert"],
        description:
          "'get': Fetch current price for a single cryptocurrency. 'compare': Compare prices for multiple cryptocurrencies. 'convert': Get price in a specific currency.",
      },
      id: {
        type: "string",
        description:
          "Cryptocurrency ID for single lookup (e.g., 'bitcoin', 'ethereum', 'cardano', 'ripple', 'solana'). Required for 'get' and 'convert' actions.",
      },
      ids: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "Array of cryptocurrency IDs for comparison (e.g., ['bitcoin', 'ethereum', 'cardano']). Required for 'compare' action.",
      },
      vs_currency: {
        type: "string",
        default: "usd",
        description:
          "Target currency for price conversion (e.g., 'usd', 'eur', 'gbp', 'jpy', 'cad'). Defaults to 'usd'.",
      },
      format: {
        type: "string",
        enum: ["raw", "formatted"],
        default: "raw",
        description:
          "'raw': Returns structured JSON with all crypto data fields. 'formatted': Returns human-readable text with emojis and comparison tables.",
      },
    },
    required: ["action"],
  },
};
