import { spawn } from "node:child_process";

const commands = [
  { name: "server", args: ["run", "dev", "-w", "server"] },
  { name: "client", args: ["run", "dev", "-w", "client"] }
];

const children = commands.map(({ name, args }) => {
  const child = spawn("npm", args, {
    stdio: "pipe",
    shell: true,
    env: process.env
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
