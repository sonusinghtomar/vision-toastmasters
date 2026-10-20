// Shown until src/config.js has a real Firebase config.
export default function Setup() {
  return (
    <main className="login">
      <div className="card stack">
        <h1>Almost there</h1>
        <p>The app is installed but not connected to a Firebase project yet.</p>
        <ol>
          <li>Create a Firebase project and a Web app.</li>
          <li>Paste its config into <code>src/config.js</code>.</li>
          <li>Commit. GitHub Actions will redeploy the app.</li>
        </ol>
        <p className="muted">Step-by-step guide: <code>docs/SETUP.md</code> in the repository.</p>
      </div>
    </main>
  )
}
