const fs = require("fs");
const src = fs.readFileSync(
  "node_modules/@arcgis/ai-orchestrator/dist/index.js",
  "utf-8"
);

// Find createWebmapEmbeddings (ct) and getEmbeddings (K) implementations
// ct is exported as createWebmapEmbeddings, K as getEmbeddings

// Find 'ct' definition
const ctPattern = /\bct\s*=\s*/g;
let m;
while ((m = ctPattern.exec(src)) !== null) {
  if (m.index > 5000) {
    console.log("=== ct (createWebmapEmbeddings) at pos", m.index, "===");
    console.log(src.substring(m.index, m.index + 500));
    console.log("...\n");
  }
}

// Find 'K' definition — look for async function patterns
// K is likely defined as: const K = async ... or async function K
const lines = src.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Look for K = assignments that are near embeddings code
  if (
    /\bK\s*=\s*async/.test(line) ||
    /async\s+function\s+K\b/.test(line) ||
    /getEmbedding/.test(line)
  ) {
    console.log(`Line ${i}: ${line.substring(0, 200)}`);
  }
}

// Also look for the model being used in fetch calls to aiutils
const apiIdx = src.indexOf("aiutils");
if (apiIdx >= 0) {
  console.log("\n=== aiutils reference ===");
  console.log(src.substring(Math.max(0, apiIdx - 200), apiIdx + 300));
}

// Look for the embeddings worker initialization
const workerIdx = src.indexOf("embeddings.worker");
if (workerIdx >= 0) {
  console.log("\n=== embeddings worker ref ===");
  console.log(src.substring(Math.max(0, workerIdx - 200), workerIdx + 300));
}
