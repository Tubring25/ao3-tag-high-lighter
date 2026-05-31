import { initBackgroundApp } from "./backgroundApp";
import { LOG_PREFIX } from "../shared/constants";

try {
  initBackgroundApp();
} catch (error) {
  console.error(`${LOG_PREFIX} Background init error:`, error);
}
