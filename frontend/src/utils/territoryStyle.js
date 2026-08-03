/**
 * PHASE 3, point 6 — territory color rendering.
 * PHASE 4 FOLLOW-UP — bumped fill opacity + outline weight after the first
 * live test showed territories were nearly invisible against light OSM
 * tiles (0.18 fill opacity + a light basemap = washed out). Paired with the
 * dark CARTO basemap swap in Map.jsx, this should read clearly now.
 *
 * This is deliberately just a pure styling helper, not a Leaflet component —
 * see Map.jsx / react-leaflet's <GeoJSON style={...}> for usage:
 *
 *   import { getTerritoryStyle } from '../utils/territoryStyle.js'
 *   <GeoJSON data={...} style={(feature) => getTerritoryStyle(feature.properties.color)} />
 *
 * or with plain Leaflet:
 *   L.geoJSON(territory.geometry, { style: () => getTerritoryStyle(territory.color) })
 */

// Fill opacity for the tinted interior. Original spec said 15-20% ("reads
// as a tinted region, not a solid block") — that held up fine on a dark
// basemap in isolation, but combined with thin, small polygons on light
// OSM tiles it was too subtle to spot at a glance. Bumped to make
// territories readable at normal map zoom without going full opaque/block.
// Tune freely — this is the one knob to turn if it's ever too strong/weak.
export const TERRITORY_FILL_OPACITY = 0.4;
export const TERRITORY_OUTLINE_OPACITY = 1;
export const TERRITORY_OUTLINE_WEIGHT = 3; // was 2

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
