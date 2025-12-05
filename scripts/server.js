// server.js
import chalk from "chalk";
import app from './app.js';

const PORT = process.env.PORT || 3001;

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

console.log('');
lines.forEach((line, index) => {
  // Safety check in case lines > colors
  const colorFn = colors[index] || colors[colors.length - 1]; 
  console.log(colorFn(line));
});
console.log('');
console.log(chalk.bold.blue("Lightning Sheltering Behavior Assessment Model"));

// Start the server
app.listen(PORT, () => {
  console.log(chalk.green(`✓ LSBAM Server running on port ${PORT}`));
  console.log(chalk.gray(`Waiting for simulation requests...`));
});