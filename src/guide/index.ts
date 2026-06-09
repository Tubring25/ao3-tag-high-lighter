import "./guide.css";
import { LOG_PREFIX } from "../shared/constants";
import { renderGuideApp } from "./guideApp";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  try {
    renderGuideApp(app);
  } catch (error) {
    console.error(`${LOG_PREFIX} Guide init error:`, error);
  }
}
