/**
 * Weather Tool Handler
 * Fetches current weather data for any location without requiring API keys
 * Uses Open-Meteo.com (free, no authentication required)
 */

interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  weatherDescription: string;
  humidity: number;
  precipitation: number;
  cloudCover: number;
  isDay: boolean;
  timestamp: string;
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

interface WeatherResponse {
  location: LocationCoordinates;
  current: WeatherData;
  timezone: string;
}

/**
 * Get coordinates for a city using Open-Meteo Geocoding API
 * @param city - City name (e.g., "Paris", "New York")
 * @returns Location coordinates
 */
async function getLocationCoordinates(
  city: string,
): Promise<LocationCoordinates> {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch location: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      results:
        | Array<{
            latitude: number;
            longitude: number;
            name: string;
            country?: string;
          }>
        | undefined;
    };

    if (!data.results || data.results.length === 0) {
      throw new Error(`City not found: ${city}`);
    }

    const result = data.results[0];

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      city: result.name,
      country: result.country || "",
    };
  } catch (error) {
    throw new Error(
      `Error fetching location for "${city}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Convert WMO weather codes to human-readable descriptions
 * @param code - WMO weather code
 * @param isDay - Whether it's daytime
 * @returns Description of the weather
 */
function getWeatherDescription(code: number, isDay: boolean): string {
  const weatherCodes: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  return weatherCodes[code] || "Unknown weather";
}

/**
 * Fetch current weather for a given city
 * @param city - City name (e.g., "Paris", "Tokyo")
 * @returns Current weather data including temperature, conditions, and more
 */
async function getWeather(city: string): Promise<WeatherResponse> {
  try {
    // Step 1: Get location coordinates
    const location = await getLocationCoordinates(city);

    // Step 2: Fetch weather data
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation,cloud_cover&timezone=auto`,
    );

    if (!weatherResponse.ok) {
      throw new Error(`Failed to fetch weather: ${weatherResponse.statusText}`);
    }

    const weatherData = (await weatherResponse.json()) as {
      current: {
        temperature_2m: number;
        wind_speed_10m: number;
        weather_code: number;
        relative_humidity_2m: number;
        is_day: number;
        precipitation: number;
        cloud_cover: number;
        time: string;
      };
      timezone: string;
    };
    const current = weatherData.current;

    return {
      location,
      current: {
        temperature: current.temperature_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        weatherDescription: getWeatherDescription(
          current.weather_code,
          current.is_day === 1,
        ),
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation,
        cloudCover: current.cloud_cover,
        isDay: current.is_day === 1,
        timestamp: current.time,
      },
      timezone: weatherData.timezone,
    };
  } catch (error) {
    throw new Error(
      `Error fetching weather: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Format weather data into a human-readable string
 * @param weather - Weather response data
 * @returns Formatted weather string
 */
function formatWeather(weather: WeatherResponse): string {
  const { location, current, timezone } = weather;

  return `
🌍 Weather in ${location.city}, ${location.country}
📍 Coordinates: ${current.isDay ? "☀️" : "🌙"} (${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°)
🌡️ Temperature: ${current.temperature}°C
💨 Wind Speed: ${current.windSpeed} km/h
💧 Humidity: ${current.humidity}%
🌧️ Precipitation: ${current.precipitation} mm
☁️ Cloud Cover: ${current.cloudCover}%
🌤️ Condition: ${current.weatherDescription}
🕐 Time: ${current.timestamp}
⏰ Timezone: ${timezone}
  `.trim();
}

/**
 * Tool action executor - called by tool-executor
 * @param action - The action to perform (only "get" is supported)
 * @param params - Tool parameters
 * @returns Result object with weather data
 */
export async function executeWeatherAction(
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "get":
      try {
        if (!params.city || typeof params.city !== "string") {
          throw new Error("City name is required and must be a string");
        }

        const weather = await getWeather(params.city);

        if (params.format === "formatted") {
          return {
            success: true,
            data: formatWeather(weather),
          };
        }

        return {
          success: true,
          data: weather,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

    default:
      throw new Error(`Unknown weather action: ${action}`);
  }
}

// Tool schema for registration with BUILTIN_TOOL_SCHEMAS
export const WEATHER_TOOL_SCHEMA = {
  name: "weather",
  description:
    "Fetch current weather data for any city worldwide without requiring API keys. Uses free Open-Meteo API. Returns temperature, humidity, wind speed, precipitation, and weather conditions. Supports both structured and human-readable output formats.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get"],
        description: "'get': Fetch current weather for a city",
      },
      city: {
        type: "string",
        description:
          "Name of the city to get weather for (e.g., 'Paris', 'Tokyo', 'New York', 'London'). City name will be automatically geocoded to get coordinates.",
      },
      format: {
        type: "string",
        enum: ["raw", "formatted"],
        default: "formatted",
        description:
          "'raw': Returns structured JSON with all weather data fields. 'formatted': Returns human-readable text with emojis and organized information.",
      },
    },
    required: ["action", "city"],
  },
};
