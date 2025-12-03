import { WebSocketServer } from 'ws';
import chalk from "chalk";

console.log("Creating server");

const wss = new WebSocketServer({ port: 8080 });
console.log(chalk.bold.green("WebSocket server running on ws://localhost:8080"));

wss.on("connection", (ws) => {
  console.log(chalk.blue("Client connected"));

  ws.send("Hello from server!");

  ws.on("message", (msg) => {
    console.log("Received:", msg.toString());
  });

  ws.on("close", () => {
    console.log(chalk.yellow("Client disconnected"));
  });
});
