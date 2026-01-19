import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AgentSystem {
  constructor(simDataPath) {
    this.simDataPath = simDataPath;
    this.workers = [];
    
    // Aggregated Stats (Publicly accessible by app.js)
    this.stats = {
      protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 },
      protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }
    };
  }

  getOutdoorProbability(job) {
    const outdoorJobs = ['Construction', 'Landscaping', 'Agriculture', 'Guide', 'Ranger', 'Tailor']; 
    const indoorJobs = ['CFO', 'Analyst', 'Clerk', 'Programmer', 'Inside Sales'];
    const jobLower = job.toLowerCase();
    if (outdoorJobs.some(j => jobLower.includes(j.toLowerCase()))) return 0.7; 
    if (indoorJobs.some(j => jobLower.includes(j.toLowerCase()))) return 0.05; 
    return 0.2; 
  }

  generatePosition(county) {
    const lat = 25.0 + Math.random() * 5; 
    const lon = -87.0 + Math.random() * 7;
    return { lat, lon };
  }

  async loadAgents() {
    
    // A. Setup Workers first
    const numCPUs = os.cpus().length;
    const workerCount = Math.max(2, numCPUs - 1);
    console.log(`Spawning ${workerCount} workers...`);

    for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(path.join(__dirname, 'agentsystem.worker.js'));
        this.workers.push(worker);
    }

    // B. Create a Stream Reader
    const filePath = path.join(this.simDataPath, 'agents.json');
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentWorkerIndex = 0;
    let agentBuffer = [];
    const CHUNK_SIZE = 50000; // Send agents in batches to workers
    let totalLoaded = 0;

    // C. Stream line-by-line to bypass the 2GB limit
    for await (const line of rl) {
        let cleanLine = line.trim();
        // Remove JSON formatting characters if they exist
        if (cleanLine.startsWith('[')) cleanLine = cleanLine.substring(1);
        if (cleanLine.endsWith(']') || cleanLine.endsWith(',')) cleanLine = cleanLine.slice(0, -1);
        
        if (!cleanLine) continue;

        try {
            const agent = JSON.parse(cleanLine);
            
            // Pre-process position/protocol immediately to save worker time
            const pos = this.generatePosition(agent.county);
            agentBuffer.push({
                id: agent.agentNumber,
                lat: pos.lat,
                lon: pos.lon,
                outdoorProb: this.getOutdoorProbability(agent.job),
                protocol: totalLoaded % 2 === 0 ? 'A' : 'B'
            });

            // If buffer is full, send to a worker
            if (agentBuffer.length >= CHUNK_SIZE) {
                this.workers[currentWorkerIndex].postMessage({ type: 'ADD_BATCH', agents: agentBuffer });
                
                // Rotate to next worker (Load Balancing)
                currentWorkerIndex = (currentWorkerIndex + 1) % workerCount;
                agentBuffer = [];
            }

            totalLoaded++;
            if (totalLoaded % 1000000 === 0) console.log(`Loaded ${totalLoaded / 1000000}M agents...`);

        } catch (e) { /* Skip non-JSON lines */ }
    }

    // Send remaining agents
    if (agentBuffer.length > 0) {
        this.workers[currentWorkerIndex].postMessage({ type: 'ADD_BATCH', agents: agentBuffer });
    }

    // D. Signal all workers that loading is complete
    const initPromises = this.workers.map(worker => {
        return new Promise((resolve) => {
            worker.once('message', (msg) => { if (msg.type === 'INIT_DONE') resolve(); });
            worker.postMessage({ type: 'INIT_FINALIZE' });
        });
    });

    await Promise.all(initPromises);
    console.log(`✅ System Ready: ${totalLoaded} agents distributed across ${workerCount} workers.`);
}

  async resetSimulationState() {
    const promises = this.workers.map(w => new Promise(resolve => {
        w.once('message', (msg) => {
            if (msg.type === 'RESET_DONE') resolve();
        });
        w.postMessage({ type: 'RESET' });
    }));
    await Promise.all(promises);
    
    // Zero out main thread stats
    this.stats = {
      protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 },
      protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }
    };
  }
}