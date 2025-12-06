// server.js - Interactive port selection with timeout for automated environments
import chalk from "chalk";
import readline from "readline";
import app from './app.js';

const PREFERRED_PORT = process.env.PORT || 3001;
const PROMPT_TIMEOUT = 10000; // 10 seconds timeout for automated environments

const asciiArt = `
 ██╗     ███████╗██████╗  █████╗ ███╗   ███╗
 ██║     ██╔════╝██╔══██╗██╔══██╗████╗ ████║
 ██║     ███████╗██████╔╝███████║██╔████╔██║
 ██║     ╚════██║██╔══██╗██╔══██║██║╚██╔╝██║
 ███████╗███████║██████╔╝██║  ██║██║ ╚═╝ ██║
 ╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝
`;

// Blue gradient logic
const lines = asciiArt.split('\n').filter(line => line.trim());
const colors = [
  chalk.rgb(173, 216, 230),
  chalk.rgb(135, 206, 250),
  chalk.rgb(100, 149, 237),
  chalk.rgb(65, 105, 225),
  chalk.rgb(30, 144, 255),
  chalk.rgb(0, 119, 190)
];

let headerDisplayed = false;

// Display ASCII art function
function displayHeader() {
  if (headerDisplayed) return;
  
  console.log('');
  lines.forEach((line, index) => {
    const colorFn = colors[index] || colors[colors.length - 1]; 
    console.log(colorFn(line));
  });
  console.log('');
  console.log(chalk.bold.blue("Lightning Sheltering Behavior Assessment Model"));
  
  headerDisplayed = true;
}

// Function to prompt user for a different port
function promptForNewPort() {
  return new Promise((resolve, reject) => {
    // Check if we're in an interactive terminal
    if (!process.stdin.isTTY) {
      reject(new Error('Non-interactive environment detected'));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Set timeout for automated environments
    const timeout = setTimeout(() => {
      rl.close();
      reject(new Error('Prompt timeout'));
    }, PROMPT_TIMEOUT);

    console.log('');
    rl.question(chalk.cyan('Would you like to try a different port? (y/n): '), (answer) => {
      clearTimeout(timeout);
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        rl.question(chalk.cyan('Enter port number: '), (port) => {
          rl.close();
          const portNum = parseInt(port, 10);
          
          if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            reject(new Error('Invalid port number'));
          } else {
            resolve(portNum);
          }
        });
      } else {
        rl.close();
        reject(new Error('User declined'));
      }
    });
  });
}

// Function to start server on a given port
function startServer(port, isRetry = false) {
  const server = app.listen(port, () => {
    // Display header only once, before showing success message
    displayHeader();
    
    console.log('');
    if (isRetry) {
      console.log(chalk.green(`✓ Successfully started on port ${port}`));
    } else {
      console.log(chalk.green(`✓ LSBAM Server running on port ${port}`));
    }
    console.log(chalk.gray(`Waiting for simulation requests...`));
    console.log('');
  });

  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      // Display header only once before showing error
      displayHeader();
      
      console.log('');
      console.log(chalk.red.bold(`✗ Error: Port ${port} is already in use!`));
      console.log(chalk.yellow(`  Another process is using this port.`));
      
      try {
        const newPort = await promptForNewPort();
        startServer(newPort, true);
      } catch (promptErr) {
        // Timeout or non-interactive environment or user declined
        console.log('');
        console.log(chalk.red('Server startup failed.'));
        console.log(chalk.gray(`  For automated environments, use: PORT=3002 node server.js`));
        console.log('');
        process.exit(1);
      }
    } else {
      console.log('');
      console.error(chalk.red('Server error:'), err);
      console.log('');
      process.exit(1);
    }
  });
}

// Start the server
startServer(PREFERRED_PORT);
