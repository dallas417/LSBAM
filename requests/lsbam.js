const http = require('http');

// Generate a random 10-digit number
function generateSeed() {
  return Math.floor(1000000000 + Math.random() * 9000000000);
}

// Make a request to the simulation endpoint
function makeRequest(seed) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/simulation/${seed}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          seed,
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject({ seed, error: error.message });
    });

    req.end();
  });
}

// Main execution
async function run() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] !== 'run') {
    console.log('Usage: lsbam run <number_of_requests> [{background}]');
    console.log('Example: lsbam run 5');
    console.log('Example: lsbam run 10 {background}');
    process.exit(1);
  }

  const numRequests = parseInt(args[1], 10);
  const runInBackground = args[2] === '{background}';

  if (isNaN(numRequests) || numRequests <= 0) {
    console.error('Error: Number of requests must be a positive integer');
    process.exit(1);
  }

  // If background mode is requested, spawn a detached process
  if (runInBackground) {
    const { spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    const logFile = path.join(process.cwd(), `lsbam_${Date.now()}.log`);
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn(process.argv[0], [process.argv[1], 'run', numRequests.toString()], {
      detached: true,
      stdio: ['ignore', out, err]
    });

    child.unref();

    console.log(`Started ${numRequests} simulation request(s) in background`);
    console.log(`Output will be logged to: ${logFile}`);
    console.log(`Process ID: ${child.pid}`);
    process.exit(0);
  }

  console.log(`Starting ${numRequests} simulation request(s)...\n`);

  for (let i = 1; i <= numRequests; i++) {
    const seed = generateSeed();
    console.log(`[${i}/${numRequests}] Requesting simulation with seed: ${seed}`);
    
    try {
      const result = await makeRequest(seed);
      console.log(`  ✓ Status: ${result.statusCode}`);
      console.log(`  Response: ${result.data.substring(0, 100)}${result.data.length > 100 ? '...' : ''}`);
    } catch (error) {
      console.error(`  ✗ Error: ${error.error}`);
    }
    
    console.log('');
  }

  console.log('All requests completed.');
}

run();1~#!/usr/bin/env node

const http = require('http');

// Generate a random 10-digit number
function generateSeed() {
  return Math.floor(1000000000 + Math.random() * 9000000000);
}

// Make a request to the simulation endpoint
function makeRequest(seed) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/simulation/${seed}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          seed,
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject({ seed, error: error.message });
    });

    req.end();
  });
}

// Main execution
async function run() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] !== 'run') {
    console.log('Usage: lsbam run <number_of_requests> [{background}]');
    console.log('Example: lsbam run 5');
    console.log('Example: lsbam run 10 {background}');
    process.exit(1);
  }

  const numRequests = parseInt(args[1], 10);
  const runInBackground = args[2] === '{background}';

  if (isNaN(numRequests) || numRequests <= 0) {
    console.error('Error: Number of requests must be a positive integer');
    process.exit(1);
  }

  // If background mode is requested, spawn a detached process
  if (runInBackground) {
    const { spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    const logFile = path.join(process.cwd(), `lsbam_${Date.now()}.log`);
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn(process.argv[0], [process.argv[1], 'run', numRequests.toString()], {
      detached: true,
      stdio: ['ignore', out, err]
    });

    child.unref();

    console.log(`Started ${numRequests} simulation request(s) in background`);
    console.log(`Output will be logged to: ${logFile}`);
    console.log(`Process ID: ${child.pid}`);
    process.exit(0);
  }

  console.log(`Starting ${numRequests} simulation request(s)...\n`);

  for (let i = 1; i <= numRequests; i++) {
    const seed = generateSeed();
    console.log(`[${i}/${numRequests}] Requesting simulation with seed: ${seed}`);
    
    try {
      const result = await makeRequest(seed);
      console.log(`  ✓ Status: ${result.statusCode}`);
      console.log(`  Response: ${result.data.substring(0, 100)}${result.data.length > 100 ? '...' : ''}`);
    } catch (error) {
      console.error(`  ✗ Error: ${error.error}`);
    }
    
    console.log('');
  }

  console.log('All requests completed.');
}

run();
