import "./popup.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main class="popup-shell">
      <h1>AO3 Tag Highlighter</h1>
      <p>Popup scaffold ready.</p>
    </main>
  `;
}
