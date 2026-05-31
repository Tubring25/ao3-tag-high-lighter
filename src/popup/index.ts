import "./popup.css";
import { LOG_PREFIX } from "../shared/constants";
import { renderPopupApp } from "./popupApp";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  renderPopupApp(app).catch((error) => {
    console.error(`${LOG_PREFIX} Popup init error:`, error);
  });
}
