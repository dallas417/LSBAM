import http from 'http';
import chalk from "chalk";
import readline from "readline";
import app from './app.js';

const PREFERRED_PORT = process.env.PORT || 3001;
const PROMPT_TIMEOUT = 10000; 

const asciiArt = `
 ██╗     ███████╗██████╗  █████╗ ███╗   ███╗
 ██║     ██╔════╝██╔══██╗██╔══██╗████╗ ████║
 ██║     ███████╗██████╔╝███████║██╔████╔██║
 ██║     ╚════██║██╔══██╗██╔══██║██║╚██╔╝██║
 ███████╗███████║██████╔╝██║  ██║██║ ╚═╝ ██║
 ╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝
`;

const lines = asciiArt.split('\n').filter(line => line.trim());
const colors = [
  chalk.rgb(173, 216, 230),
  chalk.rgb(135, 206, 250),
  chalk.rgb(100, 149, 237),
  chalk.rgb(65, 105, 225),
  chalk.rgb(30, 144, 255),
  chalk.rgb(0, 119, 190)
];

function displayHeader() {
  console.log('');
  lines.forEach((line, index) => {
    const colorFn = colors[index] || colors[colors.length - 1]; 
    console.log(colorFn(line));
  });
  console.log('');
  console.log(chalk.bold.blue("Lightning Sheltering Behavior Assessment Model"));
}

function promptForNewPort() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Non-interactive environment detected'));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

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

function startServer(port) {
  const server = http.createServer(app);

  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('');
      console.log(chalk.red.bold(`✗ Error: Port ${port} is already in use!`));
      console.log(chalk.yellow(`  Another process is using this port.`));
      
      try {
        const newPort = await promptForNewPort();
        startServer(newPort, true);
      } catch (promptErr) {
        console.log('');
        console.log(chalk.red('Server startup failed.'));
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

  server.on('listening', () => {
    displayHeader();
    
    console.log('');
    console.log(chalk.green(`✓ LSBAM Server running on port ${port}`));
    console.log(chalk.gray(`Waiting for simulation requests...`));
    console.log('');
  });

  server.listen(port);
}

startServer(PREFERRED_PORT);