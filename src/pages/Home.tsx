type HomeProps = {
  onCreateFile: () => void;
};

const Home = ({ onCreateFile }: HomeProps) => {
  const hasRecentFile = false;
  const recentFileName = "project.kiyo";

  return (
    <main className="home-screen">
      <div className="home-shell">
        <header className="home-header">
          <div className="logo-mark">K</div>
          <div className="home-title-wrap">
            <p className="eyebrow">Start</p>
            <h1>KIYO</h1>
          </div>
        </header>

        <section className="home-card">
          {hasRecentFile ? (
            <>
              <div className="card-top">
                <p className="eyebrow">Recent file</p>
                <h2>Continue your work</h2>
              </div>

              <div className="recent-file-box">
                <div>
                  <p className="recent-file-name">{recentFileName}</p>
                  <p className="recent-file-meta">Last opened just now</p>
                </div>

                <div className="pin-box">
                  <label className="pin-label" htmlFor="pin">
                    PIN
                  </label>
                  <input id="pin" type="password" placeholder="••••" readOnly />
                </div>
              </div>

              <div className="actions">
                <button type="button" className="primary-btn">
                  Open file
                </button>
                <button type="button" className="secondary-btn">
                  Change file
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="card-top">
                <p className="eyebrow">Get started</p>
                <h2>No recent file yet</h2>
              </div>

              <p className="card-copy">
                Create a new file or select one from your device to begin.
              </p>

              <div className="actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={onCreateFile}
                >
                  Create file
                </button>
                <button type="button" className="secondary-btn">
                  Select file
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default Home;
