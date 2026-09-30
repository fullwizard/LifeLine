"use client";

import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import counties from "@/data/geo/bay-area-counties.json";
import type { MapArea, MapDot, PlanMapData } from "@/lib/map/planMapData";
import { useLanguage } from "./LanguageProvider";

type CountyFeature = Feature<Polygon | MultiPolygon, { name: string; county: string }>;
const COUNTIES = counties as unknown as FeatureCollection<Polygon | MultiPolygon, { name: string; county: string }>;
const BAY_AREA_CENTER: [number, number] = [37.55, -122.15];

export function ResourceMap({ data }: { data: PlanMapData }) {
  const { t } = useLanguage();
  const areasByName = useMemo(() => new Map(data.areas.map((a) => [a.name, a])), [data.areas]);
  const features = COUNTIES.features.filter((f) => areasByName.has(f.properties.name));
  const exact = data.dots.filter((d) => d.placement === "address").length;
  const approx = data.dots.length - exact;
  const notDrawn = data.statewide.length + data.national.length - data.dots.filter((d) => d.placement === "near_you").length;

  return (
    <div className="space-y-2">
      <div className="h-72 w-full overflow-hidden rounded-lg border border-neutral-200 sm:h-80">
        <MapContainer center={BAY_AREA_CENTER} zoom={9} scrollWheelZoom={false} className="h-full w-full" attributionControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {features.map((feature) => {
            const area = areasByName.get(feature.properties.name)!;
            return (
              <GeoJSON
                key={feature.properties.name}
                data={feature as CountyFeature}
                style={{ color: "#b52a16", weight: 1.25, fillColor: "#b52a16", fillOpacity: 0.07 }}
              >
                <Popup maxWidth={320}>
                  <AreaPopup area={area} />
                </Popup>
              </GeoJSON>
            );
          })}
          {data.dots.map((dot) => (
            <Marker key={dot.id} position={[dot.lat, dot.lng]} icon={dotIcon(dot)} zIndexOffset={dot.section === "ranked" ? 1000 - dot.rank : 0}>
              <Popup maxWidth={280}>
                <strong>
                  #{dot.rank} {dot.name}
                </strong>
                <br />
                <span className="text-xs">{dot.placeLabel}</span>
                <br />
                <a href={`#resource-${dot.id}`}>{t("map.details")}</a>
              </Popup>
            </Marker>
          ))}
          {data.user && (
            <CircleMarker center={[data.user.lat, data.user.lng]} radius={9} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#1d4ed8", fillOpacity: 1 }}>
              <Popup>{t("map.you", { place: data.user.label })}</Popup>
            </CircleMarker>
          )}
          <FitBounds data={data} features={features} />
        </MapContainer>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent-700" aria-hidden />
          {t("map.legend.ranked")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-500" aria-hidden />
          {t("map.legend.related")}
        </li>
        {approx > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-accent-700 bg-white" aria-hidden />
            {t("map.legend.approx", { n: approx })}
          </li>
        )}
        {exact > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-700 ring-1 ring-white" aria-hidden />
            {t("map.legend.exact", { n: exact })}
          </li>
        )}
        {data.user && (
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-700" aria-hidden /> {t("map.legend.you")}
          </li>
        )}
        {notDrawn > 0 && <li>{t("map.legend.notDrawn", { n: notDrawn })}</li>}
      </ul>
    </div>
  );
}

function AreaPopup({ area }: { area: MapArea }) {
  const { t } = useLanguage();
  const shown = area.resources.slice(0, 8);
  return (
    <div className="text-sm">
      <strong>
        {t("map.popup.count", { n: area.resources.length, county: area.county })}
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
      {area.resources.length > shown.length && <p className="mt-1 text-xs">{t("map.popup.more", { n: area.resources.length - shown.length })}</p>}
    </div>
  );
}

function dotIcon(dot: MapDot): L.DivIcon {
  const ranked = dot.section === "ranked";
  const exact = dot.placement === "address";
  const size = ranked ? 26 : 22;
  const bg = ranked ? "#b52a16" : "#6b7280";
  const style = exact
    ? `background:${bg};color:#fff;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45)`
    : `background:rgba(255,255,255,.92);color:${bg};border:2px dashed ${bg};box-shadow:0 1px 2px rgba(0,0,0,.25)`;
  return L.divIcon({
    className: "",
    html: `<div title="${escapeHtml(dot.name)}" style="${style};font-weight:600;font-size:${ranked ? 12 : 11}px;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif">${dot.rank}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function FitBounds({ data, features }: { data: PlanMapData; features: CountyFeature[] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([]);
    // Prefer the dots (tight, useful view); fall back to county outlines.
    for (const d of data.dots) bounds.extend([d.lat, d.lng]);
    if (data.user) bounds.extend([data.user.lat, data.user.lng]);
    if (!bounds.isValid()) for (const f of features) bounds.extend(L.geoJSON(f).getBounds());
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.15), { maxZoom: 11 });
    else map.setView(BAY_AREA_CENTER, 9);
  }, [map, data, features]);
  return null;
}
