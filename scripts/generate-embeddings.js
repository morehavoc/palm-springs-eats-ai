#!/usr/bin/env node
/**
 * Generate AI vector embeddings for the PalmSpringsEats web map
 * and upload as a portal item resource (embeddings-v01.json).
 *
 * This is required for the arcgis-assistant AI component to work.
 */

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error("Usage: node scripts/generate-embeddings.js <AGOL_TOKEN>");
  process.exit(1);
}

const PORTAL = "https://moraveclabsllc.maps.arcgis.com";
const WEB_MAP_ID = "50e1652604f34d2a91b74fa992f90f00";
const LAYER_ID = "restaurants";
const LAYER_NAME = "Restaurants";
const LAYER_TITLE = "Palm Springs Restaurants";
const LAYER_DESC =
  "Restaurant recommendations near the Palm Springs Convention Center for Esri Dev Summit 2026 attendees";

const FIELDS = [
  { name: "OBJECTID", alias: "Object ID", description: "Unique identifier for each restaurant record" },
  { name: "Name", alias: "Name", description: "The name of the restaurant or dining establishment" },
  { name: "Address", alias: "Address", description: "Street address of the restaurant in Palm Springs, CA" },
  { name: "Category", alias: "Category", description: "Type of cuisine: burger, american, mexican, italian, deli, seafood, asian, or venue" },
  { name: "PriceRange", alias: "Price Range", description: "Price level indicated by dollar signs: dollar for cheap, double dollar for moderate, triple dollar for expensive" },
  { name: "WalkingDistance", alias: "Walking Distance (mi)", description: "Distance in miles from the Palm Springs Convention Center to the restaurant" },
  { name: "IsWalkable", alias: "Walkable?", description: "Whether the restaurant is within comfortable walking distance (1 = yes, 0 = no)" },
  { name: "Description", alias: "Description", description: "A brief description or review of the restaurant including menu highlights and atmosphere" },
  { name: "AddedBy", alias: "Added By", description: "The person who added this restaurant recommendation" },
];

const layerText = `Name: ${LAYER_NAME}\nTitle: ${LAYER_TITLE}\nDescription: ${LAYER_DESC}`;
const fieldTexts = FIELDS.map(
  (f) => `Name: ${f.name}\nAlias: ${f.alias}\nDescription: ${f.description}`
);
const allTexts = [layerText, ...fieldTexts];

async function main() {
  // Step 1: Generate embeddings via Esri AI Utils API
  console.log(`Generating embeddings for ${allTexts.length} texts...`);

  // Use the correct endpoint from the AI models discovery service.
  // This is the same endpoint the arcgis-assistant component uses at runtime
  // for query embeddings, ensuring cosine similarity works correctly.
  const EMBEDDINGS_URL =
    "https://aimodels.arcgis.com/text-embedding-ada-002/openai/v1/embeddings";

  const resp = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ model: "text-embedding-ada-002", input: allTexts }),
  });
  const data = await resp.json();
  if (data.error || !data.data) {
    console.error("Embeddings API failed:", JSON.stringify(data));
    process.exit(1);
  }

  const embeddings = data.data.map((r) => r.embedding);
  console.log(`Got ${embeddings.length} embeddings, each ${embeddings[0].length} dims`);

  // Step 2: Build the embeddings-v01.json resource
  const resource = {
    schemaVersion: "0.1",
    modified: Date.now(),
    embeddings: {
      modelProvider: "openai",
      model: "text-embedding-ada-002",
      dimensions: 1536,
      templates: {
        layer: "Name: {name}\nTitle: {title}\nDescription: {description}",
        field: "Name: {name}\nAlias: {alias}\nDescription: {description}",
      },
    },
    layers: [
      {
        id: LAYER_ID,
        name: LAYER_NAME,
        title: LAYER_TITLE,
        description: LAYER_DESC,
        vector: embeddings[0],
        fields: FIELDS.map((f, i) => ({
          name: f.name,
          alias: f.alias,
          description: f.description,
          vector: embeddings[i + 1],
        })),
      },
    ],
  };

  const json = JSON.stringify(resource);
  console.log(`Resource JSON size: ${json.length} bytes`);

  // Step 3: Upload to web map item as a resource
  console.log("Uploading embeddings-v01.json to web map item...");
  const form = new URLSearchParams();
  form.append("f", "json");
  form.append("token", TOKEN);
  form.append("resourcesPrefix", "");
  form.append("fileName", "embeddings-v01.json");
  form.append("text", json);

  const uploadResp = await fetch(
    `${PORTAL}/sharing/rest/content/users/tester_dymaptic/items/${WEB_MAP_ID}/updateResources`,
    { method: "POST", body: form }
  );
  const uploadResult = await uploadResp.json();

  if (uploadResult.success) {
    // Verify
    console.log("Verifying resource...");
    const verifyResp = await fetch(
      `${PORTAL}/sharing/rest/content/items/${WEB_MAP_ID}/resources/embeddings-v01.json?token=${TOKEN}`
    );
    const verifyData = await verifyResp.json();
    console.log(`  schemaVersion: ${verifyData.schemaVersion}`);
    console.log(`  model: ${verifyData.embeddings?.model}`);
    console.log(`  layers: ${verifyData.layers?.length}`);
    console.log(`  fields: ${verifyData.layers?.[0]?.fields?.length}`);
    console.log(`  vector dims: ${verifyData.layers?.[0]?.vector?.length}`);
    console.log("\n=== EMBEDDINGS UPLOADED SUCCESSFULLY ===");
  } else {
    console.error("Upload failed:", JSON.stringify(uploadResult, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
