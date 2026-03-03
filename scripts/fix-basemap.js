#!/usr/bin/env node
/**
 * Update the PalmSpringsEats web map to use a vector basemap
 * instead of the deprecated raster tiled basemap.
 */

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error("Usage: node scripts/fix-basemap.js TOKEN");
  process.exit(1);
}

const PORTAL_URL = "https://moraveclabsllc.maps.arcgis.com";
const USERNAME = "tester_dymaptic";
const WEBMAP_ID = "50e1652604f34d2a91b74fa992f90f00";

async function main() {
  // Get current web map JSON
  console.log("Fetching current web map...");
  const resp = await fetch(
    `${PORTAL_URL}/sharing/rest/content/items/${WEBMAP_ID}/data?f=json&token=${TOKEN}`
  );
  const webmap = await resp.json();

  // Replace basemap with vector tile version
  webmap.baseMap = {
    baseMapLayers: [
      {
        id: "streets-nav-vector",
        layerType: "VectorTileLayer",
        styleUrl: "https://www.arcgis.com/sharing/rest/content/items/de26a3cf4cc9451298ea173c4b324736/resources/styles/root.json",
        title: "World Street Map (Night)",
        visibility: true,
        opacity: 1,
      },
    ],
    title: "Streets (Night)",
  };

  // Update the item
  console.log("Updating web map with vector basemap...");
  const body = new URLSearchParams({
    f: "json",
    token: TOKEN,
    text: JSON.stringify(webmap),
  });

  const updateResp = await fetch(
    `${PORTAL_URL}/sharing/rest/content/users/${USERNAME}/items/${WEBMAP_ID}/update`,
    { method: "POST", body }
  );
  const result = await updateResp.json();

  if (result.error) {
    console.error("Error:", JSON.stringify(result.error));
    process.exit(1);
  }

  console.log("Done! Basemap updated to vector tiles:", result.success);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
