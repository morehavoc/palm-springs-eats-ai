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

// --- App Init ---
const signInOverlay = document.getElementById("sign-in-overlay");
const signInBtn = document.getElementById("sign-in-btn");
const mainMap = document.getElementById("main-map");
const assistantPanel = document.getElementById("assistant-panel");
const assistantContainer = document.getElementById("assistant-container");
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

  // Build the assistant element with ALL agents BEFORE appending to the DOM.
  // The orchestrator initializes on DOM connection (queueMicrotask in loaded()),
  // so every agent must be a child before that happens.
  const assistant = document.createElement("arcgis-assistant");
  assistant.id = "ps-assistant";
  assistant.setAttribute("log-enabled", "");
  assistant.setAttribute("copy-enabled", "");
  assistant.setAttribute("feedback-enabled", "");
  assistant.setAttribute("reference-element", "#main-map");
  assistant.setAttribute("heading", "Palm Springs Eats");
  assistant.setAttribute(
    "description",
    "Ask about restaurants near the Convention Center, or add a new spot you found!"
  );
  assistant.setAttribute(
    "entry-message",
    "Hey! I know all the best spots to eat near the Palm Springs Convention Center. " +
      "Ask me about burger joints, walkable lunch spots, or anything else. " +
      "You can even tell me about a new restaurant and I'll add it to the map! 🌴"
  );

  // Add built-in agents
  assistant.appendChild(document.createElement("arcgis-assistant-navigation-agent"));
  assistant.appendChild(document.createElement("arcgis-assistant-data-exploration-agent"));
  assistant.appendChild(document.createElement("arcgis-assistant-help-agent"));

  // Add custom restaurant adder agent
  const customAgent = document.createElement("arcgis-assistant-agent");
  customAgent.agent = createRestaurantAgent(FEATURE_LAYER_URL, CONVENTION_CENTER);
  assistant.appendChild(customAgent);
  console.log("Restaurant Adder agent registered");

  // Wait for the map view to be fully ready before showing the assistant
  mainMap.addEventListener("arcgisViewReadyChange", () => {
    console.log("Map view ready — showing assistant panel");

    // NOW append to DOM — triggers orchestrator initialization with auth + all agents
    assistantContainer.appendChild(assistant);

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
