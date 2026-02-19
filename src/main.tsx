import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { createLogger, initializeLogger } from "./utils/Logger";

initializeLogger('main');
const logger = createLogger('main');

logger.info("main.tsx loading");
logger.info("imports loaded");

const root = document.getElementById("root");
logger.debug("root element resolved", root);

if (root) {
  logger.info("creating React root");
  const reactRoot = ReactDOM.createRoot(root);
  logger.info("rendering App");
  reactRoot.render(<App />);
  logger.info("App rendered");
} else {
  logger.error("Root element not found");
}
