/**
 * PHASE 3, point 6 — territory color rendering.
 *
 * This is deliberately just a pure styling helper, not a Leaflet component:
 * `leaflet`/`react-leaflet` aren't installed yet (Map.jsx is still the
 * Phase 3–4 placeholder, and Leaflet setup is explicitly Phase 4's job —
 * "Global Map & Territory Visibility"). Adding the actual map now would
 * mean half-building Phase 4 without its viewport-query/fetch logic, so
 * this file exists purely so Phase 4 has a ready-made, already-agreed-on
 * styling convention to import instead of inventing one from scratch.
 *
 * Usage once Leaflet lands (react-leaflet's <Polygon> and <GeoJSON> both
 * accept a `pathOptions`/`style` prop shaped exactly like this):
 *
 *   import { getTerritoryStyle } from '../utils/territoryStyle.js'
 *   <Polygon positions={...} pathOptions={getTerritoryStyle(territory.color)} />
 *
 * or with plain Leaflet:
 *   L.geoJSON(territory.geometry, { style: () => getTerritoryStyle(territory.color) })
 */

// Fill opacity for the tinted interior — spec says 15-20% so it "reads as a
// tinted region, not a solid block". Kept as a named constant so Phase 4
// (or later playtesting) can tune it in one place.
export const TERRITORY_FILL_OPACITY = 0.18;
export const TERRITORY_OUTLINE_OPACITY = 1;
export const TERRITORY_OUTLINE_WEIGHT = 2;

/**
 * @param {string} color - the owner's preferredColor hex string (e.g. "#3B82F6")
 * @returns {object} Leaflet PathOptions-shaped style object
 */
export function getTerritoryStyle(color) {
  return {
    color, // outline — full-strength owner color
    weight: TERRITORY_OUTLINE_WEIGHT,
    opacity: TERRITORY_OUTLINE_OPACITY,
    fillColor: color, // fill — same color, low opacity
    fillOpacity: TERRITORY_FILL_OPACITY,
  };
}
