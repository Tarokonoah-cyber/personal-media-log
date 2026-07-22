import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/noto-sans-tc";
import App from "./App";
import "./styles.css";
import "./private-workspace.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
