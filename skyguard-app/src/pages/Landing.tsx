import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronRight, Radio, Sparkles, Waypoints, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import "../landing.css";

const metrics = [["500+", "Live sensor nodes"], ["99.7%", "Data integrity"], ["< 2 min", "Anomaly detection"], ["85%", "Predictive confidence"]];
const features = [
  { icon: Radio, title: "Real-Time Data Collection", text: "Ingest high-frequency telemetry from every station in your network." },
  { icon: Sparkles, title: "AI Anomaly Detection", text: "Surface subtle sensor drift and weather events before they become operational risks." },
  { icon: Waypoints, title: "Predictive Root Cause Analysis", text: "Move from an alert to an answer with context-rich, explainable diagnostics." },
];
const useCases = [
  { number: "01", title: "Agriculture & Farming", text: "Protect yields with hyperlocal forecasts, soil signals, and early frost warnings.", image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80" },
  { number: "02", title: "Aviation & Transport", text: "Keep people and infrastructure moving with dependable visibility into changing conditions.", image: "https://images.unsplash.com/photo-1478827387698-1527781a4887?auto=format&fit=crop&w=900&q=80" },
  { number: "03", title: "Smart Cities & Infrastructure", text: "Build resilient systems around the environmental signals your city cannot ignore.", image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80" },
];

function DashboardPreview() {
  const telemetry = [["TEMP", "24.3 °C", "HEALTHY"], ["WIND", "40.2 km/h", "WATCH"], ["PRESSURE", "1012 hPa", "STABLE"]];
  return <div className="dashboard-preview" aria-label="SkyGuard monitoring dashboard preview">
    <div className="preview-topline"><span className="status-dot" /> SKYGUARD / NETWORK_OVERVIEW <span className="preview-live">LIVE · 128 NODES</span></div>
    <div className="preview-grid">
      <div className="preview-sidebar"><p className="preview-label">LIVE TELEMETRY</p>{telemetry.map(([name, value, state]) => <div className="telemetry-row" key={name}><span>{name}</span><strong>{value}</strong><small className={state === "WATCH" ? "watch" : ""}>{state}</small></div>)}</div>
      <div className="preview-chart"><div className="chart-heading"><span>Network anomaly activity</span><b>Last 24 hours</b></div><div className="chart-area"><span className="chart-line cyan-line" /><span className="chart-line amber-line" /><i className="chart-point one" /><i className="chart-point two" /><i className="chart-point three" /></div><div className="chart-alert"><Zap size={11} /> Anomaly detected at Station 042 · confidence 96.4%</div></div>
    </div>
  </div>;
}

function SensorNetworkGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.z = 4.3;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    scene.add(globe);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x197e9e, transparent: true, opacity: 0.42, wireframe: true })
    );
    globe.add(sphere);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.43, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x08c7e6, transparent: true, opacity: 0.1, side: THREE.BackSide })
    );
    globe.add(atmosphere);
    const orbitRings = [
      { rotation: [0.2, 0.25, 0] as [number, number, number], color: 0x08c7e6 },
      { rotation: [1.15, -0.4, 0.45] as [number, number, number], color: 0xf7bd3c },
    ];
    orbitRings.forEach(({ rotation, color }) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.008, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
      ring.rotation.set(...rotation);
      globe.add(ring);
    });

    const sensors = [
      { lat: 28.6, lng: 77.2, color: 0x08c7e6, size: 0.055 },
      { lat: 19.1, lng: 72.9, color: 0x08c7e6, size: 0.06 },
      { lat: 13.1, lng: 80.3, color: 0xf7bd3c, size: 0.065 },
      { lat: 12.9, lng: 77.6, color: 0x08c7e6, size: 0.05 },
      { lat: 26.9, lng: 75.8, color: 0xf7bd3c, size: 0.05 },
      { lat: 22.6, lng: 88.4, color: 0x08c7e6, size: 0.045 },
      { lat: 17.4, lng: 78.5, color: 0xf06d5b, size: 0.075 },
      { lat: 23.3, lng: 85.3, color: 0x08c7e6, size: 0.045 },
    ];
    const points: THREE.Mesh[] = [];
    const latLngToVector = (lat: number, lng: number) => {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lng + 180) * Math.PI / 180;
      return new THREE.Vector3(-1.4 * Math.sin(phi) * Math.cos(theta), 1.4 * Math.cos(phi), 1.4 * Math.sin(phi) * Math.sin(theta));
    };
    sensors.forEach(({ lat, lng, color, size }) => {
      const point = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 12), new THREE.MeshBasicMaterial({ color }));
      point.position.copy(latLngToVector(lat, lng));
      globe.add(point);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(size * 2.4, 12, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 }));
      halo.position.copy(point.position);
      globe.add(halo);
      points.push(point);
    });
    const links = new THREE.BufferGeometry().setFromPoints(sensors.slice(0, -1).flatMap(({ lat, lng }, index) => [latLngToVector(lat, lng), latLngToVector(sensors[index + 1].lat, sensors[index + 1].lng)]));
    globe.add(new THREE.LineSegments(links, new THREE.LineBasicMaterial({ color: 0x08c7e6, transparent: true, opacity: 0.22 })));

    const resize = () => { const { width, height } = mount.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    let frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); if (!pausedRef.current) globe.rotation.y += 0.0018; points.forEach((point, index) => { const pulse = 1 + Math.sin(Date.now() * 0.003 + index) * 0.18; point.scale.setScalar(pulse); }); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); sphere.geometry.dispose(); (sphere.material as THREE.Material).dispose(); atmosphere.geometry.dispose(); (atmosphere.material as THREE.Material).dispose(); links.dispose(); points.forEach((point) => { point.geometry.dispose(); (point.material as THREE.Material).dispose(); }); renderer.domElement.remove(); };
  }, []);

  return <div className="sensor-globe" onMouseEnter={() => { pausedRef.current = true; }} onMouseLeave={() => { pausedRef.current = false; }}><div ref={mountRef} className="sensor-globe-canvas" /><div className="globe-caption"><span className="globe-pulse" /> LIVE SENSOR NETWORK <b>128 NODES</b></div><div className="globe-legend"><span><i className="legend-cyan" /> Healthy</span><span><i className="legend-amber" /> Watch</span><span><i className="legend-red" /> Anomaly</span></div></div>;
}

export function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    const revealItems = document.querySelectorAll<HTMLElement>(".scroll-reveal");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return <main className="landing-page">
    <nav className="landing-nav"><a className="wordmark" href="/"><img src="/skyguard-mark.svg" alt="" className="wordmark-mark" /> SkyGuard</a><div className="nav-links"><a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#use-cases">Use cases</a><a href="#pricing">Pricing</a><a href="#contact">Contact</a></div><button className="nav-action" onClick={() => navigate("/login")}>Access Console <ArrowUpRight size={13} /></button></nav>
    <section className="landing-hero"><div className="hero-kicker">INTELLIGENT WEATHER INFRASTRUCTURE</div><div className="hero-stage"><div className="hero-copy-column"><motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>Intelligent weather<br />monitoring. <em>Anomaly</em><br />detection.</motion.h1><motion.p className="hero-copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .25 }}>Stream live atmospheric data from distributed smart sensors. Our neural engines instantly flag measurement anomalies, diagnose hardware failures, and predict microclimatic shifts.</motion.p><div className="hero-actions"><button className="button-primary" onClick={() => navigate("/overview")}>Get started <ChevronRight size={15} /></button><a className="button-quiet" href="#platform">Watch demo <span>▷</span></a></div></div><SensorNetworkGlobe /></div><DashboardPreview /></section>
    <section className="metric-band scroll-reveal">{metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</section>
    <section className="section section-dark scroll-reveal" id="platform"><div className="section-intro"><div className="section-kicker">AUTOMATED WEATHER INTELLIGENCE</div><h2>Powered by machine learning.<br /><em>Built for certainty.</em></h2><p>Our edge devices do not just record data. They think. Avoid false positives from sensor noise and understand the literal why behind every anomaly.</p></div><div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article className="feature scroll-reveal" key={title}><Icon size={18} /><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="section section-mid scroll-reveal" id="workflow"><div className="section-kicker">ZERO-CONFIGURATION TELEMETRY TO INSIGHT</div><h2>Four simple stages.<br />One clearer picture.</h2><div className="stage-grid">{[["01", "Deploy & Stream", "Connect your existing stations and start streaming in minutes."], ["02", "Scope Data", "Normalize every reading into one operational view."], ["03", "Detect Anomalies", "Let intelligent models separate signal from noise."], ["04", "Predict & Act", "Resolve the root cause before it becomes downtime."]].map(([number, title, text]) => <article className="stage scroll-reveal" key={number}><b>{number}</b><h3>{title}</h3><p>{text}</p><ChevronRight size={14} /></article>)}</div></section>
    <section className="section command-section scroll-reveal"><div className="command-copy"><div className="section-kicker">A COMPLETE COMMAND CENTER</div><h2>Know what is happening<br />across your network.</h2><p>One calm, accurate view of every station, alert, and emerging weather pattern. SkyGuard makes complex networks feel legible.</p><button className="button-primary" onClick={() => navigate("/overview")}>Explore the console <ArrowUpRight size={14} /></button></div><div className="mini-map"><span className="map-label">NETWORK / 128 NODES</span><div className="map-node n1" /><div className="map-node n2" /><div className="map-node n3" /><div className="map-line l1" /><div className="map-line l2" /><div className="map-line l3" /><div className="map-score"><small>NETWORK HEALTH</small><strong>96.4%</strong></div></div></section>
    <section className="section use-case-section scroll-reveal" id="use-cases"><div className="section-kicker">ENGINEERED FOR HIGH-STAKES ENVIRONMENTS</div><h2>Weather intelligence<br />where it matters most.</h2><div className="use-case-grid">{useCases.map(({ number, title, text, image }) => <article className="use-case scroll-reveal" key={title}><img src={image} alt="" /><div className="use-case-body"><span>{number}</span><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>
    <section className="testimonial scroll-reveal"><div className="stars">★★★★★</div><blockquote>“SkyGuard detected a critical sensor calibration drift that would have gone completely unnoticed for weeks.”</blockquote><small>Dr. Sai Guhan · DIRECTOR, CLIMATE RESEARCH</small></section>
    <section className="section pricing-section scroll-reveal" id="pricing"><div className="section-kicker">PLANS, SIMPLIFIED</div><h2>Transparent plans for<br />networks of any scale.</h2><div className="price-grid">{[["Starter", "$290", "For teams building their first network."], ["Professional", "$890", "For growing operations that need more."], ["Enterprise", "Custom", "For mission-critical networks at scale."]].map(([name, price, text], index) => <article className={`price-card scroll-reveal ${index === 1 ? "featured" : ""}`} key={name}><span>{name}</span><p>{text}</p><strong>{price}<small>{price !== "Custom" && "/mo"}</small></strong><button onClick={() => navigate("/login")}>{index === 2 ? "Contact SkyGuard" : "Start free trial"} <ArrowUpRight size={13} /></button></article>)}</div></section>
    <section className="final-cta scroll-reveal" id="contact"><div className="section-kicker">READY WHEN YOU ARE</div><h2>Transform your climate<br />intelligence.</h2><p>Get started with our lightweight integration tier or order pre-configured, solar-powered physical telemetry stations today.</p><button className="button-primary" onClick={() => navigate("/login")}>Start your free trial <ArrowUpRight size={14} /></button></section>
    <footer className="landing-footer"><div><a className="wordmark" href="/"><img src="/skyguard-mark.svg" alt="" className="wordmark-mark" /> SkyGuard</a><p>Making the invisible visible across<br />the world's changing atmosphere.</p></div><div className="footer-links"><div><b>Product</b><a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#pricing">Pricing</a></div><div><b>Company</b><a href="#contact">About us</a><a href="#contact">Contact</a><a href="#contact">Careers</a></div><div><b>Access</b><a href="/login">Sign in</a><a href="/overview">Dashboard</a><a href="#contact">Documentation</a></div></div><small>© 2026 SkyGuard Systems</small></footer>
  </main>;
}
