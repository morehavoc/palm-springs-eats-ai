#!/usr/bin/env node
const TOKEN = process.argv[2];
if (!TOKEN) { console.error("Usage: node scripts/update-oauth-redirects.js TOKEN"); process.exit(1); }

const PORTAL_URL = "https://moraveclabsllc.maps.arcgis.com";
const APP_ITEM_ID = "f057fbab3b0f462e9f04569e85ba6b67";

async function main() {
  const body = new URLSearchParams({
    f: "json",
    token: TOKEN,
    appType: "browser",
    redirect_uris: JSON.stringify([
      "http://localhost:5173",
      "http://localhost:5173/",
      "http://localhost:5173/oauth-callback.html",
      "http://jaws-mini:5173",
      "http://jaws-mini:5173/",
      "http://jaws-mini:5173/oauth-callback.html",
      "http://jaws-mini.daggertooth-uaru.ts.net:5173",
      "http://jaws-mini.daggertooth-uaru.ts.net:5173/",
    ]),
  });

  const resp = await fetch(
    `${PORTAL_URL}/sharing/rest/oauth2/apps/${APP_ITEM_ID}/update`,
    { method: "POST", body }
  );
  const data = await resp.json();
  if (data.error) {
    console.error("Error:", JSON.stringify(data.error));
    process.exit(1);
  }
  console.log("Redirect URIs updated:", JSON.stringify(data));
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
