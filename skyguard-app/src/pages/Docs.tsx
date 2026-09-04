import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SectionId =
  | "getting-started"
  | "architecture"
  | "api"
  | "anomaly"
  | "maintenance"
  | "faq";

interface Section {
  id: SectionId;
  title: string;
  badge?: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    badge: "Guide",
    content: (
      <div className="space-y-3 text-sm text-graphite/80 leading-relaxed">
        <p>
          SKYGUARD provides real-time telemetry, anomaly detection, and
          maintenance workflows for distributed weather station networks.
        </p>
        <p>
          After installing the agent and connecting your first station, the
          dashboard will begin streaming metrics within seconds. Use the
          Overview page to monitor active alerts and network health at a glance.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Add stations via the Network page</li>
          <li>Configure alert thresholds in Settings</li>
          <li>Review anomaly detections in the Anomalies panel</li>
        </ul>
      </div>
    ),
  },
  {
    id: "architecture",
    title: "Architecture Overview",
    badge: "Reference",
    content: (
      <div className="space-y-3 text-sm text-graphite/80 leading-relaxed">
        <p>
          SKYGUARD follows a modular pipeline: ingestion, normalization,
          anomaly detection, and alerting.
        </p>
        <div className="rounded-lg border border-cloud-grey bg-white/60 p-4 font-mono text-xs">
          <p>Station Agents → Ingestion API → Normalizer</p>
          <p className="mt-1">Normalizer → Detection Engine → Alert Router</p>
          <p className="mt-1">Alert Router → WebSocket / Email / Push</p>
        </div>
        <p>
          Each component is horizontally scalable. The detection engine can run
          on edge nodes for low-latency classification or in a central cluster
          for batch analysis.
        </p>
      </div>
    ),
  },
  {
    id: "api",
    title: "API Reference",
    badge: "Reference",
    content: (
      <div className="space-y-3 text-sm text-graphite/80 leading-relaxed">
        <p>
          The REST API uses bearer authentication. All endpoints return JSON
          and follow standard HTTP status codes.
        </p>
        <div className="space-y-2">
          <div className="rounded-lg border border-cloud-grey bg-white/60 p-3 font-mono text-xs">
            <span className="text-healthy-green">GET</span>{" "}
            <span className="text-ink-navy">/api/v1/stations</span>
          </div>
          <div className="rounded-lg border border-cloud-grey bg-white/60 p-3 font-mono text-xs">
            <span className="text-healthy-green">GET</span>{" "}
            <span className="text-ink-navy">/api/v1/telemetry</span>
            <span className="text-graphite/60"> ?station=&since=</span>
          </div>
          <div className="rounded-lg border border-cloud-grey bg-white/60 p-3 font-mono text-xs">
            <span className="text-signal-amber">POST</span>{" "}
            <span className="text-ink-navy">/api/v1/alerts/acknowledge</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "anomaly",
    title: "Anomaly Detection Methods",
    badge: "Guide",
    content: (
      <div className="space-y-3 text-sm text-graphite/80 leading-relaxed">
        <p>
          SKYGUARD supports multiple detection models that can be enabled per
          station group or globally.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium text-graphite">Statistical:</span>{" "}
            Z-score and IQR-based thresholds for temperature, humidity, and wind.
          </li>
          <li>
            <span className="font-medium text-graphite">ML Ensemble:</span>{" "}
            Isolation Forest and autoencoder models trained on seasonal baselines.
          </li>
          <li>
            <span className="font-medium text-graphite">Rule-based:</span>{" "}
            Custom thresholds and cross-sensor correlation checks.
          </li>
        </ul>
        <p>
          Combine methods by stacking detectors. The alert router deduplicates
          events and assigns severity based on confidence and impact.
        </p>
      </div>
    ),
  },
  {
    id: "maintenance",
    title: "Maintenance Workflows",
    badge: "Guide",
    content: (
      <div className="space-y-3 text-sm text-graphite/80 leading-relaxed">
        <p>
          Maintenance tasks are generated from detected anomalies, scheduled
          inspections, and manual requests.
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Detect anomaly or schedule inspection</li>
          <li>Assign technician and set priority</li>
          <li>Log field notes and attach evidence</li>
          <li>Mark complete and verify sensor health</li>
        </ol>
        <p>
          Completed workflows update the station health score and close related
          alerts automatically.
        </p>
      </div>
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    badge: "FAQ",
    content: (
      <div className="space-y-3 text-sm text-graphite/80 leading-relaxed">
        <div>
          <p className="font-medium text-graphite">
            How long does onboarding take?
          </p>
          <p className="mt-1">
            Most teams are fully operational within 30 minutes. Station
            registration and first telemetry streams are immediate.
          </p>
        </div>
        <div>
          <p className="font-medium text-graphite">
            Can I deploy on-premises?
          </p>
          <p className="mt-1">
            Yes. SKYGUARD supports Docker Compose and Helm charts for private
            cloud deployments.
          </p>
        </div>
        <div>
          <p className="font-medium text-graphite">
            What data retention is supported?
          </p>
          <p className="mt-1">
            Raw telemetry is retained for 90 days by default. Aggregated metrics
            can be archived indefinitely in object storage.
          </p>
        </div>
      </div>
    ),
  },
];

export function Docs() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections.filter((s) => {
      const text = s.title + " " + (typeof s.content === "string" ? s.content : "");
      return text.toLowerCase().includes(q);
    });
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-2xl font-bold text-ink-navy"
        >
          Documentation
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-1 text-sm text-graphite/60"
        >
          Guides, references, and architecture notes for SKYGUARD.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            className="pl-9"
          />
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((section, i) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{section.title}</CardTitle>
                  {section.badge && (
                    <Badge variant="secondary" className="text-[10px]">
                      {section.badge}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>{section.content}</CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-graphite/60"
        >
          No results found for &ldquo;{query}&rdquo;.
        </motion.p>
      )}
    </div>
  );
}
