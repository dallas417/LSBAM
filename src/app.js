import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { AgentSystem } from './agentsystem.js'; // Ensure file path is correct
import { StormSystem } from './stormBuilder.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resultsDir = path.join(__dirname, '../results');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}

const app = express();
app.use(cors());
app.use(express.json());

// --- OPTIMIZATION: PRE-LOAD DATA ---
// We initialize the system ONCE to load the JSON from disk.
// This prevents lag every time you click "Simulate" on the frontend.
console.log("Pre-loading agent population...");
const globalAgentSystem = new AgentSystem('data');
await globalAgentSystem.loadAgents(); // Make sure loadAgents is async/await compatible
console.log("Population ready.");

// --- STORM SYSTEM CLASS (Your existing code) ---
// (Paste your SeededRNG, StormCell, and StormSystem classes here)
// ...

// --- ROUTE HANDLERS ---

app.get('/api/simulation', (req, res) => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  runSimulation(seed, res);
});

app.get('/api/simulation/:seed', (req, res) => {
  const seed = parseInt(req.params.seed);
  runSimulation(seed, res);
});

// --- THE INTEGRATION LOGIC ---

function runSimulation(seed, res) {
    console.log(`\n--- STARTING SIMULATION (Seed: ${seed}) ---`);

    // A. Initialize
    const stormSystem = new StormSystem(seed);
    
    // Reset Agents
    if (globalAgentSystem.resetSimulationState) {
        globalAgentSystem.resetSimulationState();
    } else {
        console.warn("!! resetSimulationState() missing. Stats may be inaccurate.");
    }

    const results = [];
    const totalTicks = 288; // 24 hours
    const logInterval = 48; // Log every 4 hours (48 ticks)

    // B. The Loop
    for (let i = 0; i < totalTicks; i++) {
        // 1. Tick Systems
        const tickData = stormSystem.simulateTick();
        const lightning = tickData.lightning || [];
        const cells = tickData.cells || [];
        
        globalAgentSystem.processTick(lightning, cells);

        // 2. LOGGING: Progress Update to Console
        if (i % logInterval === 0 && i > 0) {
            const progress = Math.round((i / totalTicks) * 100);
            const totalStruck = globalAgentSystem.stats.protocolA.struck + globalAgentSystem.stats.protocolB.struck;
            console.log(`[${progress}%] Time: ${tickData.tick * 5}m | Storms: ${cells.length} | Total Casualties: ${totalStruck}`);
        }

        // 3. Save Frame
        results.push({
            tick: tickData.tick,
            timestamp: tickData.timestamp,
            weather: { cells, lightning },
            stats: {
                protocolA: { ...globalAgentSystem.stats.protocolA },
                protocolB: { ...globalAgentSystem.stats.protocolB }
            }
        });
    }

    // --- C. POST-SIMULATION ANALYSIS ---

    const finalStats = globalAgentSystem.stats;
    const totalCasualties = finalStats.protocolA.struck + finalStats.protocolB.struck;

    console.log(`\n--- SIMULATION COMPLETE ---`);
    console.log(`Total Struck: ${totalCasualties}`);
    console.log(`Protocol A (10-mile rule) Struck: ${finalStats.protocolA.struck}`);
    console.log(`Protocol B (Dynamic) Struck:      ${finalStats.protocolB.struck}`);

    // --- D. WRITE TO FILE ---
    
    const report = {
        meta: {
            seed: seed,
            dateRun: new Date().toISOString(),
            duration: "24 Hours"
        },
        summary: {
            totalAgents: finalStats.protocolA.count + finalStats.protocolB.count,
            totalCasualties: totalCasualties,
            exposure: {
                protocolA_OutdoorMins: finalStats.protocolA.outdoorsMinutes,
                protocolB_OutdoorMins: finalStats.protocolB.outdoorsMinutes
            }
        },
        // Detailed breakdown
        stats: finalStats
    };

    const filename = `sim_${seed}_${Date.now()}.json`;
    const filePath = path.join(resultsDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`✓ Report saved to: ${filePath}`);
    console.log("");
    console.log(chalk.gray(`Waiting for simulation requests...`));

    // E. Send Response to Frontend
    res.json({
        seed: seed,
        totalTicks: results.length,
        finalStats: finalStats,
        data: results // Send full animation data to frontend
    });
}

export default app;