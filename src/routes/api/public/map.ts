import { createFileRoute } from "@tanstack/react-router";

/**
 * Static map image proxy. The Google key stays on the server; the browser only
 * ever sees coordinates it already has. Inputs are strictly validated and the
 * response contains no user data.
 */
const num = (value: string | null, min: number, max: number): number | null => {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 1e6) / 1e6;
};

export const Route = createFileRoute("/api/public/map")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env["GOOGLE_API_KEY"];
        if (!key) return new Response("Map not configured", { status: 503 });

        const url = new URL(request.url);
        const lat = num(url.searchParams.get("lat"), -90, 90);
        const lng = num(url.searchParams.get("lng"), -180, 180);
        if (lat === null || lng === null) {
          return new Response("Invalid coordinates", { status: 400 });
        }
        const riderLat = num(url.searchParams.get("riderLat"), -90, 90);
        const riderLng = num(url.searchParams.get("riderLng"), -180, 180);
        const storeLat = num(url.searchParams.get("storeLat"), -90, 90);
        const storeLng = num(url.searchParams.get("storeLng"), -180, 180);
        const zoom = Math.min(Math.max(Number(url.searchParams.get("zoom") ?? 13) || 13, 3), 18);
        const width = Math.min(Math.max(Number(url.searchParams.get("w") ?? 640) || 640, 160), 640);
        const height = Math.min(Math.max(Number(url.searchParams.get("h") ?? 300) || 300, 120), 640);

        const params = new URLSearchParams({
          size: `${width}x${height}`,
          scale: "2",
          maptype: "roadmap",
          zoom: String(zoom),
          key,
        });
        params.append("markers", `color:0x2563eb|label:D|${lat},${lng}`);
        if (storeLat !== null && storeLng !== null) {
          params.append("markers", `color:0x16a34a|label:S|${storeLat},${storeLng}`);
        }
        if (riderLat !== null && riderLng !== null) {
          params.append("markers", `color:0xf59e0b|label:R|${riderLat},${riderLng}`);
          params.append("path", `color:0x2563ebaa|weight:4|${riderLat},${riderLng}|${lat},${lng}`);
        } else {
          params.set("center", `${lat},${lng}`);
        }

        const upstream = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`);
        if (!upstream.ok) {
          return new Response("Map unavailable", { status: 502 });
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/png",
            "Cache-Control": "public, max-age=30",
          },
        });
      },
    },
  },
});
