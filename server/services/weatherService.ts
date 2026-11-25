import type { WeatherForecastDay, WeatherResponse } from '../../src/types.ts';

interface LocationCoord {
  name: string;
  state: string;
  lat: number;
  lon: number;
}

export const AGRI_LOCATIONS: LocationCoord[] = [
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567 },
  { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lon: 73.7898 },
  { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lon: 79.0882 },
  { name: 'Akola', state: 'Maharashtra', lat: 20.7002, lon: 77.0082 },
  { name: 'Kolhapur', state: 'Maharashtra', lat: 16.705, lon: 74.2433 },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lon: 75.8577 },
  { name: 'Ludhiana', state: 'Punjab', lat: 30.901, lon: 75.8573 },
  { name: 'Karnal', state: 'Haryana', lat: 29.6857, lon: 76.9905 },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873 },
  { name: 'Guntur', state: 'Andhra Pradesh', lat: 16.3067, lon: 80.4365 },
];

interface CachedWeather {
  data: WeatherResponse;
  expiresAt: number;
}

const weatherCache = new Map<string, CachedWeather>();

function wmoCodeToText(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Fog / Mist';
  if (code >= 51 && code <= 57) return 'Light Drizzle';
  if (code >= 61 && code <= 67) return 'Rain Showers';
  if (code >= 80 && code <= 82) return 'Heavy Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Moderate Clouds';
}

function buildAgrometAdvisory(
  temp: number,
  humidity: number,
  windKmh: number,
  rainProb: number,
  precipMm: number
): { en: string; hi: string; mr: string } {
  if (rainProb >= 60 || precipMm >= 2) {
    return {
      en: 'High rain chance ahead. Avoid foliar pesticide or fertilizer spraying today, and clear field drainage channels to prevent waterlogging in cotton and soybean.',
      hi: 'बारिश की अधिक संभावना है। आज कीटनाशक या उर्वरक का छिड़काव टालें और कपास व सोयाबीन के खेतों में जल निकासी की नालियां साफ रखें।',
      mr: 'पावसाची शक्यता जास्त आहे. आज फवारणी टाळावी आणि कापूस व सोयाबीन पिकांत पाणी साचू नये म्हणून निचऱ्याचे चर मोकळे ठेवावेत.',
    };
  }
  if (windKmh >= 15) {
    return {
      en: `Wind speed is ${windKmh.toFixed(0)} km/h. Avoid pesticide spraying during high winds to prevent chemical drift; schedule spraying in calm early morning hours.`,
      hi: `हवा की गति ${windKmh.toFixed(0)} किमी/घंटा है। तेज हवा में छिड़काव न करें ताकि दवा उड़कर नष्ट न हो; शांत सुबह के समय छिड़काव करें।`,
      mr: `वाऱ्याचा वेग ${windKmh.toFixed(0)} किमी/तास आहे. जोरदार वाऱ्यात फवारणी करू नये; शांत सकाळच्या वेळेतच फवारणी करावी.`,
    };
  }
  if (humidity >= 80) {
    return {
      en: `High humidity (${humidity}%). Monitor crops closely for fungal leaf spot, blight, and sucking pests; ensure proper field aeration.`,
      hi: `नमी अधिक (${humidity}%) है। फफूंद जनित रोग और रस चूसक कीटों की नियमित निगरानी करें।`,
      mr: `हवेतील आर्द्रता जास्त (${humidity}%) आहे. बुरशीजन्य रोग व रस शोषक किडींवर नियमित लक्ष ठेवावे.`,
    };
  }
  if (temp >= 36) {
    return {
      en: `High daytime heat (${temp.toFixed(1)}°C). Provide light evening irrigation at critical growth stages and apply organic mulch to conserve soil moisture.`,
      hi: `तापमान अधिक (${temp.toFixed(1)}°C) है। मिट्टी की नमी बचाने के लिए शाम को हल्की सिंचाई और मल्चिंग करें।`,
      mr: `तापमान जास्त (${temp.toFixed(1)}°C) आहे. जमिनीतील ओलावा टिकवण्यासाठी संध्याकाळी हलके पाणी द्यावे व आच्छादन करावे.`,
    };
  }
  return {
    en: 'Weather conditions are favorable for routine field operations, weeding, and morning spraying if pest count crosses threshold.',
    hi: 'मौसम खेती के नियमित कार्यों, निराई-गुड़ाई और आवश्यकता होने पर सुबह छिड़काव के लिए अनुकूल है।',
    mr: 'शेतातील नियमित कामे, खुरपणी आणि गरज असल्यास सकाळच्या वेळी फवारणीसाठी हवामान अनुकूल आहे.',
  };
}

export function resolveLocation(queryName?: string): LocationCoord {
  if (!queryName) return AGRI_LOCATIONS[0];
  const lower = queryName.trim().toLowerCase();
  const match = AGRI_LOCATIONS.find(
    (loc) => loc.name.toLowerCase() === lower || lower.includes(loc.name.toLowerCase())
  );
  return match || AGRI_LOCATIONS[0];
}

export async function getWeatherForLocation(locationQuery?: string): Promise<WeatherResponse> {
  const loc = resolveLocation(locationQuery);
  const cacheKey = loc.name.toLowerCase();
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=5`;

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Open-Meteo API responded with status ${response.status}`);
  }

  const json = (await response.json()) as {
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      precipitation: number;
      weather_code: number;
      wind_speed_10m: number;
      time: string;
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
    };
  };

  const forecast: WeatherForecastDay[] = json.daily.time.map((date, idx) => ({
    date,
    tempMax: json.daily.temperature_2m_max[idx],
    tempMin: json.daily.temperature_2m_min[idx],
    rainProb: json.daily.precipitation_probability_max[idx] ?? 0,
    weatherCode: json.daily.weather_code[idx],
    condition: wmoCodeToText(json.daily.weather_code[idx]),
  }));

  const todayRainProb = forecast[0]?.rainProb ?? 0;
  const advisory = buildAgrometAdvisory(
    json.current.temperature_2m,
    json.current.relative_humidity_2m,
    json.current.wind_speed_10m,
    todayRainProb,
    json.current.precipitation
  );

  const weatherData: WeatherResponse = {
    location: loc.name,
    state: loc.state,
    latitude: loc.lat,
    longitude: loc.lon,
    temperatureC: json.current.temperature_2m,
    humidityPercent: json.current.relative_humidity_2m,
    windSpeedKmh: json.current.wind_speed_10m,
    condition: wmoCodeToText(json.current.weather_code),
    weatherCode: json.current.weather_code,
    precipitationMm: json.current.precipitation,
    forecast,
    advisory,
    lastUpdated: new Date().toISOString(),
    source: 'Open-Meteo Live Weather API',
  };

  weatherCache.set(cacheKey, {
    data: weatherData,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  return weatherData;
}
