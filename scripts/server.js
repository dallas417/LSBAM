import chalk from "chalk";

const asciiArt = `
 ██╗     ███████╗██████╗  █████╗ ███╗   ███╗
 ██║     ██╔════╝██╔══██╗██╔══██╗████╗ ████║
 ██║     ███████╗██████╔╝███████║██╔████╔██║
 ██║     ╚════██║██╔══██╗██╔══██║██║╚██╔╝██║
 ███████╗███████║██████╔╝██║  ██║██║ ╚═╝ ██║
 ╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝
`;

// Blue gradient from light to dark
const lines = asciiArt.split('\n').filter(line => line.trim());
const colors = [
  chalk.rgb(173, 216, 230), // Light blue
  chalk.rgb(135, 206, 250), // Sky blue
  chalk.rgb(100, 149, 237), // Cornflower blue
  chalk.rgb(65, 105, 225),  // Royal blue
  chalk.rgb(30, 144, 255),  // Dodger blue
  chalk.rgb(0, 119, 190)    // Deep blue
];

console.log('');
lines.forEach((line, index) => {
  console.log(colors[index](line));
});
console.log('');
console.log(chalk.bold.blue("Lightning Sheltering Behavior Assessment Model"));
console.log(chalk.bold.green("Starting..."));
