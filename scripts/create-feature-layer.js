#!/usr/bin/env node
/**
 * Create the PalmSpringsEats hosted feature layer on ArcGIS Online.
 *
 * Usage:
 *   node scripts/create-feature-layer.js --token YOUR_TOKEN --username YOUR_USERNAME
 *
 * Steps:
 *   1. createService → empty feature service
 *   2. addToDefinition → define fields + editing capability
 *   3. addFeatures → seed from restaurants.geojson
 *
 * After running, update FEATURE_LAYER_URL in src/main.js with the output URL.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTAL_URL = "https://moraveclabsllc.maps.arcgis.com";

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const TOKEN = getArg("token") || process.env.AGOL_TOKEN;
const USERNAME = getArg("username") || process.env.AGOL_USERNAME;

if (!TOKEN || !USERNAME) {
  console.error("Usage: node scripts/create-feature-layer.js --token TOKEN --username USERNAME");
  console.error("Or set AGOL_TOKEN and AGOL_USERNAME env vars.");
  process.exit(1);
}

const SERVICE_NAME = "PalmSpringsEats";

// --- Field definitions ---
const FIELDS = [
  { name: "Name", type: "esriFieldTypeString", alias: "Name", length: 100, nullable: false },
  { name: "Address", type: "esriFieldTypeString", alias: "Address", length: 200, nullable: true },
  { name: "Category", type: "esriFieldTypeString", alias: "Category", length: 50, nullable: true },
  { name: "PriceRange", type: "esriFieldTypeString", alias: "Price Range", length: 10, nullable: true },
  { name: "WalkingDistance", type: "esriFieldTypeDouble", alias: "Walking Distance (mi)", nullable: true },
  { name: "IsWalkable", type: "esriFieldTypeInteger", alias: "Walkable?", nullable: true },
  { name: "Description", type: "esriFieldTypeString", alias: "Description", length: 500, nullable: true },
  { name: "AddedBy", type: "esriFieldTypeString", alias: "Added By", length: 50, nullable: true },
];

async function post(url, params) {
  const body = new URLSearchParams({ ...params, f: "json", token: TOKEN });
  const resp = await fetch(url, { method: "POST", body });
  const data = await resp.json();
  if (data.error) {
    throw new Error(`AGOL error: ${JSON.stringify(data.error)}`);
  }
  return data;
}

async function main() {
  console.log(`Creating feature service "${SERVICE_NAME}" on ${PORTAL_URL}...`);

  // Step 1: Create empty feature service
  const createResult = await post(
    `${PORTAL_URL}/sharing/rest/content/users/${USERNAME}/createService`,
    {
      createParameters: JSON.stringify({
        name: SERVICE_NAME,
        serviceDescription: "Restaurant recommendations near the Palm Springs Convention Center",
        hasStaticData: false,
        maxRecordCount: 2000,
        supportedQueryFormats: "JSON",
        capabilities: "Create,Delete,Query,Update,Editing",
        spatialReference: { wkid: 4326 },
        initialExtent: {
          xmin: -116.56, ymin: 33.82,
          xmax: -116.53, ymax: 33.84,
          spatialReference: { wkid: 4326 },
        },
      }),
      outputType: "featureService",
    }
  );

  const serviceUrl = createResult.serviceurl;
  const itemId = createResult.itemId;
  // Admin URL needed for addToDefinition — insert /admin/ before /services/
  const adminUrl = serviceUrl.replace("/rest/services/", "/rest/admin/services/");
  console.log(`Service created: ${serviceUrl}`);
  console.log(`Item ID: ${itemId}`);

  // Step 2: Add layer definition (via admin endpoint)
  console.log("Adding layer definition...");
  await post(`${adminUrl}/addToDefinition`, {
    addToDefinition: JSON.stringify({
      layers: [
        {
          id: 0,
          name: "Restaurants",
          type: "Feature Layer",
          geometryType: "esriGeometryPoint",
          objectIdField: "OBJECTID",
          fields: [
            { name: "OBJECTID", type: "esriFieldTypeOID", alias: "Object ID" },
            ...FIELDS,
          ],
          extent: {
            xmin: -116.56, ymin: 33.82,
            xmax: -116.53, ymax: 33.84,
            spatialReference: { wkid: 4326 },
          },
          drawingInfo: {
            renderer: {
              type: "uniqueValue",
              field1: "Category",
              defaultSymbol: {
                type: "esriSMS",
                style: "esriSMSCircle",
                color: [128, 128, 128, 255],
                size: 10,
              },
              uniqueValueInfos: [
                { value: "burger", symbol: sym([227, 66, 52, 255], 12), label: "Burger" },
                { value: "american", symbol: sym([52, 152, 219, 255], 11), label: "American" },
                { value: "mexican", symbol: sym([46, 204, 113, 255], 11), label: "Mexican" },
                { value: "italian", symbol: sym([155, 89, 182, 255], 11), label: "Italian" },
                { value: "deli", symbol: sym([243, 156, 18, 255], 11), label: "Deli" },
                { value: "seafood", symbol: sym([26, 188, 156, 255], 11), label: "Seafood" },
                { value: "asian", symbol: sym([231, 76, 60, 255], 11), label: "Asian" },
                { value: "venue", symbol: sym([44, 62, 80, 255], 14), label: "Venue" },
              ],
            },
          },
          hasAttachments: false,
          capabilities: "Create,Delete,Query,Update,Editing",
        },
      ],
    }),
  });
  console.log("Layer definition added.");

  // Step 3: Seed data from GeoJSON
  console.log("Seeding restaurant data...");
  const geojson = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "restaurants.geojson"), "utf-8")
  );

  const features = geojson.features.map((f) => ({
    geometry: {
      x: f.geometry.coordinates[0],
      y: f.geometry.coordinates[1],
      spatialReference: { wkid: 4326 },
    },
    attributes: f.properties,
  }));

  // Add in batches of 50
  for (let i = 0; i < features.length; i += 50) {
    const batch = features.slice(i, i + 50);
    const result = await post(`${serviceUrl}/0/addFeatures`, {
      features: JSON.stringify(batch),
    });
    const added = result.addResults?.filter((r) => r.success).length || 0;
    const failed = result.addResults?.filter((r) => !r.success).length || 0;
    console.log(`  Batch ${Math.floor(i / 50) + 1}: ${added} added, ${failed} failed`);
  }

  console.log("\n=== DONE ===");
  console.log(`Feature Layer URL: ${serviceUrl}/0`);
  console.log(`Item ID: ${itemId}`);
  console.log(`\nUpdate src/main.js with:`);
  console.log(`  FEATURE_LAYER_URL = "${serviceUrl}/0"`);
  console.log(`\nNext steps:`);
  console.log(`  1. Open ${PORTAL_URL}/home/item.html?id=${itemId}`);
  console.log(`  2. Create a Web Map from this layer`);
  console.log(`  3. Style with category symbology + configure popups`);
  console.log(`  4. Settings > Manage AI vector embeddings`);
  console.log(`  5. Copy the web map item ID to src/main.js WEBMAP_ID`);
}

function sym(color, size) {
  return {
    type: "esriSMS",
    style: "esriSMSCircle",
    color,
    size,
    outline: { color: [255, 255, 255, 200], width: 1.5 },
  };
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
