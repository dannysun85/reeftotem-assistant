console.log("main.tsx loading...");

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("imports loaded");

const root = document.getElementById("root");
console.log("root element:", root);

if (root) {
  console.log("creating React root...");
  const reactRoot = ReactDOM.createRoot(root);
  console.log("rendering App...");
  reactRoot.render(<App />);
  console.log("App rendered!");
} else {
  console.error("Root element not found!");
}
