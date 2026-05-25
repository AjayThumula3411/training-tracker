const path = require("path");
const next = require("next");

require("dotenv").config({
  path: path.resolve(__dirname, "backend", ".env"),
});

require("ts-node").register({
  project: path.resolve(__dirname, "backend", "tsconfig.json"),
  transpileOnly: true,
});

const { createBackendApp } = require("./backend/src/app");

const port = Number(process.env.PORT || 3000);
const dev = !process.argv.includes("--production") && process.env.NODE_ENV !== "production";
const frontendDir = path.resolve(__dirname, "frontend");
const nextApp = next({ dev, dir: frontendDir });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = createBackendApp();

  app.all("*", (req, res) => handle(req, res));

  app.listen(port, () => {
    console.log(`Training Tracker running at http://localhost:${port}`);
  });
});
