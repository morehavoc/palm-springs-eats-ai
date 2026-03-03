// Map components (register custom elements)
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-expand";
import "@arcgis/map-components/components/arcgis-legend";

// AI components
import "@arcgis/ai-components/components/arcgis-assistant";
import "@arcgis/ai-components/components/arcgis-assistant-navigation-agent";
import "@arcgis/ai-components/components/arcgis-assistant-data-exploration-agent";
import "@arcgis/ai-components/components/arcgis-assistant-help-agent";
import "@arcgis/ai-components/components/arcgis-assistant-agent";

// Calcite design system
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-fab";

// ArcGIS core
import esriConfig from "@arcgis/core/config.js";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo.js";
import IdentityManager from "@arcgis/core/identity/IdentityManager.js";

// Custom agent
import { createRestaurantAgent } from "./agents/restaurant-agent.js";

// Component stylesheets
import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";
import "@arcgis/ai-components/main.css";

import "./style.css";

// --- Configuration ---
const PORTAL_URL = "https://moraveclabsllc.maps.arcgis.com";
const OAUTH_APP_ID = "cvA8NxPzzFf37nT0";
const FEATURE_LAYER_URL = "https://services8.arcgis.com/KsXZDThvSinzJ3pq/arcgis/rest/services/PalmSpringsEats/FeatureServer/0";

// Palm Springs Convention Center coordinates
const CONVENTION_CENTER = { longitude: -116.5453, latitude: 33.8303 };

// --- OAuth Setup ---
esriConfig.portalUrl = PORTAL_URL;

const oauthInfo = new OAuthInfo({
  appId: OAUTH_APP_ID,
  portalUrl: PORTAL_URL,
  popup: false,
});

IdentityManager.registerOAuthInfos([oauthInfo]);

// --- DOM refs ---
const signInOverlay = document.getElementById("sign-in-overlay");
const signInBtn = document.getElementById("sign-in-btn");
const mainMap = document.getElementById("main-map");
const assistantPanel = document.getElementById("assistant-panel");
const assistant = document.getElementById("ps-assistant");
const mobileFab = document.getElementById("mobile-chat-toggle");

// --- Mobile toggle ---
let chatOpen = false;
mobileFab.addEventListener("click", () => {
  chatOpen = !chatOpen;
  document.body.classList.toggle("mobile-chat-open", chatOpen);
  mobileFab.icon = chatOpen ? "map" : "speech-bubble";
  mobileFab.text = chatOpen ? "Map" : "Chat";
});

// Check if already signed in (handles redirect return with token in hash)
IdentityManager.checkSignInStatus(`${PORTAL_URL}/sharing`)
  .then(() => onSignedIn())
  .catch(() => {
    signInOverlay.style.display = "flex";
  });

signInBtn.addEventListener("click", () => {
  IdentityManager.getCredential(`${PORTAL_URL}/sharing`);
});

async function onSignedIn() {
  // Hide sign-in, show map
  signInOverlay.style.display = "none";
  mainMap.style.display = "block";

  // Register the custom agent — built-in agents are already in the HTML,
  // but custom agents need .agent set before DOM insertion (the orchestrator
  // reads agent.id on connect, so the property must exist first).
  const customAgentEl = document.createElement("arcgis-assistant-agent");
  customAgentEl.agent = createRestaurantAgent(FEATURE_LAYER_URL, CONVENTION_CENTER);
  assistant.appendChild(customAgentEl);
  console.log("Restaurant Adder agent registered");

  // Wait for the map view to be ready, then show the assistant panel
  mainMap.addEventListener("arcgisViewReadyChange", () => {
    console.log("Map view ready — showing assistant panel");

    // On desktop, show panel inline. On mobile, keep hidden — FAB toggle controls it.
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    assistantPanel.style.display = isMobile ? "none" : "block";

    // Configure suggested prompts
    assistant.suggestedPrompts = [
      "What burger places are within walking distance?",
      "Zoom to the Italian restaurants",
      "Which restaurants are the cheapest?",
      "What's near the convention center?",
    ];
  }, { once: true });
}
