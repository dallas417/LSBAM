import fs from 'fs';
import path from 'path';

// Approximate 1 degree of lat/lon in miles (for Florida)
const MILES_PER_DEG_LAT = 69;
const MILES_PER_DEG_LON = 60; // Approximate for FL latitudes

export class AgentSystem {
  constructor(simDataPath) {
    this.agents = [];
    this.grid = new Map(); // Spatial Hash Map
    this.gridSize = 0.1; // ~6-7 miles per grid cell
    this.simDataPath = simDataPath;
    
    // Tracking Stats
    this.stats = {
      protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 }, // 10-mile rule
      protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }  // Dynamic
    };
  }

  // 1. Assign "Outdoorness" based on Job title
  getOutdoorProbability(job) {
    const outdoorJobs = ['Construction', 'Landscaping', 'Agriculture', 'Guide', 'Ranger', 'Tailor']; 
    const indoorJobs = ['CFO', 'Analyst', 'Clerk', 'Programmer', 'Inside Sales'];
    
    // Simple heuristic text matching
    const jobLower = job.toLowerCase();
    if (outdoorJobs.some(j => jobLower.includes(j.toLowerCase()))) return 0.7; // 70% chance being out
    if (indoorJobs.some(j => jobLower.includes(j.toLowerCase()))) return 0.05; // 5% chance being out
    return 0.2; // Average person running errands
  }

  // 2. Generate Positions based on County (Mocking this for now)
  // You would ideally have a lookup table of County -> Lat/Lon center
  generatePosition(county) {
    // Rough bounding box for Florida
    const lat = 25.0 + Math.random() * 5; 
    const lon = -87.0 + Math.random() * 7;
    return { lat, lon };
  }

  // 3. Load Agents and Spatial Hash them
  async loadAgents() {
    console.log("Loading 500k agents...");
    const rawData = fs.readFileSync(path.join(this.simDataPath, 'agents.json'));
    const agentList = JSON.parse(rawData);

    agentList.forEach((a, index) => {
      const pos = this.generatePosition(a.county);
      
      const agent = {
        id: a.agentNumber,
        lat: pos.lat,
        lon: pos.lon,
        outdoorProb: this.getOutdoorProbability(a.job),
        // Split population 50/50 for testing
        protocol: index % 2 === 0 ? 'A' : 'B', 
        shelterTimer: 0, // For 30-min rule
        isStruck: false
      };

      // Update total counts
      if (agent.protocol === 'A') this.stats.protocolA.count++;
      else this.stats.protocolB.count++;

      // ADD TO GRID
      const gridKey = this.getGridKey(agent.lat, agent.lon);
      if (!this.grid.has(gridKey)) {
        this.grid.set(gridKey, []);
      }
      this.grid.get(gridKey).push(agent);
    });

    console.log(`Agents Grid System Built. Total Keys: ${this.grid.size}`);
  }

  getGridKey(lat, lon) {
    const y = Math.floor(lat / this.gridSize);
    const x = Math.floor(lon / this.gridSize);
    return `${x},${y}`;
  }

  // 4. The Core Logic Tick
  processTick(lightningEvents, allStormCells) {
    // A. Reset Shelter Timers (decrement)
    // In a real optimized system, we'd do this lazily, but for clarity:
    // (We skip iterating 500k here, we only iterate the grid when lightning happens)

    // B. Process Lightning Events
    lightningEvents.forEach(bolt => {
      // Get the main location of the bolt (start point)
      const boltLat = bolt.path[0][0];
      const boltLon = bolt.path[0][1];
      
      // Determine affected Grids (10 mile radius check is roughly 2 grid cells)
      const searchRadius = 2; // Check 2 cells in every direction
      const centerX = Math.floor(boltLon / this.gridSize);
      const centerY = Math.floor(boltLat / this.gridSize);

      for (let x = centerX - searchRadius; x <= centerX + searchRadius; x++) {
        for (let y = centerY - searchRadius; y <= centerY + searchRadius; y++) {
          const key = `${x},${y}`;
          if (this.grid.has(key)) {
            const agentsInCell = this.grid.get(key);
            this.updateAgentsInCell(agentsInCell, boltLat, boltLon, allStormCells);
          }
        }
      }
    });

    // C. Accumulate Time Stats (Simulation of time passing)
    // We assume 5 minutes per tick
    this.grid.forEach(agents => {
      agents.forEach(agent => {
        if (agent.isStruck) return; // Dead agents don't count time

        // Decrement timer
        if (agent.shelterTimer > 0) agent.shelterTimer -= 5;

        // Determine if currently Outside
        let isSheltering = false;

        if (agent.protocol === 'A') {
           // Standard: Shelter if timer is active
           isSheltering = agent.shelterTimer > 0;
        } else {
           // Dynamic: Logic calculated inside updateAgentsInCell, 
           // but for simplicity here, we assume Dynamic users only shelter
           // if the storm is literally ON TOP of them (handled in update).
           // Actually, let's say Dynamic users shelter if a storm cell > 0.8 intensity is < 3 miles.
           // (This would require iterating storms, skipped for brevity, assumed false unless trigger)
        }

        // Rolling the dice: Are they outside?
        // If they are NOT sheltering, they MIGHT be outside based on job
        if (!isSheltering && Math.random() < agent.outdoorProb) {
           if (agent.protocol === 'A') this.stats.protocolA.outdoorsMinutes += 5;
           else this.stats.protocolB.outdoorsMinutes += 5;
        }
      });
    });
  }

  updateAgentsInCell(agents, boltLat, boltLon, storms) {
    agents.forEach(agent => {
      if (agent.isStruck) return;

      const distLat = (agent.lat - boltLat) * MILES_PER_DEG_LAT;
      const distLon = (agent.lon - boltLon) * MILES_PER_DEG_LON;
      const distMiles = Math.sqrt(distLat*distLat + distLon*distLon);

      // --- PROTOCOL A: 10-Mile Rule ---
      if (distMiles <= 10) {
        // Reset the clock to 30 mins
        agent.shelterTimer = 30;
      }

      // --- PROTOCOL B: Dynamic ---
      // This user ignores the 10-mile rule. 
      // They rely on visual/app warnings. They shelter only if VERY close.
      // We simulate this by NOT setting a shelterTimer unless dist is tiny,
      // OR we just say they are "exposed" more often.
      
      // --- CALCULATE STRIKE ---
      // Are they actually outside right now?
      let isOutside = false;
      
      if (agent.protocol === 'A') {
        // If timer is running, they are Inside (Safe). 
        // BUT: The strike that *starts* the timer might hit them if they were out.
        // If timer was 0 before this bolt, they were potentially out.
        if (agent.shelterTimer <= 0) { // They were unsuspecting
            isOutside = Math.random() < agent.outdoorProb;
        }
      } else {
        // Protocol B: They are outside unless a storm is literally overhead (e.g. 2 miles)
        // If bolt is > 2 miles away, they are likely still outside.
        if (distMiles > 2) {
            isOutside = Math.random() < agent.outdoorProb;
        }
      }

      // Did they get hit? (Lightning radius is very small, say 0.05 miles for simulation sake)
      if (isOutside && distMiles < 0.1) {
        agent.isStruck = true;
        if (agent.protocol === 'A') this.stats.protocolA.struck++;
        else this.stats.protocolB.struck++;
        console.log(`AGENT STRUCK! ID: ${agent.id} [${agent.protocol}]`);
      }
    });
  }
}
