import "./options.css";
import { renderOptionsApp } from "./optionsApp";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  renderOptionsApp(app).catch((error) => {
    console.error("[AO3 Tag Highlighter] Options init error:", error);
  });
}
