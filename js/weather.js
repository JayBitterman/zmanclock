// ============================================================================
// weather.js - Real-time Weather Integration using Open-Meteo API (Free, No Key)
// ============================================================================

import { state } from './config.js';

// Weather state
export const weatherState = {
  temperature: null,        // Celsius
  feelsLike: null,
  weatherCode: null,        // WMO weather code
  cloudCover: 0,            // 0-100%
  precipitation: 0,         // mm/h
  windSpeed: 0,             // km/h
  windDirection: 0,         // degrees (0=N, 90=E, 180=S, 270=W)
  visibility: 10000,        // meters
  isDay: true,
  snowfall: 0,              // cm/h
  timezone: null,           // timezone field
  lastFetch: null,
  error: null
};

// WMO Weather Codes mapping
const WEATHER_CODES = {
  0: 'clear',
  1: 'mainly_clear',
  2: 'partly_cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'depositing_rime_fog',
  51: 'light_drizzle',
  53: 'moderate_drizzle',
  55: 'heavy_drizzle',
  56: 'freezing_drizzle_light',
  57: 'freezing_drizzle_heavy',
  61: 'light_rain',
  63: 'moderate_rain',
  65: 'heavy_rain',
  66: 'freezing_rain_light',
  67: 'freezing_rain_heavy',
  71: 'light_snow',
  73: 'moderate_snow',
  75: 'heavy_snow',
  77: 'snow_grains',
  80: 'light_rain_showers',
  81: 'moderate_rain_showers',
  82: 'violent_rain_showers',
  85: 'light_snow_showers',
  86: 'heavy_snow_showers',
  95: 'thunderstorm',
  96: 'thunderstorm_hail_light',
  99: 'thunderstorm_hail_heavy'
};

/**
 * Process raw API data into the state
 * Exported so Location.js can populate weather data during timezone check
 */
export function processWeatherData(data) {
  const current = data.current;

  weatherState.temperature = current.temperature_2m;
  weatherState.feelsLike = current.apparent_temperature;
  weatherState.weatherCode = current.weather_code;
  weatherState.cloudCover = current.cloud_cover;
  weatherState.precipitation = current.precipitation;
  weatherState.windSpeed = current.wind_speed_10m;
  weatherState.windDirection = current.wind_direction_10m;
  weatherState.snowfall = current.snowfall || 0;
  weatherState.isDay = current.is_day === 1;
  weatherState.timezone = data.timezone; // <--- Capture timezone
  weatherState.lastFetch = Date.now();
  weatherState.error = null;

  // --- NEW LOGGING CODE START ---
    // console.group('🌤️ Open-Meteo Weather Data');
    // console.log(`📍 Timezone:     ${data.timezone} (${data.timezone_abbreviation})`);
    // console.log(`🌡️ Temp:         ${weatherState.temperature}°C (Feels like ${weatherState.feelsLike}°C)`);
    // console.log(`☂️ Precip:       ${weatherState.precipitation} mm/h`);
    // console.log(`❄️ Snow:         ${weatherState.snowfall} cm/h`);
    // console.log(`☁️ Cloud Cover:  ${weatherState.cloudCover}%`);
    // console.log(`💨 Wind:         ${weatherState.windSpeed} km/h (Dir: ${weatherState.windDirection}°)`);
    // console.log(`🌪️ Gusts:        ${current.wind_gusts_10m} km/h`);
    // console.log(`💧 Humidity:     ${current.relative_humidity_2m}%`);
    // console.log(`📝 Code:         ${weatherState.weatherCode} (isDay: ${weatherState.isDay})`);
    // console.log(`⌚ Offset:       ${data.utc_offset_seconds}s`);
    // console.groupEnd();
    // --- NEW LOGGING CODE END ---
  
  // Return for chaining
  return weatherState;
}

/**
 * Fetch weather data from Open-Meteo API
 * Free API, no key required!
 * @param {boolean} force - If true, bypass rate limiting (used on location change)
 */
export async function fetchWeather(force = false) {
  if (state.latitude === null || state.longitude === null) {
    return null;
  }

  // Only fetch every 10 minutes to be respectful
  const now = Date.now();
  if (!force && weatherState.lastFetch && (now - weatherState.lastFetch) < 600000) {
    return weatherState;
  }

  try {
    const params = new URLSearchParams({
      latitude: state.latitude.toFixed(4),
      longitude: state.longitude.toFixed(4),
      current: [
        'temperature_2m',
        'apparent_temperature', 
        'weather_code',
        'cloud_cover',
        'precipitation',
        'wind_speed_10m',
        'snowfall',
        'is_day',
        'relative_humidity_2m',
        'wind_direction_10m',
        'wind_gusts_10m'
      ].join(','),
      timezone: 'auto', // <--- Now requesting timezone
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh'
    });
    
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
        
    // Use the shared processor
    processWeatherData(data);
    
    return weatherState;

  } catch (err) {
    console.warn('Weather fetch failed:', err);
    weatherState.error = err.message;
    return null;
  }
}

/**
 * Get weather condition category for visual effects
 */
export function getWeatherCondition() {
  const code = weatherState.weatherCode;
  if (code === null) return 'clear';
  
  const condition = WEATHER_CODES[code] || 'clear';
  
  // Map to simplified categories for effects
  if (condition.includes('thunder')) return 'thunderstorm';
  if (condition.includes('snow') || condition.includes('freezing')) return 'snow';
  if (condition.includes('rain') || condition.includes('drizzle')) return 'rain';
  if (condition.includes('fog')) return 'fog';
  if (condition.includes('overcast')) return 'overcast';
  if (condition.includes('cloudy')) return 'cloudy';
  
  return 'clear';
}

/**
 * Get precipitation intensity (0 = none, 1 = light, 2 = moderate, 3 = heavy)
 */
export function getPrecipitationIntensity() {
  const code = weatherState.weatherCode;
  if (code === null) return 0;
  
  const condition = WEATHER_CODES[code] || 'clear';
  
  // Thunderstorms always have precipitation
  if (condition.includes('thunder')) {
    if (condition.includes('heavy') || condition.includes('hail')) return 3;
    return 2; // moderate rain for standard thunderstorm
  }
  
  if (condition.includes('heavy') || condition.includes('violent')) return 3;
  if (condition.includes('moderate')) return 2;
  if (condition.includes('light') || condition.includes('drizzle')) return 1;
  if (condition.includes('rain') || condition.includes('snow')) return 2;
  
  return 0;
}

/**
 * Calculate estimated temperature based on latitude and day of year
 * Used as fallback when API is unavailable
 */
export function estimateTemperature(lat, dayOfYear) {
  // Formula: Base temp varies by latitude, with seasonal cosine variation
  // Northern hemisphere peaks around day 200 (mid-July)
  // Southern hemisphere peaks around day 20 (mid-January)
  const peakDay = lat >= 0 ? 200 : 20;
  const temp = (27 - (0.6 * Math.abs(lat))) + 
               ((0.3 * Math.abs(lat)) * Math.cos(0.0172 * (dayOfYear - peakDay)));
  return temp;
}

/**
 * Get the current season based on date and hemisphere
 * Returns: 'spring', 'summer', 'fall', 'winter'
 */
export function getSeason(date, latitude) {
  const checkDate = date || state.date || new Date(); // Priority: Arg -> State -> Now
  const month = checkDate.getMonth();
  const isNorthern = latitude >= 0;
  
  // Northern hemisphere seasons
  const seasons = {
    spring: [2, 3, 4],   // Mar, Apr, May
    summer: [5, 6, 7],   // Jun, Jul, Aug
    fall: [8, 9, 10],    // Sep, Oct, Nov
    winter: [11, 0, 1]   // Dec, Jan, Feb
  };
  
  for (const [season, months] of Object.entries(seasons)) {
    if (months.includes(month)) {
      // Flip for southern hemisphere
      if (!isNorthern) {
        const flip = { spring: 'fall', summer: 'winter', fall: 'spring', winter: 'summer' };
        return flip[season];
      }
      return season;
    }
  }
  
  return 'summer'; // fallback
}

/**
 * Determine if weather conditions should suppress birds
 */
export function shouldSuppressBirds() {
  const condition = getWeatherCondition();
  const suppressConditions = ['rain', 'snow', 'thunderstorm', 'fog'];
  
  if (suppressConditions.includes(condition)) return true;
  if (weatherState.windSpeed > 40) return true; // Very windy
  if (weatherState.temperature !== null && weatherState.temperature < 0) return true; // Freezing
  
  return false;
}

/**
 * Get clothing recommendation for the person based on temperature
 * Returns: 'normal', 'sweater', 'winter_coat'
 */
export function getClothingType() {
  const temp = weatherState.feelsLike ?? weatherState.temperature;
  if (temp === null) return 'normal';
  
  // Ensure we are using Celsius values as intended
  if (temp <= 5) return 'winter_coat';  
  if (temp <= 15) return 'sweater';     
  
  return 'normal';
}

/**
 * Get wind intensity for tree/bush animation
 * Returns multiplier: 1 = normal, 2 = breezy, 3 = windy, 4 = very windy
 */
export function getWindIntensity() {
  const speed = weatherState.windSpeed;
  
  if (speed === null || speed < 10) return 1;
  if (speed < 25) return 2;
  if (speed < 45) return 3;
  return 4;
}