import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { AgentSystem } from './agentsystem.js'; 
import { StormSystem } from './stormBuilder.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define results directory (One level up from 'sim')
const resultsDir = path.join(__dirname, '../results');

// Ensure the directory exists
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve the results folder statically
app.use('/results', express.static(resultsDir));

// --- OPTIMIZATION: PRE-LOAD DATA ---
console.log("Pre-loading agent population...");
const globalAgentSystem = new AgentSystem('data');
await globalAgentSystem.loadAgents(); 
console.log("Population ready.");


// --- ROUTE HANDLERS ---

/**
 * GET /api/simulation/:seed
 * READ-ONLY: Looks for an EXISTING simulation file.
 */
app.get('/api/simulation/:seed', (req, res) => {
    const seed = req.params.seed;
    console.log(`GET Request (Lookup) for Seed: ${seed}`);

    fs.readdir(resultsDir, (err, files) => {
        if (err) {
            console.error("Error reading results directory:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        const prefix = `sim_${seed}_`;
        const matches = files.filter(f => f.startsWith(prefix) && f.endsWith('.json'));

        if (matches.length === 0) {
            console.warn(`404: No simulation found for seed ${seed}`);
            return res.status(404).json({ error: `No simulation found for seed ${seed}. Run in terminal first.` });
        }

        // Find most recent
        const latestFile = matches.sort((a, b) => {
            const timeA = parseInt(a.split('_')[2]);
            const timeB = parseInt(b.split('_')[2]);
            return timeB - timeA; 
        })[0];

        const filePath = path.join(resultsDir, latestFile);
        console.log(`Serving file: ${latestFile}`);
        
        fs.readFile(filePath, 'utf8', (readErr, data) => {
            if (readErr) {
                console.error("Error reading simulation file:", readErr);
                return res.status(500).json({ error: "Failed to read simulation data" });
            }

            try {
                const jsonData = JSON.parse(data);
                res.json({
                    seed: jsonData.meta.seed,
                    totalTicks: jsonData.timeline.length,
                    finalStats: jsonData.stats,
                    data: jsonData.timeline 
                });
            } catch (parseErr) {
                console.error("Error parsing JSON:", parseErr);
                res.status(500).json({ error: "Corrupt simulation file" });
            }
        });
    });
});

/**
 * POST /api/simulation/:seed
 * GENERATION: Triggers a new simulation run.
 * Used by npm run sim / lsbam.js
 */
app.post('/api/simulation/:seed', (req, res) => {
    const seed = parseInt(req.params.seed);
    if (isNaN(seed)) {
        return res.status(400).json({ error: "Invalid seed" });
    }
    console.log(`POST Request (Generate) for Seed: ${seed}`);
    runSimulation(seed, res);
});


// --- SIMULATION LOGIC ---

async function runSimulation(seed, res = null) {
    console.log(`\n--- STARTING SIMULATION (Seed: ${seed}) ---`);

    // A. Initialize
    const stormSystem = new StormSystem(seed);
    
    if (globalAgentSystem.resetSimulationState) {
        await globalAgentSystem.resetSimulationState(); 
    }

    const results = [];
    const totalTicks = 288; // 24 hours
    const logInterval = 48; 

    // B. The Loop
    for (let i = 0; i < totalTicks; i++) {
        const tickData = stormSystem.simulateTick();
        const lightning = tickData.lightning || [];
        const cells = tickData.cells || [];
        
        await globalAgentSystem.processTick(lightning, cells, i);

        if (i % logInterval === 0 && i > 0) {
            const progress = Math.round((i / totalTicks) * 100);
            const totalStruck = globalAgentSystem.stats.protocolA.struck + globalAgentSystem.stats.protocolB.struck;
            console.log(`[${progress}%] Time: ${tickData.tick * 5}m | Storms: ${cells.length} | Total Casualties: ${totalStruck}`);
        }

        // C. Save Frame
        // FIX: Removed 'weather' nesting so frontend doesn't crash
        results.push({
            tick: tickData.tick,
            timestamp: tickData.timestamp,
            cells: cells,         // <--- Direct property
            lightning: lightning, // <--- Direct property
            stats: {
                protocolA: { ...globalAgentSystem.stats.protocolA },
                protocolB: { ...globalAgentSystem.stats.protocolB }
            }
        });
    }

    const finalStats = globalAgentSystem.stats;
    const totalCasualties = finalStats.protocolA.struck + finalStats.protocolB.struck;

    console.log(`\n--- SIMULATION COMPLETE ---`);
    console.log(`Total Struck: ${totalCasualties}`);

    // D. WRITE TO FILE
    const report = {
        meta: {
            seed: seed,
            dateRun: new Date().toISOString(),
            duration: "24 Hours"
        },
        summary: {
            totalAgents: finalStats.protocolA.count + finalStats.protocolB.count,
            totalCasualties: totalCasualties,
        },
        stats: finalStats,
        timeline: results
    };

    const filename = `sim_${seed}_${Date.now()}.json`;
    const filePath = path.join(resultsDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`✓ Report saved to: ${filePath}`);

    // E. Send Response
    if (res) {
        res.json({
            seed: seed,
            totalTicks: results.length,
            finalStats: finalStats,
            data: results 
        });
    }
}

export default app;