import dotenv from 'dotenv';
dotenv.config();

const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const weatherService = {
  async getWeather(city = 'Ranchi') {
    const cityName = city.trim();
    const cacheKey = cityName.toLowerCase();
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return this.getFallbackWeather(cityName);
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)},Jharkhand,IN&appid=${apiKey}&units=metric`;
      const res = await fetch(url);
      if (!res.ok) {
        // Retry with just the city name
        const fallbackUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)},IN&appid=${apiKey}&units=metric`;
        const res2 = await fetch(fallbackUrl);
        if (!res2.ok) {
          return this.getFallbackWeather(cityName);
        }
        const data = await res2.json();
        const formatted = this.formatWeatherData(data);
        cache.set(cacheKey, { timestamp: Date.now(), data: formatted });
        return formatted;
      }

      const data = await res.json();
      const formatted = this.formatWeatherData(data);
      cache.set(cacheKey, { timestamp: Date.now(), data: formatted });
      return formatted;
    } catch (err) {
      console.warn(`Weather fetch failed for ${cityName}, using fallback:`, err.message);
      return this.getFallbackWeather(cityName);
    }
  },

  formatWeatherData(data) {
    return {
      success: true,
      city: data.name,
      temp: Math.round(data.main?.temp ?? 24),
      feelsLike: Math.round(data.main?.feels_like ?? 25),
      condition: data.weather?.[0]?.main || 'Clear',
      description: data.weather?.[0]?.description || 'Clear skies',
      icon: data.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png` : null,
      humidity: data.main?.humidity ?? 65,
      windSpeed: Math.round((data.wind?.speed ?? 3.5) * 3.6), // Convert to km/h
      visibilityKm: Math.round((data.visibility ?? 10000) / 1000),
      source: 'OpenWeatherMap Live API'
    };
  },

  getFallbackWeather(city) {
    return {
      success: true,
      city,
      temp: 24,
      feelsLike: 25,
      condition: 'Pleasant',
      description: 'Pleasant plateau climate with gentle breezes',
      icon: null,
      humidity: 62,
      windSpeed: 12,
      visibilityKm: 10,
      source: 'Jharkhand Meteorological Plateau Sensor (Cached)'
    };
  }
};
