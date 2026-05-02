"use client";

import { create } from "zustand";
import type { GSCRow, GSCResult } from "@/types";

// ─── Job Status ─────────────────────────────────────────────────────────────
export interface JobStatus {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  progressMessage?: string;
  result?: unknown;
  error?: string;
}

// ─── Notification ───────────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  timestamp: number;
}

// ─── Store Interface ────────────────────────────────────────────────────────
interface SEOStore {
  // GSC Data — persists across tab switches
  gscRows: GSCRow[];
  gscResult: GSCResult | null;
  siteUrl: string;
  startDate: string;
  endDate: string;
  csvText: string;
  setGscRows: (rows: GSCRow[]) => void;
  setGscResult: (result: GSCResult | null) => void;
  setSiteUrl: (url: string) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setCsvText: (text: string) => void;
  clearGscData: () => void;

  // Active Tab
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Background Jobs
  activeJobs: Record<string, JobStatus>;
  addJob: (job: JobStatus) => void;
  updateJobProgress: (id: string, progress: number, message?: string) => void;
  completeJob: (id: string, result: unknown) => void;
  failJob: (id: string, error: string) => void;
  removeJob: (id: string) => void;

  // Notifications
  notifications: AppNotification[];
  addNotification: (message: string, type: AppNotification["type"]) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// ─── Default dates ──────────────────────────────────────────────────────────
function defaultStartDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().split("T")[0];
}

// ─── Store ──────────────────────────────────────────────────────────────────
export const useStore = create<SEOStore>((set) => ({
  // GSC Data
  gscRows: [],
  gscResult: null,
  siteUrl: "",
  startDate: defaultStartDate(),
  endDate: new Date().toISOString().split("T")[0],
  csvText: "",
  setGscRows: (rows) => set({ gscRows: rows }),
  setGscResult: (result) => set({ gscResult: result }),
  setSiteUrl: (url) => set({ siteUrl: url }),
  setStartDate: (date) => set({ startDate: date }),
  setEndDate: (date) => set({ endDate: date }),
  setCsvText: (text) => set({ csvText: text }),
  clearGscData: () => set({ gscRows: [], gscResult: null, csvText: "" }),

  // Active Tab
  activeTab: "gsc",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Background Jobs
  activeJobs: {},
  addJob: (job) =>
    set((state) => ({
      activeJobs: { ...state.activeJobs, [job.id]: job },
    })),
  updateJobProgress: (id, progress, message) =>
    set((state) => ({
      activeJobs: {
        ...state.activeJobs,
        [id]: state.activeJobs[id]
          ? { ...state.activeJobs[id], progress, progressMessage: message }
          : state.activeJobs[id],
      },
    })),
  completeJob: (id, result) =>
    set((state) => ({
      activeJobs: {
        ...state.activeJobs,
        [id]: state.activeJobs[id]
          ? { ...state.activeJobs[id], status: "completed", progress: 100, result }
          : state.activeJobs[id],
      },
    })),
  failJob: (id, error) =>
    set((state) => ({
      activeJobs: {
        ...state.activeJobs,
        [id]: state.activeJobs[id]
          ? { ...state.activeJobs[id], status: "failed", error }
          : state.activeJobs[id],
      },
    })),
  removeJob: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.activeJobs;
      return { activeJobs: rest };
    }),

  // Notifications
  notifications: [],
  addNotification: (message, type) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: crypto.randomUUID(), message, type, timestamp: Date.now() },
      ].slice(-10), // Keep max 10
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
