#!/usr/bin/env node
/**
 * Register an OAuth app on AGOL so the sign-in redirect works.
 */

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error("Usage: node scripts/register-oauth-app.js TOKEN");
  process.exit(1);
}

const PORTAL_URL = "https://moraveclabsllc.maps.arcgis.com";
const USERNAME = "tester_dymaptic";

async function main() {
  const redirectUris = [
    "http://localhost:5173/oauth-callback.html",
    "http://localhost:5173",
    "http://jaws-mini:5173/oauth-callback.html",
    "http://jaws-mini:5173",
    "http://jaws-mini.daggertooth-uaru.ts.net:5173/oauth-callback.html",
    "http://jaws-mini.daggertooth-uaru.ts.net:5173",
  ].join(",");

  const body = new URLSearchParams({
    f: "json",
    token: TOKEN,
    title: "Palm Springs Eats Demo",
    type: "Application",
    typeKeywords: "Application,Registered App,JavaScript",
    tags: "demo,dev-summit,palm-springs-eats",
    snippet: "OAuth app for the Palm Springs Eats AI assistant demo",
  });

  // Create an app item
  console.log("Creating app item...");
  const resp = await fetch(
    `${PORTAL_URL}/sharing/rest/content/users/${USERNAME}/addItem`,
    { method: "POST", body }
  );
  const data = await resp.json();
  if (data.error) {
    console.error("Error creating item:", JSON.stringify(data.error));
    process.exit(1);
  }
  console.log(`App item created: ${data.id}`);

  // Register the app for OAuth
  console.log("Registering for OAuth...");
  const regBody = new URLSearchParams({
    f: "json",
    token: TOKEN,
    itemId: data.id,
    appType: "browser",
    redirect_uris: JSON.stringify([
      "http://localhost:5173/oauth-callback.html",
      "http://localhost:5173",
      "http://jaws-mini:5173/oauth-callback.html",
      "http://jaws-mini:5173",
      "http://jaws-mini.daggertooth-uaru.ts.net:5173/oauth-callback.html",
      "http://jaws-mini.daggertooth-uaru.ts.net:5173",
    ]),
  });

  const regResp = await fetch(
    `${PORTAL_URL}/sharing/rest/oauth2/registerApp`,
    { method: "POST", body: regBody }
  );
  const regData = await regResp.json();
  if (regData.error) {
    console.error("Error registering:", JSON.stringify(regData.error));
    process.exit(1);
  }

  console.log(`\nOAuth App Registered!`);
  console.log(`App ID (client_id): ${regData.client_id}`);
  console.log(`Item ID: ${regData.itemId}`);
  console.log(`\nUpdate src/main.js with:`);
  console.log(`  OAUTH_APP_ID = "${regData.client_id}"`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
