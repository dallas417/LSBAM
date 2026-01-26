import { parentPort } from 'worker_threads';

// Approximate 1 degree of lat/lon in miles (for Florida)
const MILES_PER_DEG_LAT = 69;
const MILES_PER_DEG_LON = 60; 

class AgentSystemShard {
  constructor() {
    this.grid = new Map(); // Spatial Hash Map
    this.gridSize = 0.1;
    
    // Local stats for this specific worker
    this.stats = {
      protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 },
      protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }
    };
  }

  init(agents) {
    agents.forEach(agent => {
      const managedAgent = {
        ...agent,
        shelterTimer: 0,
        isStruck: false
      };

      if (managedAgent.protocol === 'A') this.stats.protocolA.count++;
      else this.stats.protocolB.count++;

      // ADD TO GRID
      const gridKey = this.getGridKey(managedAgent.lat, managedAgent.lon);
      if (!this.grid.has(gridKey)) {
        this.grid.set(gridKey, []);
      }
      this.grid.get(gridKey).push(managedAgent);
    });
  }

  getGridKey(lat, lon) {
    const y = Math.floor(lat / this.gridSize);
    const x = Math.floor(lon / this.gridSize);
    return `${x},${y}`;
  }

  processTick(lightningEvents, timeScalar = 1.0) {
    // 1. Process Lightning Impacts
    lightningEvents.forEach(bolt => {
      const boltLat = bolt.path[0][0];
      const boltLon = bolt.path[0][1];
      
      const searchRadius = 2; // Check 2 cells in every direction
      const centerX = Math.floor(boltLon / this.gridSize);
      const centerY = Math.floor(boltLat / this.gridSize);

      for (let x = centerX - searchRadius; x <= centerX + searchRadius; x++) {
        for (let y = centerY - searchRadius; y <= centerY + searchRadius; y++) {
          const key = `${x},${y}`;
          if (this.grid.has(key)) {
            // NOTE: We pass timeScalar here so strike logic knows if they are outside
            this.updateAgentsInCell(this.grid.get(key), boltLat, boltLon, timeScalar);
          }
        }
      }
    });

    // 2. Accumulate Time Stats
    this.grid.forEach(agents => {
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        if (agent.isStruck) continue;

        // Decrement timer
        if (agent.shelterTimer > 0) agent.shelterTimer -= 5;

        let isSheltering = false;
        if (agent.protocol === 'A') {
            isSheltering = agent.shelterTimer > 0;
        }

        // --- DYNAMIC PROBABILITY ---
        // Base Probability (Job/Hobby) * Time of Day Factor
        const currentProb = agent.outdoorProb * timeScalar;

        // Rolling the dice: Are they outside?
        if (!isSheltering && Math.random() < currentProb) {
            if (agent.protocol === 'A') this.stats.protocolA.outdoorsMinutes += 5;
            else this.stats.protocolB.outdoorsMinutes += 5;
        }
      }
    });

    return this.stats;
  }

  updateAgentsInCell(agents, boltLat, boltLon, timeScalar) {
    agents.forEach(agent => {
      if (agent.isStruck) return;

      const distLat = (agent.lat - boltLat) * MILES_PER_DEG_LAT;
      const distLon = (agent.lon - boltLon) * MILES_PER_DEG_LON;
      const distMiles = Math.sqrt(distLat*distLat + distLon*distLon);

      // --- PROTOCOL A: 10-Mile Rule ---
      if (distMiles <= 10) {
        agent.shelterTimer = 30;
      }

      // --- CALCULATE STRIKE ---
      let isOutside = false;
      
      // Calculate current probability based on time of day
      const currentProb = agent.outdoorProb * timeScalar;

      if (agent.protocol === 'A') {
        if (agent.shelterTimer <= 0) {
            isOutside = Math.random() < currentProb;
        }
      } else {
        // Protocol B: Outside unless storm is overhead (> 2 miles away = outside)
        if (distMiles > 2) {
            isOutside = Math.random() < currentProb;
        }
      }

      // Hit Check (0.1 mile radius)
      if (isOutside && distMiles < 0.1) {
        agent.isStruck = true;
        if (agent.protocol === 'A') this.stats.protocolA.struck++;
        else this.stats.protocolB.struck++;
      }
    });
  }

  reset() {
    this.stats = {
      protocolA: { outdoorsMinutes: 0, struck: 0, count: 0 },
      protocolB: { outdoorsMinutes: 0, struck: 0, count: 0 }
    };
    
    this.grid.forEach(agents => {
        for(let i=0; i<agents.length; i++) {
            const agent = agents[i];
            agent.isStruck = false;
            agent.shelterTimer = 0;
            // Re-tally population
            if (agent.protocol === 'A') this.stats.protocolA.count++;
            else this.stats.protocolB.count++;
        }
    });
  }
}

// --- WORKER MESSAGE HANDLER ---
const system = new AgentSystemShard();

parentPort.on('message', (msg) => {
    try {
        if (msg.type === 'ADD_BATCH') {
            system.init(msg.agents);
        }

        if (msg.type === 'INIT_FINALIZE') {
            parentPort.postMessage({ type: 'INIT_DONE' });
        }

        if (msg.type === 'RESET') {
            system.reset();
            parentPort.postMessage({ type: 'RESET_DONE' });
        }

        if (msg.type === 'TICK') {
            // Extract timeScalar (default to 1.0 if missing)
            const stats = system.processTick(msg.lightningEvents, msg.timeScalar || 1.0);
            parentPort.postMessage({ type: 'TICK_DONE', stats });
        }
    } catch (error) {
        console.error("Worker Error:", error);
    }
});