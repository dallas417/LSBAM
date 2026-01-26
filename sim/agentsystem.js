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
    
    // Aggregated Stats
    this.stats = {
      protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 },
      protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }
    };
  }

  /**
   * Calculates the base probability of an agent being outside based on 
   * their Job (base requirement) and Hobbies (lifestyle boost).
   */
  getOutdoorProbability(job, hobbiesString) {
    let prob = 0.15; // Default: Office/Indoor baseline

    const jobLower = job.toLowerCase();
    
    // --- 1. JOB CLASSIFICATION ---
    
    // High Exposure Jobs (70% Base)
    // "Farm Laborer", "Landscaper", "Construction", "Street Sweeper", "Police", "Firefighter", "Solar", "Post"
    const highOutdoorKeywords = [
        'farm', 'landscap', 'construction', 'laborer', 'street', 'parking', 'dog walker', 
        'police', 'fire', 'ranger', 'guide', 'messenger', 'delivery', 'postal', 
        'geologist', 'surveyor', 'solar', 'roof', 'environmental'
    ];

    // Medium Exposure / Trade Jobs (40% Base)
    // "Electrician", "Plumber", "Carpenter", "Welder", "Mechanic", "HVAC", "Driver", "Security"
    const mediumOutdoorKeywords = [
        'electrician', 'plumber', 'carpenter', 'welder', 'mechanic', 'hvac', 
        'technician', 'driver', 'truck', 'security', 'guard', 'bellhop', 
        'photographer', 'journalist', 'real estate', 'architect', 'planner'
    ];

    // Low Exposure / Indoor Jobs (5% Base)
    // "Software", "Data", "Clerk", "Teller", "Surgeon", "Lawyer"
    const strictIndoorKeywords = [
        'software', 'developer', 'data', 'clerk', 'teller', 'accountant', 'analyst',
        'cfo', 'ceo', 'executive', 'admin', 'assistant', 'receptionist', 'attorney',
        'lawyer', 'judge', 'physician', 'surgeon', 'nurse', 'dentist', 'pharmacist',
        'librarian', 'teacher', 'professor', 'scientist', 'biologist', 'chemist',
        'cashier', 'baker', 'chef', 'cook', 'bartender'
    ];

    if (highOutdoorKeywords.some(k => jobLower.includes(k))) {
        prob = 0.75;
    } else if (mediumOutdoorKeywords.some(k => jobLower.includes(k))) {
        prob = 0.45;
    } else if (strictIndoorKeywords.some(k => jobLower.includes(k))) {
        prob = 0.05;
    }

    // --- 2. HOBBY BOOST ---
    
    // Hobbies listed in agentBuilder.js that imply outdoor time
    const outdoorHobbyKeywords = [
        'beach', 'fishing', 'boating', 'swimming', 'snorkeling', 'scuba', 'diving',
        'surfing', 'paddle', 'kayak', 'golf', 'tennis', 'hiking', 'bird', 
        'photography', 'camp', 'cycl', 'bike', 'ski', 'sail', 'wildlife', 
        'garden', 'collecting', 'pickleball', 'run', 'jog', 'yoga', 'horse', 
        'nature', 'rv', 'climb', 'skate', 'basket', 'soccer', 'baseball', 
        'football', 'astronomy', 'restoration'
    ];

    // Check hobbies string (e.g. "[Fishing,Gaming]")
    // We give a small boost for every outdoor hobby found
    if (hobbiesString) {
        const hobbiesLower = hobbiesString.toLowerCase();
        let outdoorHobbiesFound = 0;
        
        outdoorHobbyKeywords.forEach(k => {
            if (hobbiesLower.includes(k)) outdoorHobbiesFound++;
        });

        // Cap hobby boost at +25%
        const boost = Math.min(0.25, outdoorHobbiesFound * 0.12);
        prob += boost;
    }

    // Final Safety Cap (No one is outside > 95% of the time)
    return Math.min(0.95, prob);
  }

  generatePosition(county) {
    // Keeps existing logic, though could be expanded with county-specific lat/lon bounds
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
    const CHUNK_SIZE = 50000;
    let totalLoaded = 0;

    // C. Stream line-by-line
    console.log("Parsing agents and assigning behavior profiles...");
    for await (const line of rl) {
        let cleanLine = line.trim();
        if (cleanLine.startsWith('[')) cleanLine = cleanLine.substring(1);
        if (cleanLine.endsWith(']') || cleanLine.endsWith(',')) cleanLine = cleanLine.slice(0, -1);
        
        if (!cleanLine) continue;

        try {
            const agent = JSON.parse(cleanLine);
            
            const pos = this.generatePosition(agent.county);
            
            // --- CORE CHANGE: Pass Hobbies to Prob Calc ---
            const outdoorProb = this.getOutdoorProbability(agent.job, agent.hobbies);

            agentBuffer.push({
                id: agent.agentNumber,
                lat: pos.lat,
                lon: pos.lon,
                outdoorProb: outdoorProb,
                protocol: totalLoaded % 2 === 0 ? 'A' : 'B'
            });

            if (agentBuffer.length >= CHUNK_SIZE) {
                this.workers[currentWorkerIndex].postMessage({ type: 'ADD_BATCH', agents: agentBuffer });
                currentWorkerIndex = (currentWorkerIndex + 1) % workerCount;
                agentBuffer = [];
            }

            totalLoaded++;
            if (totalLoaded % 100000 === 0) process.stdout.write(`\rLoaded ${totalLoaded} agents...`);

        } catch (e) { /* Skip non-JSON lines */ }
    }
    console.log("");

    if (agentBuffer.length > 0) {
        this.workers[currentWorkerIndex].postMessage({ type: 'ADD_BATCH', agents: agentBuffer });
    }

    // D. Finalize Workers
    const initPromises = this.workers.map(worker => {
        return new Promise((resolve) => {
            worker.once('message', (msg) => { if (msg.type === 'INIT_DONE') resolve(); });
            worker.postMessage({ type: 'INIT_FINALIZE' });
        });
    });

    await Promise.all(initPromises);
    console.log(`✅ System Ready: ${totalLoaded} agents distributed across ${workerCount} workers.`);
  }

  async processTick(lightning, cells, tickCount) {
    
    // --- TIME OF DAY LOGIC ---
    // Assuming 288 ticks = 24 hours.
    // Ticks 0-72 (Midnight to 6am) -> Night (Low activity)
    // Ticks 72-216 (6am to 6pm)    -> Day (Full activity)
    // Ticks 216-288 (6pm to Midnight) -> Evening (Tapering)
    
    let timeScalar = 0.1; // Default Night (People sleep)

    if (tickCount >= 80 && tickCount <= 220) { 
        // 6:40 AM to 6:20 PM -> Work/Day
        timeScalar = 1.0; 
    } else if (tickCount > 60 && tickCount < 80) {
        // 5:00 AM to 6:40 AM -> Morning Ramp Up
        timeScalar = 0.5;
    } else if (tickCount > 220 && tickCount < 260) {
        // 6:20 PM to 9:40 PM -> Evening Activity
        timeScalar = 0.4;
    }

    const promises = this.workers.map(worker => {
      return new Promise((resolve, reject) => {
        worker.once('message', (msg) => {
          if (msg.type === 'TICK_DONE') resolve(msg.stats);
          else reject(new Error(`Unexpected message: ${msg.type}`));
        });
        
        // Pass timeScalar to worker
        worker.postMessage({ 
          type: 'TICK', 
          lightningEvents: lightning,
          cells: cells,
          timeScalar: timeScalar 
        });
      });
    });

    const shardStats = await Promise.all(promises);
    this.aggregateStats(shardStats);
  }

  aggregateStats(shardStatsArray) {
    this.stats = {
        protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 },
        protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }
    };

    shardStatsArray.forEach(shard => {
        this.stats.protocolA.outdoorsMinutes += shard.protocolA.outdoorsMinutes;
        this.stats.protocolA.struck += shard.protocolA.struck;
        this.stats.protocolA.count += shard.protocolA.count;

        this.stats.protocolB.outdoorsMinutes += shard.protocolB.outdoorsMinutes;
        this.stats.protocolB.struck += shard.protocolB.struck;
        this.stats.protocolB.count += shard.protocolB.count;
    });
  }

  async resetSimulationState() {
    console.log("Resetting simulation state across workers...");
    const promises = this.workers.map(w => new Promise(resolve => {
        w.once('message', (msg) => {
            if (msg.type === 'RESET_DONE') resolve();
        });
        w.postMessage({ type: 'RESET' });
    }));
    
    await Promise.all(promises);
    
    this.stats = {
      protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 },
      protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }
    };
  }
}