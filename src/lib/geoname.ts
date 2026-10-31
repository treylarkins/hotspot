/**
 * Lightweight reverse geocoder.
 * Maps a lat/lng centroid to the nearest well-known city or region name.
 * No external dependencies — uses a static dataset of ~200 world cities.
 */

interface CityEntry {
  name: string;   // Display name
  lat: number;
  lng: number;
}

// ~200 major world cities covering all continents and news hotspots.
// Sorted by population tier so ties break toward more prominent cities.
const CITIES: CityEntry[] = [
  // East Asia
  { name: "Tokyo", lat: 35.68, lng: 139.69 },
  { name: "Beijing", lat: 39.90, lng: 116.41 },
  { name: "Shanghai", lat: 31.23, lng: 121.47 },
  { name: "Seoul", lat: 37.57, lng: 126.98 },
  { name: "Taipei", lat: 25.05, lng: 121.53 },
  { name: "Hong Kong", lat: 22.32, lng: 114.17 },
  { name: "Osaka", lat: 34.69, lng: 135.50 },
  { name: "Guangzhou", lat: 23.13, lng: 113.26 },
  { name: "Shenzhen", lat: 22.54, lng: 114.06 },
  { name: "Chongqing", lat: 29.56, lng: 106.55 },
  { name: "Chengdu", lat: 30.57, lng: 104.07 },
  { name: "Wuhan", lat: 30.59, lng: 114.30 },
  { name: "Pyongyang", lat: 39.02, lng: 125.75 },
  { name: "Urumqi", lat: 43.82, lng: 87.62 },
  // Southeast Asia
  { name: "Jakarta", lat: -6.21, lng: 106.85 },
  { name: "Manila", lat: 14.60, lng: 120.98 },
  { name: "Bangkok", lat: 13.75, lng: 100.52 },
  { name: "Ho Chi Minh City", lat: 10.82, lng: 106.63 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Kuala Lumpur", lat: 3.14, lng: 101.69 },
  { name: "Yangon", lat: 16.87, lng: 96.19 },
  { name: "Phnom Penh", lat: 11.56, lng: 104.92 },
  { name: "Hanoi", lat: 21.03, lng: 105.85 },
  // South Asia
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Delhi", lat: 28.67, lng: 77.21 },
  { name: "Dhaka", lat: 23.72, lng: 90.41 },
  { name: "Karachi", lat: 24.86, lng: 67.01 },
  { name: "Kolkata", lat: 22.57, lng: 88.36 },
  { name: "Lahore", lat: 31.56, lng: 74.34 },
  { name: "Colombo", lat: 6.93, lng: 79.85 },
  { name: "Kabul", lat: 34.53, lng: 69.17 },
  { name: "Kathmandu", lat: 27.70, lng: 85.32 },
  { name: "Islamabad", lat: 33.72, lng: 73.06 },
  // Central Asia / Russia
  { name: "Moscow", lat: 55.76, lng: 37.62 },
  { name: "Saint Petersburg", lat: 59.95, lng: 30.32 },
  { name: "Novosibirsk", lat: 54.99, lng: 82.90 },
  { name: "Almaty", lat: 43.25, lng: 76.91 },
  { name: "Tashkent", lat: 41.30, lng: 69.24 },
  // Middle East
  { name: "Istanbul", lat: 41.01, lng: 28.95 },
  { name: "Tehran", lat: 35.69, lng: 51.39 },
  { name: "Baghdad", lat: 33.34, lng: 44.40 },
  { name: "Riyadh", lat: 24.69, lng: 46.72 },
  { name: "Dubai", lat: 25.20, lng: 55.27 },
  { name: "Abu Dhabi", lat: 24.47, lng: 54.37 },
  { name: "Doha", lat: 25.29, lng: 51.53 },
  { name: "Kuwait City", lat: 29.37, lng: 47.99 },
  { name: "Muscat", lat: 23.62, lng: 58.59 },
  { name: "Sanaa", lat: 15.35, lng: 44.21 },
  { name: "Beirut", lat: 33.89, lng: 35.50 },
  { name: "Damascus", lat: 33.51, lng: 36.29 },
  { name: "Amman", lat: 31.95, lng: 35.93 },
  { name: "Jerusalem", lat: 31.77, lng: 35.22 },
  { name: "Tel Aviv", lat: 32.08, lng: 34.78 },
  { name: "Ankara", lat: 39.92, lng: 32.86 },
  { name: "Gaza", lat: 31.52, lng: 34.46 },
  // Africa
  { name: "Lagos", lat: 6.52, lng: 3.38 },
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "Kinshasa", lat: -4.32, lng: 15.32 },
  { name: "Nairobi", lat: -1.29, lng: 36.82 },
  { name: "Johannesburg", lat: -26.20, lng: 28.04 },
  { name: "Luanda", lat: -8.84, lng: 13.23 },
  { name: "Dar es Salaam", lat: -6.79, lng: 39.21 },
  { name: "Khartoum", lat: 15.55, lng: 32.53 },
  { name: "Abidjan", lat: 5.34, lng: -4.02 },
  { name: "Cape Town", lat: -33.92, lng: 18.42 },
  { name: "Addis Ababa", lat: 9.02, lng: 38.75 },
  { name: "Mogadishu", lat: 2.05, lng: 45.34 },
  { name: "Tripoli", lat: 32.90, lng: 13.18 },
  { name: "Casablanca", lat: 33.59, lng: -7.62 },
  { name: "Algiers", lat: 36.74, lng: 3.06 },
  { name: "Tunis", lat: 36.82, lng: 10.17 },
  { name: "Accra", lat: 5.56, lng: -0.20 },
  { name: "Kampala", lat: 0.32, lng: 32.58 },
  // Europe
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Paris", lat: 48.85, lng: 2.35 },
  { name: "Berlin", lat: 52.52, lng: 13.40 },
  { name: "Madrid", lat: 40.42, lng: -3.70 },
  { name: "Rome", lat: 41.90, lng: 12.50 },
  { name: "Amsterdam", lat: 52.37, lng: 4.90 },
  { name: "Brussels", lat: 50.85, lng: 4.35 },
  { name: "Vienna", lat: 48.21, lng: 16.37 },
  { name: "Kyiv", lat: 50.45, lng: 30.52 },
  { name: "Warsaw", lat: 52.23, lng: 21.01 },
  { name: "Stockholm", lat: 59.33, lng: 18.07 },
  { name: "Oslo", lat: 59.91, lng: 10.75 },
  { name: "Copenhagen", lat: 55.68, lng: 12.57 },
  { name: "Helsinki", lat: 60.17, lng: 24.94 },
  { name: "Zurich", lat: 47.38, lng: 8.54 },
  { name: "Prague", lat: 50.08, lng: 14.44 },
  { name: "Budapest", lat: 47.50, lng: 19.04 },
  { name: "Bucharest", lat: 44.43, lng: 26.10 },
  { name: "Athens", lat: 37.98, lng: 23.73 },
  { name: "Lisbon", lat: 38.72, lng: -9.14 },
  { name: "Dublin", lat: 53.33, lng: -6.25 },
  { name: "Barcelona", lat: 41.39, lng: 2.15 },
  { name: "Munich", lat: 48.14, lng: 11.58 },
  { name: "Hamburg", lat: 53.55, lng: 10.00 },
  { name: "Frankfurt", lat: 50.11, lng: 8.68 },
  { name: "Milan", lat: 45.46, lng: 9.19 },
  { name: "Minsk", lat: 53.90, lng: 27.56 },
  { name: "Belgrade", lat: 44.80, lng: 20.46 },
  { name: "Kharkiv", lat: 49.99, lng: 36.23 },
  { name: "Zaporizhzhia", lat: 47.84, lng: 35.14 },
  { name: "Mariupol", lat: 47.10, lng: 37.55 },
  // Americas — North
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "Los Angeles", lat: 34.05, lng: -118.24 },
  { name: "Chicago", lat: 41.85, lng: -87.65 },
  { name: "Houston", lat: 29.76, lng: -95.37 },
  { name: "Washington DC", lat: 38.91, lng: -77.04 },
  { name: "Mexico City", lat: 19.43, lng: -99.13 },
  { name: "Toronto", lat: 43.70, lng: -79.42 },
  { name: "Miami", lat: 25.77, lng: -80.19 },
  { name: "San Francisco", lat: 37.77, lng: -122.42 },
  { name: "Seattle", lat: 47.61, lng: -122.33 },
  { name: "Phoenix", lat: 33.45, lng: -112.07 },
  { name: "Philadelphia", lat: 39.95, lng: -75.17 },
  { name: "Dallas", lat: 32.78, lng: -96.80 },
  { name: "Atlanta", lat: 33.75, lng: -84.39 },
  { name: "Boston", lat: 42.36, lng: -71.06 },
  { name: "Guadalajara", lat: 20.67, lng: -103.35 },
  { name: "Monterrey", lat: 25.67, lng: -100.31 },
  { name: "Havana", lat: 23.14, lng: -82.38 },
  { name: "Ottawa", lat: 45.42, lng: -75.69 },
  { name: "Montreal", lat: 45.50, lng: -73.57 },
  { name: "Vancouver", lat: 49.25, lng: -123.12 },
  { name: "New Orleans", lat: 29.95, lng: -90.07 },
  { name: "Port-au-Prince", lat: 18.54, lng: -72.34 },
  // Americas — Central / Caribbean
  { name: "Bogotá", lat: 4.71, lng: -74.07 },
  { name: "Lima", lat: -12.05, lng: -77.04 },
  { name: "Santiago", lat: -33.46, lng: -70.65 },
  { name: "São Paulo", lat: -23.55, lng: -46.63 },
  { name: "Rio de Janeiro", lat: -22.91, lng: -43.17 },
  { name: "Buenos Aires", lat: -34.61, lng: -58.38 },
  { name: "Caracas", lat: 10.48, lng: -66.88 },
  { name: "Montevideo", lat: -34.90, lng: -56.19 },
  { name: "Brasília", lat: -15.78, lng: -47.93 },
  { name: "Quito", lat: -0.22, lng: -78.51 },
  { name: "La Paz", lat: -16.50, lng: -68.15 },
  { name: "Asuncion", lat: -25.29, lng: -57.64 },
  { name: "Managua", lat: 12.13, lng: -86.28 },
  { name: "San José", lat: 9.93, lng: -84.08 },
  { name: "Panama City", lat: 8.99, lng: -79.52 },
  // Pacific / Oceania
  { name: "Sydney", lat: -33.87, lng: 151.21 },
  { name: "Melbourne", lat: -37.81, lng: 144.96 },
  { name: "Auckland", lat: -36.87, lng: 174.77 },
  { name: "Brisbane", lat: -27.47, lng: 153.03 },
  { name: "Perth", lat: -31.95, lng: 115.86 },
  { name: "Suva", lat: -18.14, lng: 178.44 },
];

/** Great-circle distance in degrees (fast approximate using equirectangular) */
function distDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = (lng1 - lng2) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Return the display name of the nearest city to (lat, lng).
 * Falls back to a hemisphere label if no city is within 30 degrees.
 */
export function nearestCity(lat: number, lng: number): string {
  let best = CITIES[0];
  let bestDist = distDeg(lat, lng, best.lat, best.lng);

  for (let i = 1; i < CITIES.length; i++) {
    const d = distDeg(lat, lng, CITIES[i].lat, CITIES[i].lng);
    if (d < bestDist) {
      bestDist = d;
      best = CITIES[i];
    }
  }

  // If nearest is more than 30° away, use a broad regional label instead
  if (bestDist > 30) {
    if (lat > 60) return "Arctic Region";
    if (lat < -60) return "Antarctic Region";
    if (lng > 100 && lat < -10) return "South Pacific";
    return best.name;
  }

  return best.name;
}
