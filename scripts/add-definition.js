#!/usr/bin/env node
/**
 * Add layer definition to the existing PalmSpringsEats feature service,
 * then seed data from GeoJSON.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error("Usage: node scripts/add-definition.js TOKEN");
  process.exit(1);
}

const SERVICE_URL = "https://services8.arcgis.com/KsXZDThvSinzJ3pq/arcgis/rest/services/PalmSpringsEats/FeatureServer";
const ADMIN_URL = "https://services8.arcgis.com/KsXZDThvSinzJ3pq/arcgis/rest/admin/services/PalmSpringsEats/FeatureServer";

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
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Non-JSON response:", text.slice(0, 500));
    throw new Error("Non-JSON response from server");
  }
  if (data.error) {
    throw new Error(`AGOL error: ${JSON.stringify(data.error)}`);
  }
  return data;
}

async function main() {
  // Step 1: Add layer definition via admin endpoint
  console.log("Adding layer definition via admin endpoint...");
  const defResult = await post(`${ADMIN_URL}/addToDefinition`, {
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
          hasAttachments: false,
          capabilities: "Create,Delete,Query,Update,Editing",
        },
      ],
    }),
  });
  console.log("Layer definition added:", JSON.stringify(defResult).slice(0, 200));

  // Step 2: Verify layer exists
  console.log("\nVerifying layer...");
  const info = await post(`${SERVICE_URL}/0?f=json`, {});
  console.log(`Layer: ${info.name}, Fields: ${info.fields?.length}`);

  // Step 3: Seed data
  console.log("\nSeeding restaurant data...");
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

  for (let i = 0; i < features.length; i += 50) {
    const batch = features.slice(i, i + 50);
    const result = await post(`${SERVICE_URL}/0/addFeatures`, {
      features: JSON.stringify(batch),
    });
    const added = result.addResults?.filter((r) => r.success).length || 0;
    const failed = result.addResults?.filter((r) => !r.success).length || 0;
    console.log(`  Batch ${Math.floor(i / 50) + 1}: ${added} added, ${failed} failed`);
    if (failed > 0) {
      const errors = result.addResults?.filter((r) => !r.success);
      console.log("  Errors:", JSON.stringify(errors?.slice(0, 3)));
    }
  }

  console.log("\n=== DONE ===");
  console.log(`Feature Layer URL: ${SERVICE_URL}/0`);
  console.log(`Item ID: 38c12041d942449595989d7ebde8cbb0`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
