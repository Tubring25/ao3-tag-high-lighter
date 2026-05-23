import "../styles/content.css";
import { startContentApp } from "./contentApp";

startContentApp().catch((error) => {
  console.error("[AO3 Tag Highlighter] Init error:", error);
});
