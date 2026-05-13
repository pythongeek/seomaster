"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

// ─── GSC State Slice ────────────────────────────────────────────────────────
export type SearchType = "web" | "image" | "video" | "news";
export type AggregationType = "byProperty" | "byPage";
export type DimensionType = "query" | "page" | "device" | "country" | "date";

interface GSCState {
  gscRows: GSCRow[];
  gscResult: GSCResult | null;
  siteUrl: string;
  startDate: string;
  endDate: string;
  csvText: string;
  gscFetchJobId: string | null;
  // OAuth report config
  searchType: SearchType;
  selectedDimensions: DimensionType[];
  deviceFilter: string;
  countryFilter: string;
  aggregationType: AggregationType;
  rowLimit: number;
  setGscRows: (rows: GSCRow[]) => void;
  setGscResult: (result: GSCResult | null) => void;
  setSiteUrl: (url: string) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setCsvText: (text: string) => void;
  setGscFetchJobId: (id: string | null) => void;
  setSearchType: (t: SearchType) => void;
  setSelectedDimensions: (d: DimensionType[]) => void;
  setDeviceFilter: (d: string) => void;
  setCountryFilter: (c: string) => void;
  setAggregationType: (a: AggregationType) => void;
  setRowLimit: (n: number) => void;
  clearGscData: () => void;
}

// ─── UI State Slice ─────────────────────────────────────────────────────────
interface UIState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  aiEngine: 'minimax' | 'gemini';
  setAiEngine: (engine: 'minimax' | 'gemini') => void;
}

// ─── Job State Slice ─────────────────────────────────────────────────────────
interface JobState {
  activeJobs: Record<string, JobStatus>;
  addJob: (job: JobStatus) => void;
  updateJobProgress: (id: string, progress: number, message?: string) => void;
  completeJob: (id: string, result: unknown) => void;
  failJob: (id: string, error: string) => void;
  removeJob: (id: string) => void;
}

// ─── Notification State Slice ───────────────────────────────────────────────
interface NotificationState {
  notifications: AppNotification[];
  addNotification: (message: string, type: AppNotification["type"]) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// ─── Combined Store Interface ────────────────────────────────────────────────
type SEOStore = GSCState & UIState & JobState & NotificationState;

// ─── Default dates ──────────────────────────────────────────────────────────
function defaultStartDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().split("T")[0];
}

// ─── Store ──────────────────────────────────────────────────────────────────
export const useStore = create<SEOStore>()(
  persist(
    (set) => ({
      // GSC Data
      gscRows: [],
      gscResult: null,
      siteUrl: "",
      startDate: defaultStartDate(),
      endDate: new Date().toISOString().split("T")[0],
      csvText: "",
      // OAuth report config
      searchType: "web" as SearchType,
      selectedDimensions: ["query", "page"] as DimensionType[],
      deviceFilter: "",
      countryFilter: "",
      aggregationType: "byProperty" as AggregationType,
      rowLimit: 5000,
      setGscRows: (rows) => set({ gscRows: rows }),
      setGscResult: (result) => set({ gscResult: result }),
      setSiteUrl: (url) => set({ siteUrl: url }),
      setStartDate: (date) => set({ startDate: date }),
      setEndDate: (date) => set({ endDate: date }),
      setCsvText: (text) => set({ csvText: text }),
      setSearchType: (t) => set({ searchType: t }),
      setSelectedDimensions: (d) => set({ selectedDimensions: d }),
      setDeviceFilter: (d) => set({ deviceFilter: d }),
      setCountryFilter: (c) => set({ countryFilter: c }),
      setAggregationType: (a) => set({ aggregationType: a }),
      setRowLimit: (n) => set({ rowLimit: n }),
      clearGscData: () => set({
        gscRows: [],
        gscResult: null,
        csvText: "",
        siteUrl: "",
        startDate: defaultStartDate(),
        endDate: new Date().toISOString().split("T")[0],
        gscFetchJobId: null,
        searchType: "web" as SearchType,
        selectedDimensions: ["query", "page"] as DimensionType[],
        deviceFilter: "",
        countryFilter: "",
        aggregationType: "byProperty" as AggregationType,
        rowLimit: 5000,
      }),

      // UI State
      activeTab: "dashboard",
      setActiveTab: (tab) => set({ activeTab: tab }),
      aiEngine: 'minimax',
      setAiEngine: (engine) => set({ aiEngine: engine }),

      // Background Jobs
      activeJobs: {},
      gscFetchJobId: null,
      setGscFetchJobId: (id) => set({ gscFetchJobId: id }),
      addJob: (job) =>
        set((state) => ({
          activeJobs: { ...state.activeJobs, [job.id]: job },
        })),
      updateJobProgress: (id, progress, message) =>
        set((state) => {
          const job = state.activeJobs[id];
          if (!job) return state;
          return {
            activeJobs: {
              ...state.activeJobs,
              [id]: { ...job, progress, progressMessage: message },
            },
          };
        }),
      completeJob: (id, result) =>
        set((state) => {
          const job = state.activeJobs[id];
          if (!job) return state;
          return {
            activeJobs: {
              ...state.activeJobs,
              [id]: { ...job, status: "completed", progress: 100, result },
            },
          };
        }),
      failJob: (id, error) =>
        set((state) => {
          const job = state.activeJobs[id];
          if (!job) return state;
          return {
            activeJobs: {
              ...state.activeJobs,
              [id]: { ...job, status: "failed", error },
            },
          };
        }),
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
    }),
    {
      name: "seomaster-storage",
      partialize: (state) => ({
        gscRows: state.gscRows,
        gscResult: state.gscResult,
        siteUrl: state.siteUrl,
        csvText: state.csvText,
        activeTab: state.activeTab,
      }),
    }
  )
);
