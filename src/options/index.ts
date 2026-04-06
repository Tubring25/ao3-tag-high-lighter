import "./options.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main class="options-shell">
      <h1>AO3 Tag Highlighter</h1>
      <p>Options scaffold ready.</p>
    </main>
  `;
}
