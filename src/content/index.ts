import "../styles/content.css";
import { LOG_PREFIX } from "../shared/constants";
import { startContentApp } from "./contentApp";

startContentApp().catch((error) => {
  console.error(`${LOG_PREFIX} Init error:`, error);
});
