import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Seeded Random Number Generator
class SeededRNG {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Storm Cell
class StormCell {
  constructor(lat, lon, intensity, id, rng) {
    this.id = id;
    this.lat = lat;
    this.lon = lon;
    this.intensity = intensity;
    this.age = 0;
    // UPDATED: Longer life span for better screen presence
    this.maxAge = 36 + Math.floor(rng.next() * 48); 
    this.radius = 5 + intensity * 15;
    
    // UPDATED: Slightly faster movement for more dynamic feel
    this.vx = (rng.next() - 0.5) * 0.025;
    this.vy = (rng.next() - 0.3) * 0.025;
    
    this.lightningTimer = Math.floor(rng.next() * 5);
    this.active = true;
  }

  update(rng) {
    this.age++;
    this.lat += this.vy;
    this.lon += this.vx;
    this.lightningTimer--;

    // Growth and decay
    if (this.age < this.maxAge * 0.3) { // UPDATED: Longer growth phase
      // Growth phase
      this.intensity = Math.min(1, this.intensity + 0.05); // Faster growth
    } else if (this.age > this.maxAge * 0.8) {
      // Decay phase
      this.intensity = Math.max(0, this.intensity - 0.03); 
    }

    this.radius = 5 + this.intensity * 15;

    if (this.age > this.maxAge || this.intensity < 0.1) {
      this.active = false;
    }
  }

  shouldGenerateLightning(rng) {
    // UPDATED: Lowered threshold slightly (0.6 -> 0.45) so medium storms spark too
    if (this.lightningTimer <= 0 && this.intensity > 0.45) {
        // Reset timer: Higher intensity = faster recharge
        const rechargeSpeed = this.intensity > 0.8 ? 2 : 4;
        this.lightningTimer = 1 + Math.floor(rng.next() * rechargeSpeed);
        return true;
    }
    return false;
  }

  generateLightningPath(rng) {
    const path = [[this.lat, this.lon]];
    let lat = this.lat;
    let lon = this.lon;

    const segments = 3 + Math.floor(rng.next() * 4);
    for (let i = 0; i < segments; i++) {
      lat += (rng.next() - 0.5) * 0.04;
      lon += (rng.next() - 0.5) * 0.04;
      path.push([lat, lon]);
    }

    return path;
  }

  toJSON() {
    return {
      id: this.id,
      lat: this.lat,
      lon: this.lon,
      radius: this.radius,
      intensity: this.intensity
    };
  }
}

// Storm System
class StormSystem {
  constructor(seed) {
    this.rng = new SeededRNG(seed);
    this.cells = [];
    this.nextId = 0;
    this.currentTick = 0;
    this.spawnTimer = 0;
    this.bounds = {
      north: 31.0,
      south: 24.5,
      west: -87.6,
      east: -80.0
    };
    
    // UPDATED: Skewed RNG so "Calm" days are rare. 
    // Minimum 0.4, most likely 0.7+
    this.weatherState = 0.4 + (this.rng.next() * 0.6); 
  }

  isInBounds(cell) {
    return cell.lat >= this.bounds.south - 1 &&
           cell.lat <= this.bounds.north + 1 &&
           cell.lon >= this.bounds.west - 1 &&
           cell.lon <= this.bounds.east + 1;
  }

  spawnSeaBreeze(coast) {
    // UPDATED: Removed the "too calm check" or lowered it significantly
    if (this.weatherState < 0.2) return;

    // UPDATED: Massive increase in cluster size (Was 1-3, Now 3-7 cells)
    const numCells = 3 + Math.floor(this.rng.next() * 5);
    
    const baseLat = this.bounds.south + this.rng.next() * (this.bounds.north - this.bounds.south);

    for (let i = 0; i < numCells; i++) {
      // Clump them tighter together
      const lat = baseLat + (this.rng.next() - 0.5) * 0.8; 
      const lon = coast === 'east'
        ? this.bounds.east - 0.5 - this.rng.next() * 1.5
        : this.bounds.west + 0.5 + this.rng.next() * 1.5;
      
      // Variable start intensity
      const intensity = 0.3 + this.rng.next() * 0.5;

      this.cells.push(new StormCell(lat, lon, intensity, this.nextId++, this.rng));
    }
  }

  spawnRandomCell() {
    const lat = this.bounds.south + this.rng.next() * (this.bounds.north - this.bounds.south);
    const lon = this.bounds.west + this.rng.next() * (this.bounds.east - this.bounds.west);
    const intensity = 0.3 + this.rng.next() * 0.5;

    this.cells.push(new StormCell(lat, lon, intensity, this.nextId++, this.rng));
  }

  spawnStorm() {
    // UPDATED: Widened the "Active Window"
    // Noon is approx tick 144. Window is now ~10:30am to ~8:30pm
    const isActiveHours = this.currentTick > 80 && this.currentTick < 250;
    
    // UPDATED: Increased base probabilities
    const spawnChance = isActiveHours ? 0.9 : 0.3; 
    
    if (this.rng.next() > spawnChance) return;

    // UPDATED: Removed the hard cutoff for weatherState < 0.5
    
    const spawnType = this.rng.next();
    if (spawnType < 0.45) {
      this.spawnSeaBreeze('east');
    } else if (spawnType < 0.90) {
      this.spawnSeaBreeze('west');
    } else {
      this.spawnRandomCell();
    }
  }

  simulateTick() {
    this.currentTick++;

    // Update existing cells
    this.cells = this.cells.filter(cell => {
      cell.update(this.rng);
      return cell.active && this.isInBounds(cell);
    });

    // Spawn new cells
    this.spawnTimer--;
    if (this.spawnTimer <= 0) {
      this.spawnStorm();
      // UPDATED: Faster spawn cycle. 
      // Was 12-32 ticks (1-2.5h). Now 5-15 ticks (25m - 1h15m)
      this.spawnTimer = 5 + Math.floor(this.rng.next() * 10); 
    }

    // Generate lightning
    const lightning = [];
    this.cells.forEach(cell => {
      if (cell.shouldGenerateLightning(this.rng)) {
        lightning.push({
          id: `${cell.id}-${this.currentTick}`,
          path: cell.generateLightningPath(this.rng)
        });
      }
    });

    return {
      tick: this.currentTick,
      timestamp: this.currentTick * 5, 
      cells: this.cells.map(c => c.toJSON()),
      lightning: lightning
    };
  }

  simulate24Hours() {
    const results = [];
    const totalTicks = (24 * 60) / 5; // 288 ticks for 24 hours

    for (let i = 0; i < totalTicks; i++) {
      results.push(this.simulateTick());
    }

    return results;
  }
}

const simulations = new Map();

// API Routes
app.get('/api/simulate-progress/:id', (req, res) => {
  const simId = req.params.id;
  const seed = Date.now();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const system = new StormSystem(seed);
  const totalTicks = 288;

  let tick = 0;
  const interval = setInterval(() => {
    if (tick >= totalTicks) {
      clearInterval(interval);
      res.write('data: {"done": true}\n\n');
      res.end();
      return;
    }

    const tickData = system.simulateTick();
    res.write(`data: ${JSON.stringify({
      tick: tick,
      progress: ((tick / totalTicks) * 100).toFixed(1),
      cells: tickData.cells.length,
      lightning: tickData.lightning.length
    })}\n\n`);

    tick++;
  }, 20); 
});

app.get('/api/simulation', (req, res) => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  console.log(`Generating simulation with seed: ${seed}`);

  const system = new StormSystem(seed);
  const data = system.simulate24Hours();

  res.json({
    seed: seed,
    date: today.toISOString().split('T')[0],
    totalTicks: data.length,
    data: data
  });
});

app.get('/api/simulation/:seed', (req, res) => {
  const seed = parseInt(req.params.seed);

  console.log(`Generating simulation with custom seed: ${seed}`);

  const system = new StormSystem(seed);
  const data = system.simulate24Hours();

  res.json({
    seed: seed,
    totalTicks: data.length,
    data: data
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Storm simulation server running on port ${PORT}`);
});
