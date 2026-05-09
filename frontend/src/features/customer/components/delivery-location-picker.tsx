"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, MapPin } from "lucide-react";

type LeafletLatLng = {
  lat: number;
  lng: number;
};

type LeafletMap = {
  setView: (coords: [number, number], zoom?: number) => LeafletMap;
  on: (
    event: "click",
    handler: (event: { latlng: LeafletLatLng }) => void
  ) => LeafletMap;
  remove: () => void;
  invalidateSize: () => void;
};

type LeafletMarker = {
  setLatLng: (coords: [number, number]) => LeafletMarker;
  getLatLng: () => LeafletLatLng;
  on: (event: "dragend", handler: () => void) => LeafletMarker;
  addTo: (map: LeafletMap) => LeafletMarker;
};

type LeafletApi = {
  map: (container: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (
    url: string,
    options: Record<string, unknown>
  ) => { addTo: (map: LeafletMap) => unknown };
  marker: (
    coords: [number, number],
    options?: Record<string, unknown>
  ) => LeafletMarker;
};

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

type DeliveryLocationPickerProps = {
  lat: number | null;
  lng: number | null;
  onChange: (location: {
    lat: number | null;
    lng: number | null;
    address?: string;
  }) => void;
};

type ReverseGeocodeResponse = {
  display_name?: string;
};

const leafletCssUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const leafletScriptUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const defaultCenter: [number, number] = [14.5995, 120.9842];

function isValidCoordinate(lat: number | null, lng: number | null) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function loadLeaflet() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet needs a browser."));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  const existingCss = document.getElementById("kadaserve-leaflet-css");
  if (!existingCss) {
    const link = document.createElement("link");
    link.id = "kadaserve-leaflet-css";
    link.rel = "stylesheet";
    link.href = leafletCssUrl;
    document.head.appendChild(link);
  }

  return new Promise<LeafletApi>((resolve, reject) => {
    const existingScript = document.getElementById(
      "kadaserve-leaflet-script"
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.L) {
          resolve(window.L);
        } else {
          reject(new Error("Leaflet did not load."));
        }
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Leaflet failed to load."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "kadaserve-leaflet-script";
    script.src = leafletScriptUrl;
    script.async = true;
    script.onload = () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error("Leaflet did not load."));
      }
    };
    script.onerror = () => reject(new Error("Leaflet failed to load."));
    document.body.appendChild(script);
  });
}

function buildMapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

async function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({
    format: "json",
    lat: String(lat),
    lon: String(lng),
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      "Accept-Language": "en",
    },
  });

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as ReverseGeocodeResponse;

  return result.display_name?.trim() || null;
}

export function DeliveryLocationPicker({
  lat,
  lng,
  onChange,
}: DeliveryLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialLatRef = useRef(lat);
  const initialLngRef = useRef(lng);
  const reverseLookupTimerRef = useRef<number | null>(null);
  const reverseLookupIdRef = useRef(0);
  const [loadError, setLoadError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isFindingAddress, setIsFindingAddress] = useState(false);
  const hasPin = isValidCoordinate(lat, lng);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  function publishPinnedLocation(latValue: number, lngValue: number) {
    onChangeRef.current({
      lat: latValue,
      lng: lngValue,
    });
  }

  const updateAddressFromCoordinates = useCallback(
    async (latValue: number, lngValue: number, lookupId: number) => {
      setIsFindingAddress(true);
      setLoadError("");

      try {
        const address = await reverseGeocode(latValue, lngValue);

        if (reverseLookupIdRef.current !== lookupId) {
          return;
        }

        if (!address) {
          setLoadError("Pin moved, but no readable address was found.");
          return;
        }

        onChangeRef.current({
          lat: latValue,
          lng: lngValue,
          address,
        });
      } catch {
        if (reverseLookupIdRef.current === lookupId) {
          setLoadError("Pin moved, but address lookup was not available.");
        }
      } finally {
        if (reverseLookupIdRef.current === lookupId) {
          setIsFindingAddress(false);
        }
      }
    },
    []
  );

  const handlePinnedLocationChange = useCallback((latValue: number, lngValue: number) => {
    const nextLat = Number(latValue.toFixed(6));
    const nextLng = Number(lngValue.toFixed(6));

    publishPinnedLocation(nextLat, nextLng);

    if (reverseLookupTimerRef.current) {
      window.clearTimeout(reverseLookupTimerRef.current);
    }

    const lookupId = reverseLookupIdRef.current + 1;
    reverseLookupIdRef.current = lookupId;
    setIsFindingAddress(true);
    setLoadError("");

    reverseLookupTimerRef.current = window.setTimeout(() => {
      void updateAddressFromCoordinates(nextLat, nextLng, lookupId);
    }, 350);
  }, [updateAddressFromCoordinates]);

  useEffect(() => {
    let isMounted = true;

    async function initializeMap() {
      try {
        const leaflet = await loadLeaflet();

        if (!isMounted || !containerRef.current || mapRef.current) {
          return;
        }

        const initialHasPin = isValidCoordinate(
          initialLatRef.current,
          initialLngRef.current
        );
        const start: [number, number] = initialHasPin
          ? [initialLatRef.current as number, initialLngRef.current as number]
          : defaultCenter;
        const map = leaflet.map(containerRef.current, {
          scrollWheelZoom: false,
        });

        map.setView(start, initialHasPin ? 17 : 12);
        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "OpenStreetMap contributors",
          })
          .addTo(map);

        const marker = leaflet
          .marker(start, {
            draggable: true,
          })
          .addTo(map);

        marker.on("dragend", () => {
          const markerPosition = marker.getLatLng();
          handlePinnedLocationChange(markerPosition.lat, markerPosition.lng);
        });

        map.on("click", (event) => {
          marker.setLatLng([event.latlng.lat, event.latlng.lng]);
          handlePinnedLocationChange(event.latlng.lat, event.latlng.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;

        window.setTimeout(() => map.invalidateSize(), 150);
      } catch {
        if (isMounted) {
          setLoadError("Map could not load. You can still place the order.");
        }
      }
    }

    initializeMap();

    return () => {
      isMounted = false;
      if (reverseLookupTimerRef.current) {
        window.clearTimeout(reverseLookupTimerRef.current);
        reverseLookupTimerRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [handlePinnedLocationChange]);

  useEffect(() => {
    if (!hasPin || !mapRef.current || !markerRef.current) {
      return;
    }

    const nextPosition: [number, number] = [lat as number, lng as number];
    markerRef.current.setLatLng(nextPosition);
    mapRef.current.setView(nextPosition, 17);
  }, [hasPin, lat, lng]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLoadError("Current location is not available in this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLat = Number(position.coords.latitude.toFixed(6));
        const nextLng = Number(position.coords.longitude.toFixed(6));
        const lookupId = reverseLookupIdRef.current + 1;
        reverseLookupIdRef.current = lookupId;
        setIsFindingAddress(true);

        try {
          const address = await reverseGeocode(nextLat, nextLng);

          if (reverseLookupIdRef.current !== lookupId) {
            return;
          }

          onChange({
            lat: nextLat,
            lng: nextLng,
            address: address ?? undefined,
          });
        } catch {
          if (reverseLookupIdRef.current === lookupId) {
            onChange({
              lat: nextLat,
              lng: nextLng,
            });
            setLoadError("Pin saved, but address lookup was not available.");
          }
        } finally {
          if (reverseLookupIdRef.current === lookupId) {
            setIsFindingAddress(false);
          }

          setIsLocating(false);
        }
      },
      () => {
        setLoadError("Location permission was not allowed.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="relative z-0 mt-3 overflow-hidden rounded-[18px] border border-[#D8C8A7] bg-white/65 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7F1E6] text-[#0D2E18]">
            <MapPin size={17} />
          </span>
          <div>
            <p className="font-sans text-sm font-black text-[#0D2E18]">
              Delivery Pin
            </p>
            <p className="font-sans text-xs font-semibold text-[#684B35]">
              {isFindingAddress ? "Updating address..." : "Tap the map or drag the pin."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={isLocating || isFindingAddress}
          className="inline-flex items-center gap-2 rounded-full border border-[#D8C8A7] bg-[#FFF8EF] px-3 py-2 font-sans text-xs font-bold text-[#0D2E18] disabled:cursor-wait disabled:opacity-60"
        >
          <Crosshair size={14} />
          {isLocating
            ? "Locating..."
            : isFindingAddress
            ? "Finding address..."
            : "Use Current"}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative isolate z-0 mt-3 h-56 overflow-hidden rounded-[16px] border border-[#E3D3B7] bg-[#FFF8EF] sm:h-64 [&_.leaflet-bottom]:!z-[2] [&_.leaflet-control]:!z-[2] [&_.leaflet-control-container]:!z-[2] [&_.leaflet-map-pane]:!z-0 [&_.leaflet-marker-icon]:!z-[1] [&_.leaflet-marker-shadow]:!z-[1] [&_.leaflet-pane]:!z-0 [&_.leaflet-popup-pane]:!z-[3] [&_.leaflet-shadow-pane]:!z-0 [&_.leaflet-tile-pane]:!z-0 [&_.leaflet-top]:!z-[2] [&_.leaflet-tooltip-pane]:!z-[3]"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-sans text-xs font-semibold text-[#684B35]">
        <span>
          {hasPin
            ? `Pinned at ${lat?.toFixed(5)}, ${lng?.toFixed(5)}`
            : "No pin selected yet."}
        </span>

        {hasPin ? (
          <a
            href={buildMapUrl(lat as number, lng as number)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[#0D2E18]"
          >
            Open map
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>

      {loadError ? (
        <p className="mt-2 rounded-[12px] bg-[#FFF0DA] px-3 py-2 font-sans text-xs font-semibold text-[#684B35]">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}
