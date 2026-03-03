/**
 * Custom "Restaurant Adder" agent for the Palm Springs Eats assistant.
 *
 * LangGraph flow: parseAndGeocode → addFeature
 *
 * Uses Esri's AI utility functions (invokeStructuredPrompt, sendTraceMessage)
 * and the ArcGIS REST API for geocoding + feature editing.
 *
 * The orchestrator passes { messages: [...] } and reads outputMessage from
 * the final state. Trace messages propagate through the config callbacks.
 */
import { Annotation, messagesStateReducer, StateGraph } from "@langchain/langgraph/web";
import { z } from "zod";
import {
  invokeStructuredPrompt,
  sendTraceMessage,
} from "@arcgis/ai-components/utils/index.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import Point from "@arcgis/core/geometry/Point.js";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine.js";

// --- Zod schema for structured extraction ---
const RestaurantSchema = z.object({
  name: z.string().describe("Name of the restaurant"),
  address: z.string().describe("Street address in Palm Springs, CA"),
  category: z
    .enum([
      "burger",
      "american",
      "mexican",
      "italian",
      "deli",
      "seafood",
      "asian",
      "other",
    ])
    .describe("Restaurant category"),
  priceRange: z
    .enum(["$", "$$", "$$$"])
    .describe("Price range"),
  description: z
    .string()
    .max(500)
    .describe("Short description of the restaurant"),
});

// --- State annotation ---
// Must include `messages` (from orchestrator) and `outputMessage` (read by orchestrator)
const RestaurantState = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  outputMessage: Annotation({ reducer: (_, v) => v, default: () => "" }),
});

/**
 * Create the restaurant adder agent registration object.
 */
export function createRestaurantAgent(featureLayerUrl, conventionCenter) {
  const layer = new FeatureLayer({ url: featureLayerUrl });

  // --- Node: Parse info + geocode (combined to reduce graph complexity) ---
  async function parseAndGeocode(state, config) {
    // Extract the user's last message from the messages array
    const lastUserMsg = [...state.messages]
      .reverse()
      .find((m) => m._getType?.() === "human" || m.constructor?.name === "HumanMessage");
    const userText = lastUserMsg?.content || "";

    if (!userText) {
      return { outputMessage: "I didn't catch that — could you describe the restaurant you'd like to add?" };
    }

    // Step 1: Extract restaurant info
    await sendTraceMessage(
      { text: "Extracting restaurant details..." },
      config
    );

    let parsed;
    try {
      parsed = await invokeStructuredPrompt({
        promptText:
          "You extract restaurant information from user messages. The restaurant is in Palm Springs, CA near the convention center. If the user doesn't specify a category or price, make your best guess based on the name and description.\n\nUser message: {userMessage}",
        inputVariables: { userMessage: userText },
        schema: RestaurantSchema,
      });
    } catch (err) {
      return { outputMessage: `Sorry, I couldn't extract the restaurant details: ${err.message}` };
    }

    await sendTraceMessage(
      { text: `Found: ${parsed.name} (${parsed.category}, ${parsed.priceRange})` },
      config
    );

    // Step 2: Geocode the address
    await sendTraceMessage(
      { text: `Geocoding: ${parsed.address}` },
      config
    );

    let location;
    try {
      const addr = encodeURIComponent(
        `${parsed.address}, Palm Springs, CA`
      );
      const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${addr}&outFields=*&maxLocations=1&f=json`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (!data.candidates || data.candidates.length === 0) {
        return { outputMessage: `Could not find the address "${parsed.address}" on the map. Could you double-check it?` };
      }

      const candidate = data.candidates[0];
      location = {
        longitude: candidate.location.x,
        latitude: candidate.location.y,
        matchAddress: candidate.address,
      };
    } catch (err) {
      return { outputMessage: `Geocoding failed: ${err.message}` };
    }

    // Calculate walking distance
    const restaurantPoint = new Point({
      longitude: location.longitude,
      latitude: location.latitude,
      spatialReference: { wkid: 4326 },
    });
    const centerPoint = new Point({
      longitude: conventionCenter.longitude,
      latitude: conventionCenter.latitude,
      spatialReference: { wkid: 4326 },
    });

    let walkingDistance;
    try {
      const distanceMeters = geometryEngine.geodesicLength(
        geometryEngine.geodesicDensify(
          {
            type: "polyline",
            paths: [
              [
                [centerPoint.longitude, centerPoint.latitude],
                [restaurantPoint.longitude, restaurantPoint.latitude],
              ],
            ],
            spatialReference: { wkid: 4326 },
          },
          100,
          "meters"
        ),
        "miles"
      );
      walkingDistance = Math.round(distanceMeters * 100) / 100;
    } catch {
      walkingDistance = null;
    }

    await sendTraceMessage(
      { text: `Located at ${location.matchAddress} (${walkingDistance ?? "?"} mi from convention center)` },
      config
    );

    // Step 3: Add to the feature layer
    await sendTraceMessage({ text: "Adding to the map..." }, config);

    const isWalkable = walkingDistance != null && walkingDistance <= 0.75 ? 1 : 0;

    const graphic = new Graphic({
      geometry: new Point({
        longitude: location.longitude,
        latitude: location.latitude,
        spatialReference: { wkid: 4326 },
      }),
      attributes: {
        Name: parsed.name,
        Address: parsed.address,
        Category: parsed.category,
        PriceRange: parsed.priceRange,
        WalkingDistance: walkingDistance,
        IsWalkable: isWalkable,
        Description: parsed.description,
        AddedBy: "chat-agent",
      },
    });

    try {
      const result = await layer.applyEdits({ addFeatures: [graphic] });

      if (result.addFeatureResults?.[0]?.objectId) {
        const oid = result.addFeatureResults[0].objectId;
        await sendTraceMessage(
          { text: `Added! Feature ID: ${oid}` },
          config
        );

        const walkNote = isWalkable
          ? "Within walking distance!"
          : "You might want to drive or rideshare.";
        const distNote = walkingDistance != null
          ? `${walkingDistance} mi from the convention center. ${walkNote}`
          : "";

        return {
          outputMessage:
            `**${parsed.name}** has been added to the map!\n\n` +
            `**Address:** ${parsed.address}\n` +
            `**Category:** ${parsed.category} | **Price:** ${parsed.priceRange}\n` +
            (distNote ? `**Distance:** ${distNote}\n\n` : "\n") +
            `> ${parsed.description}\n\n` +
            `The map will refresh to show the new point.`,
        };
      } else {
        const err = result.addFeatureResults?.[0]?.error;
        return {
          outputMessage: `Failed to add the restaurant: ${err?.message || "unknown error"}`,
        };
      }
    } catch (err) {
      return { outputMessage: `Failed to add restaurant: ${err.message}` };
    }
  }

  // --- Build the graph ---
  function createGraph() {
    const graph = new StateGraph(RestaurantState)
      .addNode("parseAndGeocode", parseAndGeocode)
      .addEdge("__start__", "parseAndGeocode")
      .addEdge("parseAndGeocode", "__end__");

    return graph;
  }

  // --- Agent registration ---
  return {
    id: "restaurant-adder",
    name: "Restaurant Adder",
    description:
      "Adds a new restaurant to the Palm Springs Eats map. Use this when someone wants to add, submit, or recommend a new restaurant, eatery, bar, or food spot.",
    createGraph,
    workspace: RestaurantState,
  };
}
