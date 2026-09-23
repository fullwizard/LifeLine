"use client";

import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import counties from "@/data/geo/bay-area-counties.json";
import type { MapArea, PlanMapData } from "@/lib/map/planMapData";

type CountyFeature = Feature<Polygon | MultiPolygon, { name: string; county: string }>;
const COUNTIES = counties as unknown as FeatureCollection<Polygon | MultiPolygon, { name: string; county: string }>;
const BAY_AREA_CENTER: [number, number] = [37.55, -122.15];

export function ResourceMap({ data }: { data: PlanMapData }) {
  const areasByName = useMemo(() => new Map(data.areas.map((a) => [a.name, a])), [data.areas]);
  const max = Math.max(1, ...data.areas.map((a) => a.resources.length));
  const features = COUNTIES.features.filter((f) => areasByName.has(f.properties.name));

  return (
    <div className="space-y-3">
      <div className="h-[380px] w-full overflow-hidden rounded-none border border-neutral-200">
        <MapContainer center={BAY_AREA_CENTER} zoom={9} scrollWheelZoom={false} className="h-full w-full" attributionControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {features.map((feature) => {
            const area = areasByName.get(feature.properties.name)!;
            const weight = area.resources.length / max;
            return (
              <GeoJSON
                key={feature.properties.name}
                data={feature as CountyFeature}
                style={{ color: "#b52a16", weight: 1.5, fillColor: "#fbd95b", fillOpacity: 0.25 + 0.45 * weight }}
              >
                <Popup maxWidth={320}>
                  <AreaPopup area={area} />
                </Popup>
              </GeoJSON>
            );
          })}
          {data.pins.map((pin) => (
            <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={rankIcon(pin.rank)}>
              <Popup>
                <strong>
                  #{pin.rank} {pin.name}
                </strong>
                <br />
                {pin.address}
                <br />
                <a href={`#resource-${pin.id}`}>See details</a>
              </Popup>
            </Marker>
          ))}
          {data.user && (
            <CircleMarker center={[data.user.lat, data.user.lng]} radius={8} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#1d4ed8", fillOpacity: 1 }}>
              <Popup>{data.user.label} (you)</Popup>
            </CircleMarker>
          )}
          <FitBounds data={data} features={features} />
        </MapContainer>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-700">
        {data.areas.map((a) => (
          <li key={a.name}>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sunflower align-middle ring-1 ring-accent-700" aria-hidden />{" "}
            {a.resources.length} serve {a.county}
          </li>
        ))}
        {data.statewide.length > 0 && <li>{data.statewide.length} serve all of California (not drawn)</li>}
        {data.national.length > 0 && <li>{data.national.length} available nationwide by phone or online</li>}
        {data.user && (
          <li>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-700 align-middle ring-1 ring-white" aria-hidden /> you
          </li>
        )}
      </ul>
      <p className="text-xs text-neutral-500">
        Shaded areas show where each program serves, not office locations. Pins appear only for programs with a published street address.
      </p>
    </div>
  );
}

function AreaPopup({ area }: { area: MapArea }) {
  const shown = area.resources.slice(0, 8);
  return (
    <div className="text-sm">
      <strong>
        {area.resources.length} program{area.resources.length === 1 ? "" : "s"} serve {area.county}
      </strong>
      <ol className="mt-1 list-none space-y-0.5 p-0">
        {shown.map((r) => (
          <li key={r.id}>
            <a href={`#resource-${r.id}`} className="underline">
              #{r.rank} {r.name}
            </a>
          </li>
        ))}
      </ol>
      {area.resources.length > shown.length && <p className="mt-1 text-xs">…and {area.resources.length - shown.length} more in the list below.</p>}
    </div>
  );
}

function rankIcon(rank: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:#b52a16;color:#fff;font-weight:600;font-size:12px;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${rank}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ data, features }: { data: PlanMapData; features: CountyFeature[] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([]);
    for (const f of features) bounds.extend(L.geoJSON(f).getBounds());
    for (const p of data.pins) bounds.extend([p.lat, p.lng]);
    if (data.user) bounds.extend([data.user.lat, data.user.lng]);
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.1), { maxZoom: 11 });
    else map.setView(BAY_AREA_CENTER, 9);
  }, [map, data, features]);
  return null;
}
