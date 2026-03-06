# 🌴 Palm Springs Eats AI

Chat with a map of restaurants near the Palm Springs Convention Center, built with the new [ArcGIS Maps SDK for JavaScript 5.0](https://developers.arcgis.com/javascript/latest/) AI Components (beta).

Built-in AI agents handle navigation and data exploration. A custom LangGraph agent lets you add new restaurants through conversation.

> This is the companion repo for my [newsletter post](https://christophermoravec.com) about building with Esri's new agentic mapping components.

## What It Does

The app has three built-in agents (provided by Esri) and one custom agent:

- **Navigation Agent** — "Zoom to the Italian restaurants"
- **Data Exploration Agent** — "Which restaurants are the cheapest?"
- **Help Agent** — "What can I ask about this map?"
- **Restaurant Adder** (custom) — "Add Lulu California Bistro at 200 S Palm Canyon Dr"

The custom agent flow looks like this:

```
User says "Add Lulu California Bistro at 200 S Palm Canyon Dr"
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Orchestrator detects intent → routes to    │
│  "Restaurant Adder" agent                   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  1. Extract structured data (LLM + Zod)      │
│     → name, address, category, price,        │
│       description                            │
│                                              │
│  2. Geocode the address                      │
│     → World Geocoding Service                │
│                                              │
│  3. Calculate walking distance               │
│     → geometryEngine.geodesicLength          │
│                                              │
│  4. Write feature to hosted layer            │
│     → FeatureLayer.applyEdits()              │
│                                              │
│  5. Return confirmation to chat              │
└──────────────────────────────────────────────┘
```

## Prerequisites

- An [ArcGIS Online](https://www.arcgis.com/) organizational account
- AI assistants privilege enabled by your org admin
- Node.js 18+

The app uses OAuth 2.0 for authentication. The AI components use Esri's managed LLM backend through your ArcGIS identity — no separate API keys needed.

## Setup

```bash
git clone https://github.com/morehavoc/palm-springs-eats-ai.git
cd palm-springs-eats-ai
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with your ArcGIS Online account.

## Project Structure

```
├── index.html                     # App shell — map + assistant panel + agents declared in HTML
├── src/
│   ├── main.js                    # OAuth setup, agent registration, mobile toggle
│   ├── agents/
│   │   └── restaurant-agent.js    # Custom "Restaurant Adder" LangGraph agent
│   └── style.css                  # Layout + sign-in overlay + mobile responsive
├── vite.config.js
└── package.json
```

## How the AI Components Work

The JS SDK 5.0 AI components are web components. Drop them into your HTML and you get a chat panel with agent orchestration:

```html
<arcgis-assistant reference-element="#main-map"
                  heading="Palm Springs Eats"
                  description="Ask about restaurants near the Convention Center">
  <arcgis-assistant-navigation-agent></arcgis-assistant-navigation-agent>
  <arcgis-assistant-data-exploration-agent></arcgis-assistant-data-exploration-agent>
  <arcgis-assistant-help-agent></arcgis-assistant-help-agent>
  <arcgis-assistant-agent id="custom-agent"></arcgis-assistant-agent>
</arcgis-assistant>
```

Under the hood, the SDK uses [LangGraph](https://langchain-ai.github.io/langgraphjs/). It routes your natural language through an orchestrator that picks the right agent based on each agent's `description` field. All LLM calls go through Esri's managed backend via your ArcGIS identity.

## Building a Custom Agent

A custom agent is an object with `id`, `name`, `description`, and a `createGraph()` function that returns a LangGraph `StateGraph`:

```js
export function createRestaurantAgent(featureLayerUrl, conventionCenter) {
  function createGraph() {
    const graph = new StateGraph(RestaurantState)
      .addNode("parseAndGeocode", parseAndGeocode)
      .addEdge("__start__", "parseAndGeocode")
      .addEdge("parseAndGeocode", "__end__");
    return graph;   // Return uncompiled — the orchestrator compiles it
  }

  return {
    id: "restaurant-adder",
    name: "Restaurant Adder",
    description: "Adds a new restaurant to the Palm Springs Eats map.",
    createGraph,
    workspace: RestaurantState,
  };
}
```

The state contract between your agent and the orchestrator is simple: the orchestrator writes to `messages` (LangChain messages array) and reads `outputMessage` (a string) from the final state.

### Useful AI Utility Functions

Esri provides utility functions in `@arcgis/ai-components/utils`:

- **`invokeStructuredPrompt`** — Send a prompt to the managed LLM and get structured data back using a Zod schema. This is how the custom agent extracts restaurant name, address, category, etc. from a free-text message.
- **`sendTraceMessage`** — Send status updates to the user during agent execution. Great for transparency and debugging.

## Things I Learned

**Metadata is everything.** The AI components use embeddings generated from your web map's metadata. Field names like `Nme` and `dol` don't help; `Name` with a description of "Name of the restaurant" does. Good metadata → better AI results. You can generate embeddings from the web map settings page in ArcGIS Online.

**Agent registration timing matters.** The orchestrator takes a one-time snapshot of registered agents during initialization. If you set `.agent` too late (after sign-in, after an `await`), the orchestrator won't know about your agent. Set it synchronously at the module top-level:

```js
// Must happen before any async work
document.getElementById("custom-agent").agent =
  createRestaurantAgent(FEATURE_LAYER_URL, CONVENTION_CENTER);
```

**System prompts are client-side.** If you need to keep them private, you'll need additional steps.

**Return the graph uncompiled.** `createGraph()` should return the `StateGraph`, not the compiled graph — the orchestrator handles compilation.

## Tech Stack

- [ArcGIS Maps SDK for JavaScript 5.0](https://developers.arcgis.com/javascript/latest/) (`@arcgis/core`, `@arcgis/map-components`)
- [ArcGIS AI Components](https://developers.arcgis.com/javascript/latest/agentic-apps/ai-introduction/) (`@arcgis/ai-components`) — beta
- [LangGraph](https://langchain-ai.github.io/langgraphjs/) (via `@langchain/langgraph/web`)
- [Calcite Design System](https://developers.arcgis.com/calcite-design-system/) (`@esri/calcite-components`)
- [Vite](https://vite.dev/)
- [Zod](https://zod.dev/) (via `@arcgis/ai-components`)

## License

MIT
