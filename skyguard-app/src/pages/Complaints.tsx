import { useState, type FormEvent } from "react";
import { CheckCircle2, AlertTriangle, Loader2, MessageSquarePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitComplaint } from "@/lib/edge-api";

export function Complaints() {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !details.trim() || sending) return;
    setSending(true);
    setError(null);
    setCaseId(null);
    const res = await submitComplaint({ subject: subject.trim(), details: details.trim() });
    setSending(false);
    if (res.ok) {
      setCaseId(res.caseId ?? "queued");
      setSubject("");
      setDetails("");
    } else {
      setError(res.error ?? "Failed to submit");
    }
  };
  return <div className="space-y-6"><div><h1 className="font-serif text-2xl font-bold text-ink-navy">Complaints & support</h1><p className="mt-1 text-sm text-graphite/70">Report a station, data-quality, or workspace issue — every case is emailed to admin.skyguardai@gmail.com.</p></div><div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><Card className="p-5"><div className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5 text-deep-atmo" /><h2 className="font-semibold text-ink-navy">Open a support case</h2></div><form className="mt-5 space-y-4" onSubmit={submit}><label className="block space-y-1.5 text-sm font-medium text-graphite">Subject<Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What needs attention?" required /></label><label className="block space-y-1.5 text-sm font-medium text-graphite">Details<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Include station ID, time, and observed behavior..." required className="min-h-32 w-full rounded-lg border border-cloud-grey bg-white px-3 py-2 text-sm text-graphite outline-none focus:ring-2 focus:ring-sky-blue" /></label><Button type="submit" disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {sending ? "Sending..." : "Submit complaint"}</Button>{caseId && <p className="flex items-center gap-2 text-sm text-healthy-green"><CheckCircle2 className="h-4 w-4" /> Case #{caseId} emailed to operations.</p>}{error && <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</p>}</form></Card><Card className="p-5"><h2 className="font-semibold text-ink-navy">What to include</h2><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-graphite/80"><li>Station ID and location</li><li>Approximate time of the incident</li><li>Observed reading or error message</li><li>Screenshot or field context when available</li></ul></Card></div></div>;
}
