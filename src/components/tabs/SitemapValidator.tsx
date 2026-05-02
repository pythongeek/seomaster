"use client";

import { useState } from "react";
import { Badge, Button, Section, Input, LoadingSpinner, ErrorBanner } from "@/components/ui";
import type { SitemapResult } from "@/types";

export function SitemapValidator() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SitemapResult | null>(null);
  const [error, setError] = useState("");

  const handleValidate = async () => {
    if (!sitemapUrl.trim()) { setError("Enter a sitemap URL first."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitemapUrl }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="🗺️ Automated Sitemap Validation System">
        <div className="grid gap-3">
          <Input value={sitemapUrl} onChange={setSitemapUrl} placeholder="https://yoursite.com/sitemap_index.xml" />
          <Button onClick={handleValidate} loading={loading}>🗺️ Validate & Ping Google</Button>
          <div className="text-muted text-[11px]">Validates your XML sitemap and notifies Google of updates.</div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}
      <ErrorBanner message={error} />

      {result && !loading && (
        <div className="mt-6 animate-fade-in">
          <div className={`rounded-xl p-4 mb-6 ${result.success ? "bg-green/5 border border-green/40" : "bg-red/5 border border-red/40"}`}>
            <div className="flex gap-3 items-center mb-2">
              <span className="text-[28px]">{result.success ? "✅" : "❌"}</span>
              <div>
                <div className={`text-base font-extrabold ${result.success ? "text-green" : "text-red"}`}>{result.success ? "SITEMAP VALIDATED" : "VALIDATION FAILED"}</div>
                <div className="text-muted text-xs">{result.sitemapUrl}</div>
              </div>
            </div>
            <div className="grid gap-2.5 mt-3">
              <div className="flex gap-2 items-center">
                <span className="text-muted text-xs w-[140px]">Validation:</span>
                <Badge variant={result.validated ? "green" : "red"}>{result.validationStatus || "N/A"}</Badge>
                <span className="text-text text-xs">{result.validationMessage}</span>
              </div>
              {result.pingedAt && (
                <div className="flex gap-2 items-center">
                  <span className="text-muted text-xs w-[140px]">Pinged:</span>
                  <Badge variant="blue">GOOGLE PING SENT</Badge>
                  <span className="text-text text-xs">{new Date(result.pingedAt).toLocaleString()}</span>
                </div>
              )}
              {result.pingMessage && (
                <div className="flex gap-2 items-start">
                  <span className="text-muted text-xs w-[140px]">Note:</span>
                  <span className="text-muted text-xs">{result.pingMessage}</span>
                </div>
              )}
            </div>
          </div>

          <Section title="📖 How It Works" accent="muted">
            <div className="grid gap-2 text-muted text-xs leading-relaxed">
              <div>1. <strong className="text-text">HEAD request</strong> — Server validates sitemap exists and returns 200 OK</div>
              <div>2. <strong className="text-text">Google ping</strong> — Notifies Googlebot to re-crawl and ingest sitemap changes</div>
              <div>3. <strong className="text-text">GSC confirmation</strong> — Check Google Search Console to confirm update was processed</div>
              <div className="mt-2 text-amber text-[11px]">Note: Google does not return a CORS-usable response for ping requests — the ping is sent but confirmation requires checking GSC.</div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
