const fallbackStoreLat = 14.5995;
const fallbackStoreLng = 120.9842;

function parseCoordinate(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export const storeLocation = {
  lat: parseCoordinate(process.env.NEXT_PUBLIC_STORE_LAT, fallbackStoreLat),
  lng: parseCoordinate(process.env.NEXT_PUBLIC_STORE_LNG, fallbackStoreLng),
};

const earthRadiusKm = 6371;
const baseDeliveryFee = 40;
const baseDistanceKm = 2;
const extraFeePerKm = 10;
const maxDeliveryDistanceKm = 12;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function hasDeliveryCoordinates(
  lat: number | null,
  lng: number | null
) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

export function getDeliveryDistanceKm(lat: number, lng: number) {
  if (
    !hasDeliveryCoordinates(lat, lng) ||
    !hasDeliveryCoordinates(storeLocation.lat, storeLocation.lng)
  ) {
    return null;
  }

  const latDelta = toRadians(lat - storeLocation.lat);
  const lngDelta = toRadians(lng - storeLocation.lng);
  const originLat = toRadians(storeLocation.lat);
  const destinationLat = toRadians(lat);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(lngDelta / 2) ** 2;

  const distanceKm =
    earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Number.isFinite(distanceKm) ? distanceKm : null;
}

export function getDistanceBasedDeliveryFee(lat: number, lng: number) {
  const distanceKm = getDeliveryDistanceKm(lat, lng);

  if (distanceKm === null) {
    return {
      distanceKm: null,
      fee: null,
      isDeliverable: false,
      maxDeliveryDistanceKm,
    };
  }

  if (distanceKm > maxDeliveryDistanceKm) {
    return {
      distanceKm,
      fee: null,
      isDeliverable: false,
      maxDeliveryDistanceKm,
    };
  }

  const extraDistanceKm = Math.max(0, distanceKm - baseDistanceKm);
  const fee =
    baseDeliveryFee + Math.ceil(extraDistanceKm) * extraFeePerKm;

  return {
    distanceKm,
    fee,
    isDeliverable: true,
    maxDeliveryDistanceKm,
  };
}
