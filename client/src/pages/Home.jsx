import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiArrowRight,
  FiCheck,
  FiCode,
  FiLayers,
  FiLock,
  FiMonitor,
  FiSettings,
  FiShield,
  FiTerminal,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import NavBar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import '../styles/homepage.css';

const features = [
  {
    icon: FiShield,
    title: 'Inspect before execution',
    text: 'Inspect request bodies, query parameters, and relevant headers before a request reaches your application routes.',
  },
  {
    icon: FiLayers,
    title: 'Rules meet heuristics',
    text: 'Combine configurable keyword and regular-expression rules with heuristic indicators to score suspicious input.',
  },
  {
    icon: FiSettings,
    title: 'Tune your protection',
    text: 'Choose low, normal, or high strictness to adjust the score threshold used when allowing or blocking a request.',
  },
  {
    icon: FiActivity,
    title: 'Understand each incident',
    text: 'Review decisions, timestamps, detection scores, and request details in a shared dashboard when using hybrid mode.',
  },
  {
    icon: FiUsers,
    title: 'Give your team a workspace',
    text: 'Register a service, then let administrators create team accounts and manage access within that service.',
  },
  {
    icon: FiZap,
    title: 'Keep inspection local',
    text: 'Run detection inside your Node.js process. Hybrid mode adds dashboard visibility while console logging remains available.',
  },
];
const steps = [
  [
    'Intercept',
    'Capture the incoming HTTP request before your application routes run.',
  ],
  [
    'Normalise',
    'Decode and normalise input to make suspicious patterns easier to identify.',
  ],
  [
    'Evaluate',
    'Evaluate enabled rules and heuristic indicators to produce a detection score.',
  ],
  [
    'Decide & log',
    'Allow or block using your strictness threshold, then log the decision.',
  ],
];

export default function Homepage() {
  return (
    <div className="Homepage">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <NavBar />
      <main id="main-content">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-text">
            <span className="eyebrow">
              <span className="status-dot" /> SQL INJECTION DEFENCE FOR NODE.JS
            </span>
            <h1 id="hero-title">
              Keep malicious input
              <br />
              <span>out of your application.</span>
            </h1>
            <p>
              Meet SQLiShield: lightweight security middleware that inspects
              HTTP requests, detects SQL injection patterns, and gives your team
              a clearer view of suspicious activity.
            </p>
            <div className="hero-actions">
              <Link className="Button button-primary" to="/signup">
                Register your service <FiArrowRight />
              </Link>
              <Link className="Button button-secondary" to="/#how-it-works">
                See how it works
              </Link>
            </div>
            <div className="hero-tags">
              <span>
                <FiCheck /> Local inspection
              </span>
              <span>
                <FiCheck /> Configurable rules
              </span>
              <span>
                <FiCheck /> Live visibility
              </span>
            </div>
          </div>
          <div
            className="inspection-preview"
            aria-label="Illustrative SQL injection inspection"
          >
            <div className="preview-top">
              <span>
                <FiTerminal /> REQUEST INSPECTION
              </span>
              <span className="badge">Example</span>
            </div>
            <div className="preview-request">
              <span className="method-tag">GET</span>
              <code>/products?id=1 OR 1=1--</code>
            </div>
            <div className="inspection-stages">
              <div>
                <span className="stage-mark">
                  <FiCheck />
                </span>
                <span>Request normalised</span>
                <span className="muted">01</span>
              </div>
              <div>
                <span className="stage-mark">
                  <FiCheck />
                </span>
                <span>Rules & heuristics evaluated</span>
                <span className="muted">02</span>
              </div>
              <div>
                <span className="stage-mark danger-mark">
                  <FiShield />
                </span>
                <span>Suspicious input detected</span>
                <span className="muted">03</span>
              </div>
            </div>
            <div className="preview-result">
              <div>
                <span className="eyebrow">DECISION</span>
                <strong>Request blocked</strong>
              </div>
              <span className="badge badge-danger">
                <FiLock /> BLOCK
              </span>
            </div>
            <p className="preview-note">
              Illustration of the inspection flow. Actual decisions depend on
              your rules and strictness.
            </p>
          </div>
        </section>
        <div className="context-strip">
          <div className="container">
            <FiCode />
            <p>
              One inspection layer. <strong>Two ways to monitor.</strong> Built
              for Express applications.
            </p>
            <a href="#modes">
              Explore operating modes <FiArrowRight />
            </a>
          </div>
        </div>
        <section id="features" className="home-section container">
          <div className="section-heading">
            <span className="eyebrow">BUILT AROUND YOUR SERVICE</span>
            <h2>
              Protection you can inspect.
              <br />
              Controls you can understand.
            </h2>
            <p>
              From the first request to a shared incident review, keep your
              detection workflow visible and configurable.
            </p>
          </div>
          <div className="features">
            {features.map(({ icon: Icon, title, text }) => (
              <article className="feature-card" key={title}>
                <span className="feature-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="home-section workflow-section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">FROM REQUEST TO DECISION</span>
              <h2>A clear path through every inspection.</h2>
              <p>
                SQLiShield evaluates input inside your application’s request
                pipeline.
              </p>
            </div>
            <div className="steps">
              {steps.map(([title, text], index) => (
                <article className="step" key={title}>
                  <span className="step-number">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="modes" className="home-section container">
          <div className="section-heading">
            <span className="eyebrow">CHOOSE YOUR VISIBILITY</span>
            <h2>Start locally. Bring your team into view.</h2>
            <p>
              The same inspection engine, with the logging workflow that fits
              your setup.
            </p>
          </div>
          <div className="mode-grid">
            <article className="mode-card">
              <FiTerminal className="mode-icon" />
              <span className="eyebrow">LOCAL MODE</span>
              <h3>Console-first monitoring</h3>
              <p>
                Run request inspection and view decisions directly in your
                application console.
              </p>
              <ul>
                <li>
                  <FiCheck /> Console logging only
                </li>
                <li>
                  <FiCheck /> Useful for development and local testing
                </li>
                <li>
                  <FiCheck /> No dashboard log stream
                </li>
              </ul>
            </article>
            <article className="mode-card mode-featured">
              <FiMonitor className="mode-icon" />
              <span className="eyebrow">HYBRID MODE</span>
              <h3>A shared security workspace</h3>
              <p>
                Combine local console logs with dashboard visibility through a
                live connection.
              </p>
              <ul>
                <li>
                  <FiCheck /> Console logging plus dashboard events
                </li>
                <li>
                  <FiCheck /> Incident review and service management
                </li>
                <li>
                  <FiCheck /> Administrator-managed team access
                </li>
              </ul>
              <Link to="/signup" className="text-link">
                Register your service <FiArrowRight />
              </Link>
            </article>
          </div>
        </section>
        <section
          id="documentation"
          className="home-section container documentation-section"
        >
          <div>
            <span className="eyebrow">INTEGRATION GUIDE</span>
            <h2>Fit protection into your existing request flow.</h2>
            <p>
              Mount SQLiShield after your body parsers and before the routes you
              want to protect. Choose an operating mode and strictness level in
              your middleware configuration.
            </p>
            <ol className="setup-list">
              <li>
                <strong>Prepare your middleware.</strong>
                <span>
                  Use your SQLiShield backend package and its documented import.
                </span>
              </li>
              <li>
                <strong>Choose your mode.</strong>
                <span>
                  Use local for console logs, or register a service for hybrid
                  monitoring.
                </span>
              </li>
              <li>
                <strong>Review and tune.</strong>
                <span>
                  Inspect decisions and adjust custom rules to suit your
                  application.
                </span>
              </li>
            </ol>
            <p className="integration-note">
              Use parameterised database queries alongside SQLiShield. Input
              inspection is one part of application security.
            </p>
          </div>
          <div className="code-panel">
            <div className="code-panel-heading">
              <FiCode /> Express integration · illustrative
            </div>
            <pre>
              <code>{`// Import mywaf from your SQLiShield package.\napp.use(express.json());\napp.use(express.urlencoded({ extended: true }));\n\napp.use(mywaf({\n  mode: "local",\n  strict: "normal"\n}));\n\n// Protected application routes come next.\napp.use("/api", applicationRoutes);`}</code>
            </pre>
            <p>
              For hybrid mode, use your backend’s service authentication and
              connection configuration. Never place service secrets in browser
              code.
            </p>
          </div>
        </section>
        <section className="home-cta container">
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h2>Give your application a security workspace.</h2>
          <p>
            Register your service, create your administrator account, and bring
            your team together around the same view of incidents.
          </p>
          <Link className="Button button-primary" to="/signup">
            Create your service <FiArrowRight />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
