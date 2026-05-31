import "./options.css";
import { LOG_PREFIX } from "../shared/constants";
import { renderOptionsApp } from "./optionsApp";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  renderOptionsApp(app).catch((error) => {
    console.error(`${LOG_PREFIX} Options init error:`, error);
  });
}
