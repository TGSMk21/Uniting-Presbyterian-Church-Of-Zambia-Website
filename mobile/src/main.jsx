import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "@fontsource-variable/newsreader/opsz.css";
import "./design/tokens.css";
import "./design/base.css";
import "./design/app.css";
import App from "./App.jsx";

// "user": every animation follows the phone's "reduce motion" setting.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
