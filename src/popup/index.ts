import "./popup.css";
import { renderPopupApp } from "./popupApp";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  renderPopupApp(app).catch((error) => {
    console.error("[AO3 Tag Highlighter] Popup init error:", error);
  });
}
