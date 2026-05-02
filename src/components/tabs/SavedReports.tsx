"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge, Button, Section, LoadingSpinner, Modal } from "@/components/ui";
import type { Report } from "@/types";

function ReportCard({ report, onLoad }: { report: Report; onLoad: (r: Report) => void }) {
  const typeColors: Record<string, string> = { gsc_full: "blue", ctr_optimize: "green", keyword_research: "purple", topic_cluster: "amber", ai_overview: "red", vitals: "purple" };
  return (
    <div className="bg-card border border-border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-blue/50 hover:shadow-lg hover:shadow-blue/5"
      onClick={() => onLoad(report)}>
      <div className="flex justify-between items-start mb-2">
        <Badge variant={(typeColors[report.report_type] || "blue") as "blue"}>{report.report_type.replace("_", " ")}</Badge>
        <span className="text-muted text-[11px]">{new Date(report.created_at).toLocaleDateString()}</span>
      </div>
      <div className="text-text text-sm font-semibold mb-1.5">{report.title}</div>
      {report.summary !== null && report.summary !== undefined && typeof report.summary === "object" && "totalClicks" in (report.summary as object) && (
        <div className="text-green text-xl font-extrabold font-mono">
          {((report.summary as Record<string, number>).totalClicks)?.toLocaleString() || 0} clicks
        </div>
      )}
    </div>
  );
}

export function SavedReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/reports");
      const json = await resp.json();
      setReports(json.reports || []);
    } catch { setReports([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
    setReports(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-text text-lg font-bold">📚 Report History</h2>
        <Button onClick={loadReports} size="sm">🔄 Refresh</Button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {reports.length === 0 ? (
            <div className="text-center py-10 text-muted">No reports saved yet. Run an analysis to create your first report.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reports.map(r => (
                <div key={r.id} className="relative">
                  <ReportCard report={r} onLoad={setSelected} />
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                    className="absolute top-2 right-2 bg-red/25 text-red border-none rounded px-1.5 py-0.5 text-[10px] cursor-pointer hover:bg-red/40 transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        <pre className="text-muted text-xs whitespace-pre-wrap">{JSON.stringify(selected?.data, null, 2)}</pre>
      </Modal>
    </div>
  );
}
