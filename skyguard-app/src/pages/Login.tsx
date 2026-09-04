import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Cloud,
  Mail,
  Lock,
  AlertCircle,
  Radio,
  ChevronDown,
  Eye,
  EyeOff,
  BarChart3,
  Shield,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "network-operator" | "data-scientist" | "administrator";

const roles: { value: Role; label: string; icon: typeof Radio }[] = [
  { value: "network-operator", label: "Network Operator", icon: Wifi },
  { value: "data-scientist", label: "Data Scientist", icon: BarChart3 },
  { value: "administrator", label: "Administrator", icon: Shield },
];

const fieldErrors = {
  email: "Work email is required",
  password: "Password is required",
  role: "Please select a role",
};

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof fieldErrors, string>>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = fieldErrors.email;
    if (!password.trim()) newErrors.password = fieldErrors.password;
    if (!role) newErrors.role = fieldErrors.role;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/overview", { replace: true });
    }, 800);
  };

  const handleDemo = () => {
    navigate("/overview", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-warm-off">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative flex-col justify-between bg-ink-navy p-12 overflow-hidden"
      >
        {/* Animated signal lines background */}
        <div className="absolute inset-0 opacity-20">
          <svg className="h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="none" fill="none">
            <motion.path
              d="M50 100 Q 150 150, 200 200 T 300 350 T 150 500 T 250 650 T 100 750"
              stroke="url(#signalGradient)"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatType: "loop", repeatDelay: 1 }}
            />
            <motion.path
              d="M80 50 Q 200 120, 250 180 T 350 320 T 200 480 T 300 620 T 150 780"
              stroke="url(#signalGradient2)"
              strokeWidth="1.5"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatType: "loop", repeatDelay: 0.5, delay: 0.5 }}
            />
            <motion.path
              d="M20 200 Q 120 250, 180 300 T 280 450 T 120 600 T 220 720"
              stroke="url(#signalGradient3)"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "loop", repeatDelay: 1.5, delay: 1 }}
            />
            <defs>
              <linearGradient id="signalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6BAED6" />
                <stop offset="100%" stopColor="#7067A8" />
              </linearGradient>
              <linearGradient id="signalGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D99532" />
                <stop offset="100%" stopColor="#6BAED6" />
              </linearGradient>
              <linearGradient id="signalGradient3" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3F8062" />
                <stop offset="100%" stopColor="#6BAED6" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Pulsing nodes */}
        <div className="absolute inset-0">
          {[
            { cx: "22%", cy: "18%" },
            { cx: "65%", cy: "32%" },
            { cx: "40%", cy: "52%" },
            { cx: "75%", cy: "68%" },
            { cx: "30%", cy: "80%" },
          ].map((node, i) => (
            <motion.div
              key={i}
              className="absolute h-2 w-2 rounded-full bg-sky-blue"
              style={{ left: node.cx, top: node.cy }}
              initial={{ opacity: 0.3, scale: 1 }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.5, 1] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Brand content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-deep-atmo/50 backdrop-blur-sm border border-sky-blue/20">
              <Cloud className="h-7 w-7 text-sky-blue" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-white tracking-tight">
                SKYGUARD
              </h1>
              <p className="text-xs text-sky-blue/70 tracking-wider uppercase">
                Weather Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Center tagline */}
        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="font-serif text-4xl font-bold text-white leading-tight"
          >
            Real-time weather
            <br />
            monitoring for
            <br />
            <span className="text-sky-blue">critical operations</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-4 text-sm text-white/50 max-w-sm leading-relaxed"
          >
            Advanced atmospheric sensing and predictive analytics to keep your
            network resilient against severe weather events.
          </motion.p>
        </div>

        {/* Bottom status */}
        <div className="relative z-10 flex items-center gap-4 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <motion.div
              className="h-2 w-2 rounded-full bg-healthy-green"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span>All systems operational</span>
          </div>
          <span>|</span>
          <span>v2.4.1</span>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
              <img src="/skyguard-logo.svg" alt="SkyGuard AI" className="h-14 w-44 rounded-lg bg-white object-contain object-left" />
          </div>

          <div className="mb-6">
            <h2 className="font-serif text-2xl font-bold text-ink-navy">
              Sign in to your workspace
            </h2>
            <p className="mt-1 text-sm text-graphite/60">
              Access the weather monitoring dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-graphite">
                Work email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
                <Input
                  type="email"
                  placeholder="operator@skyguard.ai"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  className={cn(
                    "pl-10",
                    errors.email && "border-alert-coral focus-visible:ring-alert-coral"
                  )}
                />
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs text-alert-coral"
                >
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
                </motion.p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-graphite">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                  }}
                  className={cn(
                    "pl-10 pr-10",
                    errors.password && "border-alert-coral focus-visible:ring-alert-coral"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite/40 hover:text-graphite/60 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs text-alert-coral"
                >
                  <AlertCircle className="h-3 w-3" />
                  {errors.password}
                </motion.p>
              )}
            </div>

            {/* Role selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-graphite">
                Role
              </label>
              <div className="relative">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <Radio className="h-4 w-4 text-graphite/40" />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value as Role);
                      if (errors.role) setErrors((p) => ({ ...p, role: undefined }));
                    }}
                    className={cn(
                      "flex h-10 w-full appearance-none rounded-lg border bg-white pl-10 pr-10 text-sm text-graphite transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2",
                      errors.role ? "border-alert-coral" : "border-cloud-grey"
                    )}
                  >
                    <option value="" disabled>
                      Select your role
                    </option>
                    {roles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
                </div>
              </div>
              {errors.role && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs text-alert-coral"
                >
                  <AlertCircle className="h-3 w-3" />
                  {errors.role}
                </motion.p>
              )}
            </div>

            {/* Sign in button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-cloud-grey" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-warm-off px-3 text-graphite/40">or</span>
              </div>
            </div>

            {/* Demo workspace button */}
            <Button
              type="button"
              variant="ghost"
              className="w-full text-deep-atmo hover:text-ink-navy hover:bg-cloud-grey/50"
              onClick={handleDemo}
            >
              Continue with demo workspace
            </Button>

            {/* Demo note */}
            <p className="text-center text-xs text-graphite/40">
              Use demo workspace to explore with sample data
            </p>
          </form>

          {/* Privacy text */}
          <p className="mt-8 text-center text-xs leading-relaxed text-graphite/30">
            By signing in, you agree to our Terms of Service and acknowledge
            that station telemetry data is processed in accordance with our
            Privacy Policy and data governance framework.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
