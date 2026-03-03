#!/usr/bin/env node
/**
 * Update field descriptions on the PalmSpringsEats feature layer
 * so that AI embeddings produce better results.
 */

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error("Usage: node scripts/update-field-descriptions.js TOKEN");
  process.exit(1);
}

const ADMIN_URL = "https://services8.arcgis.com/KsXZDThvSinzJ3pq/arcgis/rest/admin/services/PalmSpringsEats/FeatureServer";

const FIELD_DESCRIPTIONS = {
  Name: "The name of the restaurant or venue",
  Address: "Street address in Palm Springs, California",
  Category: "Type of cuisine: burger, american, mexican, italian, deli, seafood, asian, or venue",
  PriceRange: "Price level: $ (under $15), $$ ($15-30), $$$ (over $30)",
  WalkingDistance: "Distance in miles from the Palm Springs Convention Center",
  IsWalkable: "Whether the restaurant is within walking distance (0.75 miles) of the convention center. 1 = yes, 0 = no",
  Description: "A brief description of the restaurant, its signature dishes, and atmosphere",
  AddedBy: "Who added this restaurant: original (from the curated list) or chat-agent (added via the AI assistant)",
};

async function main() {
  // Get current layer definition
  const resp = await fetch(`${ADMIN_URL}/0?f=json&token=${TOKEN}`);
  const layer = await resp.json();

  if (layer.error) {
    console.error("Error fetching layer:", JSON.stringify(layer.error));
    process.exit(1);
  }

  // Update field descriptions
  const updatedFields = layer.fields.map((f) => ({
    ...f,
    description: FIELD_DESCRIPTIONS[f.name] || f.description || "",
  }));

  // Also update the layer description
  const updateDef = {
    layers: [
      {
        id: 0,
        description: "Restaurants and food spots near the Palm Springs Convention Center, curated for Esri Developer Summit 2026 attendees. Includes categories like burgers, Mexican, Italian, seafood, and more. Features walking distance calculations and walkability indicators.",
        fields: updatedFields,
      },
    ],
  };

  const body = new URLSearchParams({
    f: "json",
    token: TOKEN,
    updateDefinition: JSON.stringify(updateDef),
  });

  const updateResp = await fetch(`${ADMIN_URL}/updateDefinition`, {
    method: "POST",
    body,
  });
  const result = await updateResp.json();

  if (result.error) {
    console.error("Error:", JSON.stringify(result.error));
    process.exit(1);
  }

  console.log("Field descriptions updated:", JSON.stringify(result));
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
