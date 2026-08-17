import { useMemo, useState } from "react";

type Point = { lat?: number | null; lng?: number | null };

type TrackingMapProps = {
  destination: Point;
  rider?: Point;
  store?: Point;
  height?: number;
  caption?: string;
};

/**
 * Live-ish map view. Rendered from a server-proxied static map so the Google
 * key never reaches the browser. Coordinates come from the delivery record,
 * so the image refreshes whenever the rider location updates.
 */
export function TrackingMap({ destination, rider, store, height = 240, caption }: TrackingMapProps) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    if (destination.lat == null || destination.lng == null) return null;
    const params = new URLSearchParams({
      lat: String(destination.lat),
      lng: String(destination.lng),
      h: String(Math.min(Math.max(height, 120), 640)),
      w: "640",
      zoom: rider?.lat != null ? "13" : "14",
    });
    if (rider?.lat != null && rider?.lng != null) {
      params.set("riderLat", String(rider.lat));
      params.set("riderLng", String(rider.lng));
    }
    if (store?.lat != null && store?.lng != null) {
      params.set("storeLat", String(store.lat));
      params.set("storeLng", String(store.lng));
    }
    return `/api/public/map?${params.toString()}`;
  }, [destination.lat, destination.lng, rider?.lat, rider?.lng, store?.lat, store?.lng, height]);

  if (!src || failed) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-border bg-muted/40 text-center text-xs text-muted-foreground"
        style={{ height }}
      >
        {src
          ? "Map is unavailable right now. Location updates still appear below."
          : "The map appears here once a delivery location is available."}
      </div>
    );
  }

  return (
    <figure className="space-y-2">
      <img
        src={src}
        alt="Map showing the delivery destination and the rider's latest location"
        loading="lazy"
        className="w-full rounded-xl border border-border object-cover"
        style={{ height }}
        onError={() => setFailed(true)}
      />
      {caption ? <figcaption className="text-xs text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
