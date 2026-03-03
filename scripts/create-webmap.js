#!/usr/bin/env node
/**
 * Create a Web Map on AGOL with the PalmSpringsEats feature layer.
 * Includes category symbology, popups, and Palm Springs extent.
 */

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error("Usage: node scripts/create-webmap.js TOKEN");
  process.exit(1);
}

const PORTAL_URL = "https://moraveclabsllc.maps.arcgis.com";
const USERNAME = "tester_dymaptic";
const FEATURE_SERVICE_ITEM_ID = "38c12041d942449595989d7ebde8cbb0";
const FEATURE_LAYER_URL = "https://services8.arcgis.com/KsXZDThvSinzJ3pq/arcgis/rest/services/PalmSpringsEats/FeatureServer/0";

function sym(color, size) {
  return {
    type: "esriSMS",
    style: "esriSMSCircle",
    color,
    size,
    outline: { color: [255, 255, 255, 200], width: 1.5 },
  };
}

const webmapJson = {
  operationalLayers: [
    {
      id: "restaurants",
      title: "Palm Springs Restaurants",
      url: FEATURE_LAYER_URL,
      itemId: FEATURE_SERVICE_ITEM_ID,
      layerType: "ArcGISFeatureLayer",
      visibility: true,
      opacity: 1,
      popupInfo: {
        title: "{Name}",
        description: `<b>{Category}</b> · {PriceRange}<br/>
{Address}<br/>
<i>{Description}</i><br/><br/>
{WalkingDistance} mi from convention center
{expression/walkable}`,
        expressionInfos: [
          {
            name: "walkable",
            title: "Walkable",
            expression: `IIf($feature.IsWalkable == 1, " · Walkable! 🚶", "")`,
          },
        ],
      },
      layerDefinition: {
        drawingInfo: {
          renderer: {
            type: "uniqueValue",
            field1: "Category",
            defaultSymbol: sym([128, 128, 128, 255], 10),
            defaultLabel: "Other",
            uniqueValueInfos: [
              { value: "burger", symbol: sym([227, 66, 52, 255], 12), label: "Burger" },
              { value: "american", symbol: sym([52, 152, 219, 255], 11), label: "American" },
              { value: "mexican", symbol: sym([46, 204, 113, 255], 11), label: "Mexican" },
              { value: "italian", symbol: sym([155, 89, 182, 255], 11), label: "Italian" },
              { value: "deli", symbol: sym([243, 156, 18, 255], 11), label: "Deli / Sandwich" },
              { value: "seafood", symbol: sym([26, 188, 156, 255], 11), label: "Seafood" },
              { value: "asian", symbol: sym([231, 76, 60, 255], 11), label: "Asian" },
              { value: "venue", symbol: sym([44, 62, 80, 255], 14), label: "Conference Venue" },
            ],
          },
        },
      },
    },
  ],
  baseMap: {
    baseMapLayers: [
      {
        id: "streets-nav",
        layerType: "ArcGISTiledMapServiceLayer",
        url: "https://services.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer",
        visibility: true,
        opacity: 1,
        title: "World Street Map",
      },
    ],
    title: "Streets",
  },
  initialState: {
    viewpoint: {
      targetGeometry: {
        xmin: -116.56,
        ymin: 33.815,
        xmax: -116.53,
        ymax: 33.845,
        spatialReference: { wkid: 4326 },
      },
    },
  },
  spatialReference: { wkid: 4326 },
  version: "2.31",
  authoringApp: "Palm Springs Eats Demo",
  authoringAppVersion: "1.0",
};

async function main() {
  console.log("Creating web map...");

  const body = new URLSearchParams({
    f: "json",
    token: TOKEN,
    title: "Palm Springs Eats — Dev Summit 2026",
    snippet: "Restaurant recommendations near the Palm Springs Convention Center. Built for the ArcGIS JS SDK 5.0 AI components demo.",
    description: "A curated map of restaurants within walking distance of the Palm Springs Convention Center, built for the Esri Developer Summit 2026. Includes burger joints, Mexican, Italian, seafood, and more. Powered by AI assistant components.",
    tags: "palm springs, restaurants, dev summit, ai components, demo",
    type: "Web Map",
    typeKeywords: "ArcGIS Online,Explorer Web Map,Map,Online Map,Web Map",
    text: JSON.stringify(webmapJson),
  });

  const resp = await fetch(
    `${PORTAL_URL}/sharing/rest/content/users/${USERNAME}/addItem`,
    { method: "POST", body }
  );
  const data = await resp.json();

  if (data.error) {
    console.error("Error:", JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  console.log(`Web Map created!`);
  console.log(`Item ID: ${data.id}`);
  console.log(`View: ${PORTAL_URL}/home/item.html?id=${data.id}`);
  console.log(`Map Viewer: ${PORTAL_URL}/home/webmap/viewer.html?webmap=${data.id}`);
  console.log(`\nUpdate src/main.js with:`);
  console.log(`  WEBMAP_ID = "${data.id}"`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
