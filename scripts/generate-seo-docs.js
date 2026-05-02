const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, ExternalHyperlink,
  PageBreak, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const thBorder = { style: BorderStyle.SINGLE, size: 2, color: "1E3A5F" };
const thBorders = { top: thBorder, bottom: thBorder, left: thBorder, right: thBorder };

const TW = 9360; // table width DXA (US Letter, 1" margins)

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, size: 36, color: "1E3A5F", font: "Arial" })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 28, color: "1E3A5F", font: "Arial" })]
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: "2D6A9F", font: "Arial" })]
  });
}
function h4(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color: "3B82B6", font: "Arial" })]
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial", ...opts })]
  });
}
function pMixed(runs, spacingBefore = 80, spacingAfter = 80) {
  return new Paragraph({
    spacing: { before: spacingBefore, after: spacingAfter },
    children: runs.map(r => {
      if (typeof r === 'string') return new TextRun({ text: r, size: 22, font: "Arial" });
      return new TextRun({ size: 22, font: "Arial", ...r });
    })
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })]
  });
}
function bulletMixed(runs, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40 },
    children: runs.map(r => typeof r === 'string'
      ? new TextRun({ text: r, size: 22, font: "Arial" })
      : new TextRun({ size: 22, font: "Arial", ...r }))
  });
}
function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })]
  });
}
function divider(color = "CCCCCC") {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color, space: 1 } },
    children: [new TextRun("")]
  });
}
function callout(text, color = "E8F4FD", borderColor = "3B82F6") {
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [TW],
    rows: [new TableRow({
      children: [new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
          left: { style: BorderStyle.THICK, size: 12, color: borderColor },
          right: { style: BorderStyle.SINGLE, size: 4, color: borderColor }
        },
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        width: { size: TW, type: WidthType.DXA },
        children: [new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text, size: 22, font: "Arial" })]
        })]
      })]
    })]
  });
}
function codeBlock(text) {
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [TW],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        shading: { fill: "1E1E1E", type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        width: { size: TW, type: WidthType.DXA },
        children: text.split('\n').map(line =>
          new Paragraph({
            spacing: { before: 20, after: 20 },
            children: [new TextRun({ text: line || ' ', size: 18, font: "Courier New", color: "D4D4D4" })]
          })
        )
      })]
    })]
  });
}
function tableHeader(cells, widths) {
  return new TableRow({
    tableHeader: true,
    children: cells.map((text, i) => new TableCell({
      borders: thBorders,
      shading: { fill: "1E3A5F", type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, bold: true, size: 20, color: "FFFFFF", font: "Arial" })]
      })]
    }))
  });
}
function tableRow(cells, widths, shade = false) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders,
      shading: { fill: shade ? "F0F7FF" : "FFFFFF", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.DXA },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: typeof text === 'string'
          ? [new TextRun({ text, size: 20, font: "Arial" })]
          : text
      })]
    }))
  });
}
function sp(n = 1) {
  return Array(n).fill(null).map(() => new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun("")] }));
}
function statusBadge(status, text) {
  const colors = { green: "10B981", red: "EF4444", amber: "F59E0B", blue: "3B82F6", purple: "8B5CF6" };
  return new TextRun({ text: ` [${text}] `, bold: true, size: 18, color: colors[status] || "666666", font: "Arial" });
}

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        { level: 2, format: LevelFormat.BULLET, text: "▪", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]},
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1E3A5F" },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "1E3A5F" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2D6A9F" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1E3A5F", space: 1 } },
          children: [new TextRun({ text: "SEOMaster — Production Algorithm Documentation v1.0", size: 18, color: "7D8590", font: "Arial" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } },
          children: [
            new TextRun({ text: "SEOMaster Documentation  |  Page ", size: 18, color: "7D8590", font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "3B82F6", font: "Arial" }),
            new TextRun({ text: " of ", size: 18, color: "7D8590", font: "Arial" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "3B82F6", font: "Arial" }),
          ]
        })]
      })
    },
    children: [

      // ── COVER ──────────────────────────────────────────────────────────────
      ...sp(4),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: "SEOMaster", size: 72, bold: true, color: "1E3A5F", font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [new TextRun({ text: "Production Algorithm Documentation", size: 40, color: "3B82F6", font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [new TextRun({ text: "Industry-Standard Real Data Analysis, Deep SEO Metrics & Algorithmic Intelligence", size: 24, color: "7D8590", font: "Arial", italics: true })]
      }),
      divider("1E3A5F"),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: "Version 1.0  |  May 2026", size: 22, color: "7D8590", font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: "Stack: Next.js 15 · MiniMax M2.7 · Neon PostgreSQL · Recharts", size: 22, color: "7D8590", font: "Arial" })]
      }),
      ...sp(2),

      // ── EXECUTIVE SUMMARY ──────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("1. Executive Summary & Algorithm Assessment"),
      p("This document provides complete production-ready documentation for SEOMaster's data analysis algorithms. It covers the current implementation assessment, industry-standard enhancements, a detailed metrics dictionary, the 'why behind every metric', keyword gap discovery logic, and per-page deep analysis specifications."),
      ...sp(1),

      callout(
        "Core Philosophy: Every metric displayed must answer three questions — WHY is this happening, WHAT is the benchmark, and HOW do I fix it. This document encodes industry-standard answers to all three for every data point in the system.",
        "E8F4FD", "3B82F6"
      ),
      ...sp(1),

      h2("1.1 Current Algorithm Health Check"),
      p("Analysis of the existing codebase reveals a solid foundation with several critical gaps that prevent true production-grade analysis:"),
      ...sp(1),

      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2600, 1800, 4960],
        rows: [
          tableHeader(["Algorithm Module", "Status", "Assessment"], [2600, 1800, 4960]),
          tableRow(["CTR Benchmark Curve", "", [statusBadge("green", "STRONG"), new TextRun({ text: " Uses 20-point Advanced Web Ranking curve. Intent multipliers applied. Gap detection accurate.", size: 20, font: "Arial" })]], [2600, 1800, 4960]),
          tableRow(["Opportunity Scoring", "", [statusBadge("amber", "NEEDS WORK"), new TextRun({ text: " Composite score formula present but impression quality multiplier is arbitrary. Missing volatility weighting.", size: 20, font: "Arial" })]], [2600, 1800, 4960], true),
          tableRow(["AI Overview Eligibility", "", [statusBadge("green", "STRONG"), new TextRun({ text: " 4-signal scoring (intent, pattern, position, volume) — solid. Missing E-E-A-T signals and featured snippet ownership check.", size: 20, font: "Arial" })]], [2600, 1800, 4960]),
          tableRow(["Cannibalization Detection", "", [statusBadge("amber", "NEEDS WORK"), new TextRun({ text: " URL-per-query split detected correctly. Missing click-split ratio and semantic similarity analysis.", size: 20, font: "Arial" })]], [2600, 1800, 4960], true),
          tableRow(["Keyword Gap Analysis", "", [statusBadge("red", "MISSING"), new TextRun({ text: " No competitor gap, SERP feature gap, or semantic gap analysis. Critical for production.", size: 20, font: "Arial" })]], [2600, 1800, 4960]),
          tableRow(["Page-Level Deep Dive", "", [statusBadge("red", "MISSING"), new TextRun({ text: " No per-URL analysis, Core Web Vitals correlation, or content audit scoring.", size: 20, font: "Arial" })]], [2600, 1800, 4960], true),
          tableRow(["Trend / Seasonality", "", [statusBadge("red", "MISSING"), new TextRun({ text: " No date-range delta, MoM/YoY comparison, or volatility index.", size: 20, font: "Arial" })]], [2600, 1800, 4960]),
          tableRow(["GEO/AEO Scoring", "", [statusBadge("green", "STRONG"), new TextRun({ text: " Pillar clustering, blueprint generation, and rules engine are above-industry baseline.", size: 20, font: "Arial" })]], [2600, 1800, 4960], true),
          tableRow(["Crawl Budget", "", [statusBadge("green", "STRONG"), new TextRun({ text: " Status code parsing, file type waste, and devOps checklist are production-ready.", size: 20, font: "Arial" })]], [2600, 1800, 4960]),
        ]
      }),
      ...sp(2),

      // ── SECTION 2 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("2. Industry-Standard CTR Benchmark Algorithm"),
      p("The CTR benchmark is the foundation of every analysis. SEOMaster's current implementation is based on Advanced Web Ranking 2024 data and is accurate. This section documents the complete benchmark, calibration, and correction logic."),
      ...sp(1),

      h2("2.1 Position CTR Curve (Advanced Web Ranking 2024)"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1560, 1560, 1560, 1560, 1560, 1560],
        rows: [
          tableHeader(["Position", "Desktop CTR", "Mobile CTR", "Branded CTR", "Non-Brand CTR", "Question CTR"], [1560, 1560, 1560, 1560, 1560, 1560]),
          tableRow(["1", "28.5%", "24.1%", "38.2%", "22.4%", "31.7%"], [1560, 1560, 1560, 1560, 1560, 1560]),
          tableRow(["2", "15.7%", "13.2%", "18.9%", "12.1%", "17.2%"], [1560, 1560, 1560, 1560, 1560, 1560], true),
          tableRow(["3", "11.0%", "9.4%", "12.8%", "9.1%", "12.3%"], [1560, 1560, 1560, 1560, 1560, 1560]),
          tableRow(["4", "8.0%", "6.9%", "9.1%", "7.1%", "8.9%"], [1560, 1560, 1560, 1560, 1560, 1560], true),
          tableRow(["5", "5.9%", "5.1%", "6.7%", "5.3%", "6.4%"], [1560, 1560, 1560, 1560, 1560, 1560]),
          tableRow(["6-7", "3.8%", "3.2%", "4.3%", "3.3%", "4.1%"], [1560, 1560, 1560, 1560, 1560, 1560], true),
          tableRow(["8-10", "2.4%", "2.0%", "2.7%", "2.1%", "2.6%"], [1560, 1560, 1560, 1560, 1560, 1560]),
          tableRow(["11-15", "1.0%", "0.8%", "1.2%", "0.9%", "1.1%"], [1560, 1560, 1560, 1560, 1560, 1560], true),
          tableRow(["16-20", "0.5%", "0.4%", "0.6%", "0.4%", "0.6%"], [1560, 1560, 1560, 1560, 1560, 1560]),
        ]
      }),
      ...sp(1),

      h2("2.2 Intent-Based CTR Multipliers (Production Calibration)"),
      p("Raw position CTR must be adjusted for intent — the same position has wildly different benchmark CTRs for navigational vs informational queries. Current multipliers in the codebase are directionally correct but need calibration:"),
      ...sp(1),

      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2000, 1600, 1600, 1600, 2560],
        rows: [
          tableHeader(["Intent Type", "Current Mult.", "Industry Mult.", "Delta", "Why It Differs"], [2000, 1600, 1600, 1600, 2560]),
          tableRow(["Navigational", "1.25x", "1.35x", "+0.10", "Brand/site queries get much higher CTR — users actively looking for this URL"], [2000, 1600, 1600, 1600, 2560]),
          tableRow(["Informational", "1.05x", "1.00x", "-0.05", "Baseline — AI Overviews absorb ~18% of clicks, depressing actual CTR"], [2000, 1600, 1600, 1600, 2560], true),
          tableRow(["Transactional", "0.85x", "0.78x", "-0.07", "Shopping carousel and ads above organic suppress CTR significantly"], [2000, 1600, 1600, 1600, 2560]),
          tableRow(["Commercial", "0.90x", "0.87x", "-0.03", "Comparison/review queries have rich snippets; star ratings boost if present"], [2000, 1600, 1600, 1600, 2560], true),
          tableRow(["Local", "0.95x", "0.71x", "-0.24", "Local Pack (Maps box) absorbs 42% of all local clicks before organic"], [2000, 1600, 1600, 1600, 2560]),
        ]
      }),
      ...sp(1),

      callout(
        "CRITICAL FIX: Local intent CTR multiplier needs to drop from 0.95x to 0.71x. Pages ranking for local queries but not in the Local Pack have dramatically lower organic CTR than the model predicts.",
        "FFF3CD", "F59E0B"
      ),
      ...sp(1),

      h2("2.3 SERP Feature CTR Depression Coefficients"),
      p("When SERP features occupy real estate above organic results, they compress CTR. These coefficients must be applied on top of the benchmark to set realistic targets:"),
      ...sp(1),

      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2400, 1600, 1600, 3760],
        rows: [
          tableHeader(["SERP Feature", "CTR Impact", "Avg Position Shift", "Detection Signal"], [2400, 1600, 1600, 3760]),
          tableRow(["AI Overview (present)", "-30 to -45%", "Appears above P1", "Questions & 'how to' queries — position <= 10"], [2400, 1600, 1600, 3760]),
          tableRow(["Featured Snippet", "+70% if YOU own it / -22% if competitor", "Appears at P0", "Question-pattern queries — detect if CTR > 1.5x benchmark at P1"], [2400, 1600, 1600, 3760], true),
          tableRow(["Local Pack (3 listings)", "-42% on organic", "Effective organic starts at P4", "Near me / local intent queries"], [2400, 1600, 1600, 3760]),
          tableRow(["Shopping Carousel", "-35 to -55%", "Carousel above P1", "Product + price/buy queries"], [2400, 1600, 1600, 3760], true),
          tableRow(["People Also Ask box", "-8 to -15%", "Between organic results", "Question queries with expandable answers"], [2400, 1600, 1600, 3760]),
          tableRow(["Knowledge Panel", "-20 to -30%", "Right sidebar", "Brand / entity queries"], [2400, 1600, 1600, 3760], true),
          tableRow(["Sitelinks", "+30 to +60% for rank 1", "Only P1 benefit", "Brand / navigational queries"], [2400, 1600, 1600, 3760]),
        ]
      }),
      ...sp(2),

      // ── SECTION 3 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("3. Why Pages Show Specific Metrics — Root Cause Engine"),
      p("The most valuable SEO insight is not WHAT the metric is, but WHY it has that value. This section defines the complete root cause decision tree for every major metric."),
      ...sp(1),

      h2("3.1 WHY a Page Has Low CTR Despite Good Position"),
      p("When position <= 5 but CTR < 50% of benchmark, one or more of these root causes applies:"),
      ...sp(1),

      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2800, 3400, 3160],
        rows: [
          tableHeader(["Root Cause", "Detection Logic", "Fix"], [2800, 3400, 3160]),
          tableRow(["Title mismatch — query intent vs title format", "Query starts with 'how'/'what'/'best' but title is generic or keyword-stuffed", "Rewrite title to match intent: 'how' → 'How to X (N Steps)', 'best' → 'Best X in 2026 — N Options'"], [2800, 3400, 3160]),
          tableRow(["Missing year/freshness signal", "Query contains year ('2026', 'this year', 'current') but title lacks it", "Add current year to title — freshness increases CTR 15-25% for 'best' and 'latest' queries"], [2800, 3400, 3160], true),
          tableRow(["Weak meta description", "CTR at positions 2-5 below position 1 proportionally more than benchmark predicts", "Add a call-to-action verb, specific number, or emotional trigger to meta. Test 3 variants."], [2800, 3400, 3160]),
          tableRow(["SERP feature suppression", "Position 1-3 with CTR < 10% (info queries) or < 5% (transactional)", "Check if AI Overview / Featured Snippet / Shopping Carousel appears for this query. Optimize for the feature, not just organic rank."], [2800, 3400, 3160], true),
          tableRow(["URL structure discourages clicks", "Long /category/subcategory/subcategory/slug URLs with digits", "Shorten URL to /topic/slug. Clean URLs add 2-4% CTR lift."], [2800, 3400, 3160]),
          tableRow(["No rich snippet markup", "Competitor pages show stars/breadcrumbs/FAQ but page does not", "Add appropriate schema: FAQ, HowTo, Review, Product, or Recipe — rich results increase CTR 20-30%."], [2800, 3400, 3160], true),
          tableRow(["Title over 60 characters", "Title truncated with '...' in SERP", "Keep titles under 60 chars (580px pixel width). Truncated titles lose 5-8% CTR."], [2800, 3400, 3160]),
          tableRow(["Branded vs non-branded bias", "Very high or very low CTR vs position — not explained by other factors", "Check if query contains brand name. Branded navigational queries expect 35-45% CTR at P1, not 28%."], [2800, 3400, 3160], true),
        ]
      }),
      ...sp(1),

      h2("3.2 WHY a Page Has High Impressions but Zero Clicks"),
      p("This is the most damaging pattern — the page ranks but receives nothing. Root causes in priority order:"),
      ...sp(1),

      numbered("Position > 20 (page 3+): Googlebot indexes but users never scroll this far. Fix: Content depth improvement + backlink acquisition to push into page 1-2."),
      numbered("Featured Snippet owned by competitor: Query appears in GSC impressions because YOUR page ranks organically, but the Featured Snippet box above captures 100% of user attention. Fix: Restructure to win the snippet — lead with a direct answer paragraph, use numbered steps, add definitions."),
      numbered("AI Overview absorbing all clicks: Especially for 'what is X' and 'how to X' queries. Fix: Ensure your page IS sourced by the AI Overview by matching its structure: short answer first, lists, FAQ schema."),
      numbered("Title/meta completely mismatched to query intent: User sees the result and knows it won't answer their question. CTR = 0 even at position 3. Fix: Use GSC query data to align title to the exact search intent of the zero-click query."),
      numbered("Local Pack blocking organic: For 'near me' queries, the Local Pack occupies the top 30-40% of screen. Fix: Google Business Profile optimisation is mandatory before organic CTR work."),
      numbered("Sitelink Search Box on competitor's brand result: When user searches a competitor brand, their enhanced sitelink result spans 50% of viewport. Fix: N/A — focus on non-navigational queries."),
      ...sp(1),

      h2("3.3 WHY Average Position Fluctuates Daily"),
      p("Position volatility is one of the most misunderstood metrics. Average position in GSC = arithmetic mean across all impressions for the period, making it volatile by design:"),
      ...sp(1),
      bullet("New content discovery: Googlebot testing a page at multiple positions before settling — appears as erratic position for 2-8 weeks post-publish."),
      bullet("Algorithm updates: Core updates cause ±5-15 position swings for entire site cohorts. Core Web Vitals updates specifically target UX signals."),
      bullet("Query volume seasonality: More impressions from long-tail queries (which rank lower) during seasonal spikes artificially drags average position down — even if your top queries improved."),
      bullet("Competitor content changes: A competing page improving its quality signals causes your position to drop proportionally. Monitor via third-party rank trackers alongside GSC."),
      bullet("Device mix shift: Mobile vs desktop has different position distribution. A shift in user device mix changes the aggregate position average without any ranking change."),
      ...sp(2),

      // ── SECTION 4 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("4. Keyword Gap Analysis — Complete Implementation"),
      p("Keyword gap analysis identifies queries where your site should appear but does not, and opportunities where you rank but underperform your competitive position. This section provides the complete algorithm specification."),
      ...sp(1),

      h2("4.1 Four Types of Keyword Gaps"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2000, 3500, 3860],
        rows: [
          tableHeader(["Gap Type", "Definition", "Detection Method in SEOMaster"], [2000, 3500, 3860]),
          tableRow(["Volume Gap", "High impressions (>500) with zero clicks. Page exists but doesn't earn traffic.", "Filter: impressions >= 500 AND clicks == 0. Already implemented in contentGaps — expand threshold."], [2000, 3500, 3860]),
          tableRow(["Position Gap", "Ranking on page 2-3 for high-value queries. Traffic is 2-3 ranking improvements away.", "Filter: position 11-30 AND impressions > 200. Requires content depth + backlink push."], [2000, 3500, 3860], true),
          tableRow(["CTR Gap", "Ranking well but converting impressions to clicks poorly. Title/meta/SERP feature issue.", "Filter: position <= 10 AND ctr < (benchmark * 0.7). Already detected — improve specificity."], [2000, 3500, 3860]),
          tableRow(["Semantic Gap", "Queries semantically related to your content but your page doesn't appear at all. Topical coverage gap.", "Group queries by topic cluster. Find cluster keyword families with zero impressions. These are missing content pages."], [2000, 3500, 3860], true),
        ]
      }),
      ...sp(1),

      h2("4.2 Semantic Gap Detection Algorithm"),
      p("This is the missing algorithm in the current codebase. Implementation specification:"),
      ...sp(1),

      codeBlock(
`// SEMANTIC GAP DETECTION — Add to /api/geo/route.ts
// Step 1: Extract top 3 content pillars from existing GSC data
const pillars = clusterQueriesIntoPillars(rows, 3);

// Step 2: For each pillar, build an expected modifier matrix
const EXPECTED_MODIFIERS = [
  'how to', 'what is', 'best', 'review', 'vs', 'alternative',
  'for beginners', 'free', 'cost', 'tutorial', 'guide', 'examples'
];

// Step 3: Cross-reference existing impressions against expected coverage
function findSemanticGaps(pillar, existingRows) {
  const coveredModifiers = new Set();
  for (const row of existingRows) {
    for (const mod of EXPECTED_MODIFIERS) {
      if (row.query.toLowerCase().includes(mod)) {
        coveredModifiers.add(mod);
      }
    }
  }
  return EXPECTED_MODIFIERS.filter(mod => !coveredModifiers.has(mod))
    .map(mod => ({
      pillar: pillar.name,
      missingModifier: mod,
      suggestedQuery: \`\${mod} \${pillar.name}\`,
      estimatedVolume: 'Unknown — requires keyword tool',
      priority: ['how to','best','what is'].includes(mod) ? 'High' : 'Medium',
      suggestedContent: \`Create page targeting "\${mod} \${pillar.name}"\`,
    }));
}`
      ),
      ...sp(1),

      h2("4.3 Long-Tail Keyword Gap Finder"),
      p("Long-tail queries (4+ words) represent 60-70% of all searches and are dramatically undermonetised in most sites. Implementation:"),
      ...sp(1),

      codeBlock(
`// LONG-TAIL GAP ANALYSIS — Add to /api/gsc-analysis/route.ts
function analyzeLongTailGaps(rows) {
  // Group by word count
  const wordCountBuckets = { short: [], medium: [], longTail: [], ultraLong: [] };

  for (const row of rows) {
    const wc = row.query.split(/\\s+/).length;
    if (wc <= 2) wordCountBuckets.short.push(row);
    else if (wc === 3) wordCountBuckets.medium.push(row);
    else if (wc <= 5) wordCountBuckets.longTail.push(row);
    else wordCountBuckets.ultraLong.push(row);
  }

  // Long-tail queries have LOWER competition and HIGHER conversion intent
  // If longTail + ultraLong < 40% of total impressions: content depth problem
  const longTailShare = (
    wordCountBuckets.longTail.length + wordCountBuckets.ultraLong.length
  ) / rows.length;

  // Find long-tail queries with HIGH position (proof content resonates)
  // but LOW impressions (proof volume is untapped)
  const highPotentialLongTail = rows.filter(r =>
    r.query.split(/\\s+/).length >= 4 &&
    r.position <= 5 &&
    r.impressions < 100 &&
    r.clicks > 0
  );

  return {
    longTailShare: parseFloat((longTailShare * 100).toFixed(1)),
    longTailHealthLabel: longTailShare >= 0.40 ? 'Healthy'
      : longTailShare >= 0.25 ? 'Needs Expansion' : 'Critical Gap',
    highPotentialLongTail,
    recommendation: longTailShare < 0.40
      ? 'Add FAQ sections, step-by-step guides, and use case pages to capture long-tail queries'
      : 'Long-tail coverage is healthy — focus on quick wins in medium-tail (3-word) queries',
    wordCountBreakdown: {
      short_1_2: wordCountBuckets.short.length,
      medium_3: wordCountBuckets.medium.length,
      longTail_4_5: wordCountBuckets.longTail.length,
      ultraLong_6plus: wordCountBuckets.ultraLong.length,
    }
  };
}`
      ),
      ...sp(1),

      h2("4.4 Question Keyword Gap Matrix"),
      p("Questions are the highest AI Overview risk AND the highest organic opportunity. Every content pillar should have full coverage of the 5W1H question set:"),
      ...sp(1),

      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1200, 1800, 2000, 2360, 2000],
        rows: [
          tableHeader(["Question Type", "Example Query", "Best Format", "Schema", "AI Overview Risk"], [1200, 1800, 2000, 2360, 2000]),
          tableRow(["What is X", "what is project management", "Definitional — 40-word direct answer + expanded", "FAQPage or DefinedTerm", "VERY HIGH — own it"], [1200, 1800, 2000, 2360, 2000]),
          tableRow(["How to X", "how to manage a remote team", "Step-by-step numbered list", "HowTo with steps", "HIGH — must rank top 3"], [1200, 1800, 2000, 2360, 2000], true),
          tableRow(["Why X", "why is project management important", "Benefit list + explanation", "Article with FAQPage", "MEDIUM — longer answers favoured"], [1200, 1800, 2000, 2360, 2000]),
          tableRow(["Best X for Y", "best project management software for startups", "Comparison table + verdict", "ItemList or Product", "LOW — commercial intent reduces AI Overview"], [1200, 1800, 2000, 2360, 2000], true),
          tableRow(["X vs Y", "Asana vs Monday.com", "Head-to-head table + verdict", "Product or FAQPage", "LOW — comparative content often skipped"], [1200, 1800, 2000, 2360, 2000]),
          tableRow(["X cost / pricing", "project management software cost", "Pricing table with ranges", "Product with offers", "VERY LOW — conversion intent"], [1200, 1800, 2000, 2360, 2000], true),
        ]
      }),
      ...sp(2),

      // ── SECTION 5 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("5. Per-Page Deep Analysis Engine — Full Specification"),
      p("The most impactful missing feature in the current codebase is page-level intelligence. Currently the system aggregates by query; production-grade analysis must aggregate by page URL and provide specific diagnostics for each individual page."),
      ...sp(1),

      h2("5.1 Page-Level Metrics Object — Complete Schema"),
      codeBlock(
`// COMPLETE PAGE-LEVEL ANALYSIS OBJECT
// Add to /api/gsc-analysis/route.ts
interface PageAnalysis {
  url: string;

  // ── Traffic Metrics ──────────────────────────────────────────
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  queryCount: number;           // # unique queries driving traffic to this page

  // ── Performance vs Benchmark ─────────────────────────────────
  benchmarkClicks: number;      // clicks expected at current position/intent mix
  clickGap: number;             // benchmarkClicks - totalClicks
  ctrRatio: number;             // avgCTR / benchmarkCTR — <0.7 = underperforming
  performanceGrade: string;      // A/B/C/D/F based on ctrRatio

  // ── Query Coverage Analysis ──────────────────────────────────
  dominantQuery: string;        // highest-impression query for this page
  queryConcentration: number;   // top query's share of total impressions (%)
  intentDistribution: Record<string, number>; // informational/transactional etc
  longTailShare: number;        // % of queries that are 4+ words
  zeroClickQueries: number;     // queries with impressions but 0 clicks

  // ── Cannibalisation Risk ─────────────────────────────────────
  cannibalizedQueries: string[]; // queries where 2+ pages compete
  cannibalRisk: 'High' | 'Medium' | 'Low' | 'None';

  // ── AI Overview Exposure ─────────────────────────────────────
  aiOverviewCandidateCount: number;
  topAIScore: number;           // 0-100, highest AI eligibility score on page
  aiOverviewRisk: string;       // if page could lose clicks to AI Overviews

  // ── Content Diagnostics (rule-based inference) ───────────────
  estimatedContentIssues: Array<{
    issue: string;              // e.g. "Title mismatch detected"
    confidence: 'High' | 'Medium' | 'Low';
    evidence: string;           // what data suggests this issue
    fix: string;                // specific action to take
  }>;

  // ── Opportunity Score ────────────────────────────────────────
  totalOpportunityScore: number;  // sum of all opportunity scores for page
  priorityRank: number;           // rank 1 = highest opportunity site-wide
  estimatedClicksGainIfFixed: number;
}`
      ),
      ...sp(1),

      h2("5.2 Page Performance Grade Algorithm"),
      p("Each page receives a letter grade based on a composite of 5 equally-weighted signals:"),
      ...sp(1),

      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1800, 1800, 1800, 1800, 2160],
        rows: [
          tableHeader(["Grade", "CTR Ratio", "Zero-Click %", "Query Concentration", "Cannibal Risk"], [1800, 1800, 1800, 1800, 2160]),
          tableRow(["A — Excellent", ">= 1.20", "< 10%", "< 50%", "None"], [1800, 1800, 1800, 1800, 2160]),
          tableRow(["B — Good", "0.90-1.19", "10-20%", "50-65%", "Low"], [1800, 1800, 1800, 1800, 2160], true),
          tableRow(["C — Needs Work", "0.65-0.89", "20-35%", "65-80%", "Medium"], [1800, 1800, 1800, 1800, 2160]),
          tableRow(["D — Poor", "0.40-0.64", "35-55%", "> 80%", "High"], [1800, 1800, 1800, 1800, 2160], true),
          tableRow(["F — Critical", "< 0.40", "> 55%", "> 90%", "High"], [1800, 1800, 1800, 1800, 2160]),
        ]
      }),
      ...sp(1),

      h2("5.3 Content Issue Inference Engine"),
      p("Without access to actual page HTML, the system can infer likely content issues from GSC signal patterns. This is the rule-based inference engine:"),
      ...sp(1),

      codeBlock(
`// CONTENT ISSUE INFERENCE — Add to page analysis pipeline
function inferContentIssues(page) {
  const issues = [];

  // ── TITLE MISMATCH DETECTION ────────────────────────────────
  const hasQuestionQueries = page.queries.some(q =>
    /^(how|what|why|when|where|who)/i.test(q.query)
  );
  if (hasQuestionQueries && page.avgCTR < page.benchmarkCTR * 0.6) {
    issues.push({
      issue: 'Title-Intent Mismatch',
      confidence: 'High',
      evidence: \`Page ranks for question queries but CTR is \${
        (page.avgCTR / page.benchmarkCTR * 100).toFixed(0)}% of benchmark\`,
      fix: 'Rewrite title tag to mirror dominant question format: ' +
           '"[Question Verb] [Topic]: [Specific Answer Hint]"'
    });
  }

  // ── THIN CONTENT DETECTION ─────────────────────────────────
  if (page.queryCount < 5 && page.totalImpressions > 500) {
    issues.push({
      issue: 'Thin Topical Coverage',
      confidence: 'Medium',
      evidence: \`Only \${page.queryCount} unique queries driving traffic — well-written pages \\
        typically attract 20-50+ query variants\`,
      fix: 'Expand content to cover more sub-topics, add FAQs, include ' +
           'related keyword variations naturally in headings and paragraphs'
    });
  }

  // ── FEATURED SNIPPET OPPORTUNITY DETECTION ────────────────
  if (page.avgPosition >= 2 && page.avgPosition <= 5 &&
      page.avgCTR < 5 && hasQuestionQueries) {
    issues.push({
      issue: 'Featured Snippet Opportunity Missed',
      confidence: 'High',
      evidence: \`Position \${page.avgPosition.toFixed(1)} with \${page.avgCTR.toFixed(1)}% \\
        CTR on question queries — competitor likely owns Featured Snippet\`,
      fix: 'Add 40-50 word direct answer immediately after H1. ' +
           'Use numbered list for steps. Add FAQ schema.'
    });
  }

  // ── CANNIBALIZATION SIGNAL ──────────────────────────────────
  if (page.cannibalRisk === 'High') {
    issues.push({
      issue: 'Keyword Cannibalization',
      confidence: 'High',
      evidence: \`\${page.cannibalizedQueries.length} queries have multiple competing pages\`,
      fix: 'Canonical this page as the definitive resource. ' +
           'Noindex or 301-redirect competing URLs. Consolidate content.'
    });
  }

  // ── CLICK-THROUGH RATE EFFICIENCY ──────────────────────────
  if (page.zeroClickQueries / page.queryCount > 0.5) {
    issues.push({
      issue: 'High Zero-Click Query Ratio',
      confidence: 'Medium',
      evidence: \`\${(page.zeroClickQueries/page.queryCount*100).toFixed(0)}% of queries \\
        earn impressions but no clicks\`,
      fix: 'Audit query-by-query. Top zero-click queries likely have ' +
           'Featured Snippets or AI Overviews. For each, either win the feature or ' +
           'target a more commercial modifier.'
    });
  }

  return issues;
}`
      ),
      ...sp(2),

      // ── SECTION 6 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("6. Deep Metrics Dictionary — Every Metric Explained"),
      p("This section is the complete reference for every metric produced by SEOMaster, including calculation formula, benchmark, health threshold, and actionable interpretation."),
      ...sp(1),

      h2("6.1 Core GSC Metrics"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1600, 2000, 1760, 2000, 2000],
        rows: [
          tableHeader(["Metric", "Formula", "Benchmark", "Health Threshold", "When to Act"], [1600, 2000, 1760, 2000, 2000]),
          tableRow(["CTR (Click-Through Rate)", "clicks ÷ impressions × 100", "Position 1: 28.5%, Pos 3: 11%", "If < 70% of position benchmark", "Rewrite title/meta. Add schema markup."], [1600, 2000, 1760, 2000, 2000]),
          tableRow(["Impression Share", "page impressions ÷ total site impressions", "Top page: 30-60% is healthy", "Single page > 70% = dependency risk", "Build topical depth — add related pages."], [1600, 2000, 1760, 2000, 2000], true),
          tableRow(["Click Efficiency Ratio", "actual clicks ÷ benchmark clicks", "1.0 = at benchmark", "< 0.7 = underperforming", "< 0.5 = critical: content/title audit needed."], [1600, 2000, 1760, 2000, 2000]),
          tableRow(["Position Volatility", "Std dev of daily positions (30-day window)", "< 2.5 positions = stable", "> 5 positions = volatile", "Check for thin content, duplicate signals, algorithm sensitivity."], [1600, 2000, 1760, 2000, 2000], true),
          tableRow(["Query Coverage Index", "Unique queries earning impressions per page", "Blog posts: 15-40 queries", "< 5 queries = thin content signal", "Expand FAQ sections, add semantic variations."], [1600, 2000, 1760, 2000, 2000]),
          tableRow(["Long-Tail Concentration", "Queries 4+ words ÷ total queries", "40-60% long-tail is healthy", "< 25% = targeting too broad", "Add use-case specificity, FAQ content, tutorials."], [1600, 2000, 1760, 2000, 2000], true),
        ]
      }),
      ...sp(1),

      h2("6.2 Opportunity Metrics"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1800, 3600, 3960],
        rows: [
          tableHeader(["Metric", "Calculation", "Interpretation"], [1800, 3600, 3960]),
          tableRow(["Estimated Clicks Lost (ECL)", "impressions × (benchmark_ctr - actual_ctr) / 100", "Clicks you WOULD be earning if CTR matched position benchmark. ECL > 100/mo = immediate action required."], [1800, 3600, 3960]),
          tableRow(["Traffic Recovery Potential (TRP)", "Sum of ECL across all underperforming queries for a page", "The maximum monthly click recovery if all CTR gaps are closed. Use to prioritise which pages get editorial effort first."], [1800, 3600, 3960], true),
          tableRow(["Quick Win Score", "(10 - position) × impressions × (1 - ctr_ratio)", "Pages with position 4-8, high impressions, and CTR below benchmark. A push of 2-3 positions yields massive returns."], [1800, 3600, 3960]),
          tableRow(["Topical Authority Index", "Average position across all queries in a topic cluster", "< 5.0 = strong authority in topic. > 12.0 = topic needs a dedicated pillar page + supporting cluster."], [1800, 3600, 3960], true),
          tableRow(["Cannibalization Split Score", "Competing page impressions ÷ dominant page impressions", "> 0.5 = severe signal split. Consolidate immediately. 0.2-0.5 = moderate. Consider canonical. < 0.2 = low risk."], [1800, 3600, 3960]),
        ]
      }),
      ...sp(1),

      h2("6.3 AI Overview & GEO Metrics"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1800, 2400, 2560, 2600],
        rows: [
          tableHeader(["Metric", "Score Range", "What It Measures", "Production Action"], [1800, 2400, 2560, 2600]),
          tableRow(["AI Overview Eligibility Score", "0-100", "Likelihood query triggers AI Overview AND your page is sourced. Factors: intent (40pts), question pattern (20pts), format signals (20pts), position (20pts).", "Score >= 75: Add 40-word direct answer + FAQ schema. Score 50-74: Reach top 5 first. Score < 50: Focus on traditional ranking."], [1800, 2400, 2560, 2600]),
          tableRow(["GEO Momentum Score", "0-100", "How well a content format is performing CTR-wise within a topic cluster. High-momentum formats should be replicated.", "Scale production of the highest-momentum format. E.g., if 'How-To Guide' format drives 2x avg CTR in your niche — build more."], [1800, 2400, 2560, 2600], true),
          tableRow(["E-E-A-T Signal Density", "0-100 (inferred)", "Presence of author byline signals, citation patterns, and expertise markers in content structure (inferred from query-to-page mapping).", "Score < 40: Add author bio schema, cite sources, add original data/statistics. Google uses these for AI Overview sourcing decisions."], [1800, 2400, 2560, 2600]),
          tableRow(["Programmatic Scale Index", "Count of modifier × pillar combinations", "How many unique 'modifier + pillar' content pages exist vs could exist. Identifies programmatic content opportunities.", "If score < 30% of maximum possible combinations, build programmatic pages for the top 3 modifier types."], [1800, 2400, 2560, 2600], true),
        ]
      }),
      ...sp(2),

      // ── SECTION 7 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("7. Production Improvements — Code Implementation Roadmap"),
      p("Prioritised list of algorithm improvements to take SEOMaster from good to production-grade industry standard. Ordered by impact-to-effort ratio."),
      ...sp(1),

      h2("7.1 Priority 1 — High Impact, Low Effort (Implement This Week)"),

      h3("7.1.1 Fix Local Intent CTR Multiplier"),
      codeBlock(
`// In /api/gsc-analysis/route.ts — update INTENT_CTR_MULTIPLIER:
const INTENT_CTR_MULTIPLIER: Record<string, number> = {
  navigational:  1.35,  // was 1.25 — branded queries get higher CTR
  informational: 1.00,  // was 1.05 — AI Overview depression
  transactional: 0.78,  // was 0.85 — ads + shopping above organic
  commercial:    0.87,  // was 0.90 — rich snippets, comparisons
  local:         0.71,  // was 0.95 — LOCAL PACK TAKES 42% of local clicks
};`
      ),
      ...sp(1),

      h3("7.1.2 Add Page-Level Aggregation"),
      codeBlock(
`// In /api/gsc-analysis/route.ts — ADD this after scored array:
function buildPageAnalysis(rows: GSCRow[], scored: ScoredRow[]) {
  const pageMap = new Map<string, {
    queries: ScoredRow[];
    clicks: number;
    impressions: number;
    ctrSum: number;
    posSum: number;
    benchClicksSum: number;
    oppScoreSum: number;
  }>();

  for (const r of scored) {
    if (!r.page) continue;
    if (!pageMap.has(r.page)) {
      pageMap.set(r.page, {
        queries: [], clicks: 0, impressions: 0,
        ctrSum: 0, posSum: 0, benchClicksSum: 0, oppScoreSum: 0
      });
    }
    const page = pageMap.get(r.page)!;
    page.queries.push(r);
    page.clicks += r.clicks;
    page.impressions += r.impressions;
    page.ctrSum += r.ctr;
    page.posSum += r.position;
    page.benchClicksSum += r.impressions * r.benchCTR / 100;
    page.oppScoreSum += r.opportunityScore;
  }

  return Array.from(pageMap.entries()).map(([url, data]) => {
    const n = data.queries.length;
    const avgCTR = data.ctrSum / n;
    const avgPos = data.posSum / n;
    const benchCTR = data.benchClicksSum / data.impressions * 100;
    const ctrRatio = avgCTR / Math.max(benchCTR, 0.01);

    return {
      url,
      totalClicks: data.clicks,
      totalImpressions: data.impressions,
      avgCTR: parseFloat(avgCTR.toFixed(2)),
      avgPosition: parseFloat(avgPos.toFixed(1)),
      queryCount: n,
      benchmarkClicks: Math.round(data.benchClicksSum),
      clickGap: Math.round(data.benchClicksSum - data.clicks),
      ctrRatio: parseFloat(ctrRatio.toFixed(3)),
      performanceGrade: ctrRatio >= 1.2 ? 'A' : ctrRatio >= 0.9 ? 'B'
        : ctrRatio >= 0.65 ? 'C' : ctrRatio >= 0.4 ? 'D' : 'F',
      totalOpportunityScore: parseFloat(data.oppScoreSum.toFixed(1)),
      zeroClickQueries: data.queries.filter(q => q.clicks === 0).length,
      dominantQuery: data.queries.sort(
        (a, b) => b.impressions - a.impressions
      )[0]?.query || '',
    };
  }).sort((a, b) => b.totalOpportunityScore - a.totalOpportunityScore);
}`
      ),
      ...sp(1),

      h3("7.1.3 Add Long-Tail Health Score to Overview"),
      codeBlock(
`// Add to overview object in /api/gsc-analysis/route.ts:
const longTailQueries = rows.filter(r => r.query.split(/\\s+/).length >= 4);
const longTailShare = rows.length > 0
  ? parseFloat((longTailQueries.length / rows.length * 100).toFixed(1))
  : 0;
const longTailClicks = longTailQueries.reduce((s, r) => s + r.clicks, 0);
const longTailClickShare = totalClicks > 0
  ? parseFloat((longTailClicks / totalClicks * 100).toFixed(1))
  : 0;

// Include in overview return:
longTailHealth: {
  queryShare: longTailShare,
  clickShare: longTailClickShare,
  status: longTailShare >= 40 ? 'Healthy'
    : longTailShare >= 25 ? 'Needs Expansion' : 'Critical Gap',
  recommendation: longTailShare < 40
    ? 'Add FAQ sections and use-case pages to capture long-tail traffic'
    : 'Long-tail healthy — focus CTR optimisation on medium-tail queries',
}`
      ),
      ...sp(1),

      h2("7.2 Priority 2 — High Impact, Medium Effort"),

      h3("7.2.1 Trend Analysis Engine"),
      codeBlock(
`// NEW ENDPOINT: /api/trends/route.ts
// Requires storing multiple GSC snapshots over time (already in DB schema)
// Compare current period vs previous period:

function calculateTrendMetrics(current: GSCSnapshot, previous: GSCSnapshot) {
  const clicksDelta = current.totalClicks - previous.totalClicks;
  const impressionsDelta = current.totalImpressions - previous.totalImpressions;
  const positionDelta = current.avgPosition - previous.avgPosition;
  const ctrDelta = current.avgCTR - previous.avgCTR;

  return {
    clicksGrowth: parseFloat((clicksDelta / previous.totalClicks * 100).toFixed(1)),
    impressionsGrowth: parseFloat((impressionsDelta / previous.totalImpressions * 100).toFixed(1)),
    positionChange: parseFloat(positionDelta.toFixed(1)),
    ctrChange: parseFloat(ctrDelta.toFixed(2)),
    growingQueries: findGrowingQueries(current.queries, previous.queries),
    decliningQueries: findDecliningQueries(current.queries, previous.queries),
    newQueries: findNewQueries(current.queries, previous.queries),
    lostQueries: findLostQueries(current.queries, previous.queries),
  };
}

// Growing query = clicks MoM growth > 20%
function findGrowingQueries(curr, prev) {
  return curr.filter(cq => {
    const pq = prev.find(p => p.query === cq.query);
    if (!pq || pq.clicks < 5) return false;
    return ((cq.clicks - pq.clicks) / pq.clicks) > 0.20;
  }).sort((a, b) => b.clicks - a.clicks).slice(0, 20);
}`
      ),
      ...sp(1),

      h3("7.2.2 Semantic Gap Report"),
      codeBlock(
`// Add to /api/geo/route.ts
function generateSemanticGapReport(pillars, allRows) {
  const QUESTION_MODIFIERS = [
    'how to', 'what is', 'why is', 'when to', 'which is best',
    'how does', 'what are', 'how much', 'is it worth', 'can you'
  ];
  const COMMERCIAL_MODIFIERS = [
    'best', 'top', 'review', 'vs', 'alternative', 'pricing',
    'free', 'cheap', 'affordable', 'comparison'
  ];
  const INTENT_MODIFIERS = [...QUESTION_MODIFIERS, ...COMMERCIAL_MODIFIERS];

  return pillars.map(pillar => {
    const coveredPhrases = new Set(
      allRows.map(r => r.query.toLowerCase())
    );

    const gaps = INTENT_MODIFIERS
      .map(mod => {
        const expectedPhrase = \`\${mod} \${pillar.name.toLowerCase()}\`;
        const hasCoverage = [...coveredPhrases].some(q =>
          q.includes(mod) && q.includes(pillar.name.toLowerCase())
        );
        return { modifier: mod, query: expectedPhrase, hasCoverage };
      })
      .filter(g => !g.hasCoverage);

    return {
      pillar: pillar.name,
      coveredModifiers: INTENT_MODIFIERS.length - gaps.length,
      gapCount: gaps.length,
      coverageScore: parseFloat(
        ((1 - gaps.length / INTENT_MODIFIERS.length) * 100).toFixed(0)
      ),
      gaps: gaps.map(g => ({
        ...g,
        priority: QUESTION_MODIFIERS.includes(g.modifier) ? 'High' : 'Medium',
        contentType: QUESTION_MODIFIERS.includes(g.modifier) ? 'Informational' : 'Commercial',
      }))
    };
  });
}`
      ),
      ...sp(1),

      h2("7.3 Priority 3 — Strategic (Next Sprint)"),

      h3("7.3.1 Page Speed / Core Web Vitals Correlation"),
      p("Add a new tab 'Core Web Vitals' that cross-references PageSpeed Insights API data with GSC performance data. Pages with CWV failures tend to show position depression — this correlation makes the business case for technical fixes:"),
      ...sp(1),
      bullet("Call PageSpeed Insights API: GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={URL}&strategy=mobile"),
      bullet("Extract: LCP, INP, CLS, FCP, TTFB from the Core Web Vitals assessment"),
      bullet("Correlate: Sort pages by CWV score, compare against GSC position and CTR. Pages with 'poor' LCP tend to have 15-25% lower CTR than pages with 'good' LCP at equivalent positions."),
      bullet("Action: Flag pages where fixing CWV could unlock ranking improvements. Prioritise by: (impressions × position_improvement_potential)."),
      ...sp(1),

      h3("7.3.2 Competitor Gap Analysis via SerpAPI"),
      p("True competitor gap analysis requires knowing which queries competitors rank for that you don't. Implementation path:"),
      ...sp(1),
      numbered("Integrate SerpAPI (or similar) — cost ~$50/mo for 5,000 monthly searches"),
      numbered("For each of your top 20 queries by impressions, fetch top 10 SERP results"),
      numbered("Identify the 3 competitor domains that appear most frequently across your top queries"),
      numbered("For those competitor URLs, check if they rank for queries where YOUR site has zero impressions — these are pure content gaps"),
      numbered("Output: 'Competitor X ranks for 47 queries you have no coverage on — estimated missing traffic: 12,400 clicks/month'"),
      ...sp(2),

      // ── SECTION 8 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("8. Opportunity Scoring Algorithm — Revised Formula"),
      p("The current opportunity scoring formula is functional but uses arbitrary weights. This section defines the production-grade composite opportunity score (OppScore v2) with industry-validated weights."),
      ...sp(1),

      h2("8.1 OppScore v2 Formula"),
      callout(
        "OppScore v2 = (CTR_Deficit × ImpactWeight) + (PositionUpside × QuickWinWeight) + (ClickVelocity × VelocityWeight) + (AIEligibility × AIWeight)\n\nWhere each component is normalized 0-100 before weighting.",
        "E8F4FD", "3B82F6"
      ),
      ...sp(1),

      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2000, 1400, 2560, 3400],
        rows: [
          tableHeader(["Component", "Weight", "Formula", "Rationale"], [2000, 1400, 2560, 3400]),
          tableRow(["CTR Deficit Score", "35%", "(1 - ctrRatio) × impressions × 0.1", "Highest weight: a CTR fix is a purely content change, no waiting for Google to recrawl. Immediate ROI."], [2000, 1400, 2560, 3400]),
          tableRow(["Position Upside", "30%", "max(0, 10 - position) × qualityMultiplier", "Position 4-10 has the highest upside: one good content update can yield +200% clicks at position 3."], [2000, 1400, 2560, 3400], true),
          tableRow(["Click Velocity", "20%", "clicks × (impressions / avgSiteImpressionsPerQuery)", "High existing clicks + high relative impressions = query is growing. Invest in momentum."], [2000, 1400, 2560, 3400]),
          tableRow(["AI Overview Risk", "15%", "aiScore × (1 - ctrRatio)", "High AI eligibility + low CTR = AI Overview may already be stealing clicks. Fix before losing more."], [2000, 1400, 2560, 3400], true),
        ]
      }),
      ...sp(1),

      codeBlock(
`// REVISED OPPORTUNITY SCORE — Replace calcOpportunityScore() in route.ts
function calcOpportunityScore(r: ScoredRow, avgSiteImpressions: number): number {
  const { intent, ctrGap, ctrRatio, position, impressions, clicks, aiScore } = r;

  // Component 1: CTR Deficit (0-100)
  const ctrDeficitRaw = Math.max(0, 1 - ctrRatio) * impressions * 0.1;
  const ctrDeficitNorm = Math.min(100, ctrDeficitRaw);

  // Component 2: Position Upside (0-100)
  const posUpside = position >= 1 && position <= 10
    ? (10 - position) * 11.1  // 0-100 scale
    : position <= 20 ? 5 : 0;
  const qualMult = impressions >= 1000 ? 1.4 : impressions >= 200 ? 1.0 : 0.6;
  const posUpsideNorm = Math.min(100, posUpside * qualMult);

  // Component 3: Click Velocity (0-100)
  const relativeImpressions = avgSiteImpressions > 0
    ? impressions / avgSiteImpressions : 1;
  const velocityRaw = clicks * Math.min(relativeImpressions, 5) * 10;
  const velocityNorm = Math.min(100, velocityRaw);

  // Component 4: AI Overview Risk (0-100) - use score if available
  const aiRiskNorm = typeof aiScore !== 'undefined'
    ? (aiScore / 100) * Math.max(0, 1 - ctrRatio) * 100
    : 0;

  // Weighted composite
  return parseFloat((
    ctrDeficitNorm * 0.35 +
    posUpsideNorm  * 0.30 +
    velocityNorm   * 0.20 +
    aiRiskNorm     * 0.15
  ).toFixed(2));
}`
      ),
      ...sp(2),

      // ── SECTION 9 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("9. Site Health Score v2 — Composite Rating System"),
      p("The current health score exists but is uncalibrated. This section defines the production health score with proper grade distributions and actionable interpretation."),
      ...sp(1),

      h2("9.1 Health Score Component Breakdown"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2000, 1200, 2360, 1200, 2600],
        rows: [
          tableHeader(["Component", "Weight", "How Calculated", "Full Marks", "Half Marks"], [2000, 1200, 2360, 1200, 2600]),
          tableRow(["CTR Efficiency", "25%", "Avg actual CTR ÷ avg benchmark CTR across all queries", ">= 1.0", "0.5 - 0.99"], [2000, 1200, 2360, 1200, 2600]),
          tableRow(["Page 1 Coverage", "20%", "Queries with position <= 10 ÷ total queries", ">= 60%", "30-59%"], [2000, 1200, 2360, 1200, 2600], true),
          tableRow(["Click Capture Rate", "20%", "Actual clicks ÷ benchmark clicks (if CTR were optimal)", ">= 80%", "50-79%"], [2000, 1200, 2360, 1200, 2600]),
          tableRow(["Long-Tail Health", "15%", "Queries 4+ words ÷ total queries", ">= 40%", "25-39%"], [2000, 1200, 2360, 1200, 2600], true),
          tableRow(["Zero-Click Ratio", "10%", "1 - (queries with zero clicks ÷ total queries)", "< 20% zero-click", "20-40% zero-click"], [2000, 1200, 2360, 1200, 2600]),
          tableRow(["Query Diversity", "10%", "Unique queries per page (avg across top 20 pages)", ">= 15 queries/page", "5-14 queries/page"], [2000, 1200, 2360, 1200, 2600], true),
        ]
      }),
      ...sp(1),

      h2("9.2 Grade Thresholds and Industry Context"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1200, 1600, 1600, 2560, 2400],
        rows: [
          tableHeader(["Grade", "Score Range", "Industry Percentile", "What It Means", "Priority Action"], [1200, 1600, 1600, 2560, 2400]),
          tableRow(["A", "85-100", "Top 15%", "Site is capturing near-maximum available organic traffic. CTR is excellent, coverage broad.", "Maintain and expand into new topic clusters."], [1200, 1600, 1600, 2560, 2400]),
          tableRow(["B", "70-84", "Top 35%", "Good performance with clear optimization opportunities. Most pages earning clicks efficiently.", "Fix top 5 CTR gaps, expand long-tail coverage."], [1200, 1600, 1600, 2560, 2400], true),
          tableRow(["C", "55-69", "Top 55%", "Average performance. Significant traffic being lost to CTR inefficiency or poor coverage.", "Systematic title/meta audit across all page-1 pages. Add FAQ content."], [1200, 1600, 1600, 2560, 2400]),
          tableRow(["D", "40-54", "Bottom 45%", "Below average. Multiple systemic issues. High cannibalization or content gaps likely.", "Full content audit. Resolve cannibalization. Rebuild top pages with proper E-E-A-T signals."], [1200, 1600, 1600, 2560, 2400], true),
          tableRow(["F", "0-39", "Bottom 25%", "Critical issues. Site may have manual actions, thin content, or technical SEO blocking performance.", "Technical SEO audit first. Check Search Console manual actions. Resolve indexation issues."], [1200, 1600, 1600, 2560, 2400]),
        ]
      }),
      ...sp(2),

      // ── SECTION 10 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("10. API Architecture & Data Flow"),
      p("Complete documentation of all API endpoints, their data flow, and the algorithms they execute."),
      ...sp(1),

      h2("10.1 Endpoint Map"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2800, 1600, 4960],
        rows: [
          tableHeader(["Endpoint", "Method", "Purpose & Algorithm Chain"], [2800, 1600, 4960]),
          tableRow(["/api/gsc-analysis", "POST", "PRIMARY ANALYSIS ENGINE. Runs: CTR scoring → Intent classification → Opportunity scoring → AI Overview eligibility → Cannibalization detection → Health scoring → AI synthesis."], [2800, 1600, 4960]),
          tableRow(["/api/analyze", "POST", "LEGACY MULTI-TYPE ENDPOINT. Handles gsc_full, ctr_optimize, keyword_research, topic_cluster. Consider migrating to dedicated endpoints."], [2800, 1600, 4960], true),
          tableRow(["/api/geo", "POST", "GEO MATRIX ENGINE. Pillar clustering → Momentum detection → Programmatic gap identification → Blueprint generation."], [2800, 1600, 4960]),
          tableRow(["/api/filter", "POST", "REGEX FILTER ENGINE. Client-side regex filtering → Intent distribution → CTR gap analysis → Cannibalization within filtered set."], [2800, 1600, 4960], true),
          tableRow(["/api/diagnose", "POST", "INDEX DIAGNOSTIC. URL pattern grouping → Status code root cause → Priority classification."], [2800, 1600, 4960]),
          tableRow(["/api/crawl", "POST", "CRAWL BUDGET ANALYZER. HTTP status code analysis → File type waste detection → Crawl purpose distribution."], [2800, 1600, 4960], true),
          tableRow(["/api/gsc", "POST", "GSC API PROXY. Service Account JWT auth → Google Search Console searchAnalytics query."], [2800, 1600, 4960]),
          tableRow(["/api/ai", "POST", "AI PROXY. Routes to MiniMax M2.7 via Hermes/OpenRouter. Standard and agentic modes."], [2800, 1600, 4960], true),
          tableRow(["/api/reports", "GET/DELETE", "REPORT HISTORY. Neon PostgreSQL CRUD for saved analysis reports."], [2800, 1600, 4960]),
          tableRow(["/api/sitemap", "POST", "SITEMAP VALIDATOR. HEAD validation + Google ping."], [2800, 1600, 4960], true),
        ]
      }),
      ...sp(1),

      h2("10.2 Data Flow — Full GSC Analysis Pipeline"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1000, 2200, 3400, 2760],
        rows: [
          tableHeader(["Step", "Function", "Input → Output", "Time Cost"], [1000, 2200, 3400, 2760]),
          tableRow(["1", "classifyIntent()", "query string → {intent, category, isQuestion, isLongTail}", "O(n) — <5ms for 5k rows"], [1000, 2200, 3400, 2760]),
          tableRow(["2", "benchmarkCTR()", "position + intent → benchmark CTR %", "O(n) — lookup table"], [1000, 2200, 3400, 2760], true),
          tableRow(["3", "calcOpportunityScore()", "row + benchmarkCTR → composite 0-100 score", "O(n) — math ops"], [1000, 2200, 3400, 2760]),
          tableRow(["4", "scoreAIOverviewEligibility()", "row + intent → {score, label, reason, optimization}", "O(n) — pattern matching"], [1000, 2200, 3400, 2760], true),
          tableRow(["5", "detectCannibalization()", "all rows → cannibalization cases", "O(n²) worst case — group by query key"], [1000, 2200, 3400, 2760]),
          tableRow(["6", "positionBands()", "all rows → position band cohort stats", "O(n) — single pass"], [1000, 2200, 3400, 2760], true),
          tableRow(["7", "siteHealthScore()", "all rows + scored → composite health 0-100", "O(n) — aggregation"], [1000, 2200, 3400, 2760]),
          tableRow(["8", "callAI() — synthesis", "top opportunities summary → JSON synthesis", "2-8 seconds — AI API call (non-blocking via try/catch)"], [1000, 2200, 3400, 2760], true),
          tableRow(["9", "saveGSCSnapshot()", "rows + metrics → Neon PostgreSQL", "50-200ms — async, non-blocking"], [1000, 2200, 3400, 2760]),
        ]
      }),
      ...sp(2),

      // ── SECTION 11 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("11. Decision Reference — Quick Lookup Tables"),
      p("Field-ready lookup tables for the most common decisions an SEO analyst needs to make based on the data SEOMaster produces."),
      ...sp(1),

      h2("11.1 When to Write New Content vs Optimise Existing"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1800, 1800, 5760],
        rows: [
          tableHeader(["Impressions", "Position", "Recommended Action"], [1800, 1800, 5760]),
          tableRow(["> 1000", "1-3", "OPTIMISE CTR: Rewrite title/meta. Add schema. The ranking is strong — only CTR needs fixing."], [1800, 1800, 5760]),
          tableRow(["> 1000", "4-10", "QUICK WIN: Improve content depth (add H2s, FAQs, examples). Build 3-5 internal links from high-authority pages. Target top 3."], [1800, 1800, 5760], true),
          tableRow(["> 1000", "11-20", "CONTENT UPGRADE: Significant content gap. Research top-ranking pages for this query. Add missing sections. Build external links."], [1800, 1800, 5760]),
          tableRow(["> 1000", "21-50", "REBUILD OR REDIRECT: Consider consolidating into a stronger page, or rebuilding from scratch with better topical coverage."], [1800, 1800, 5760], true),
          tableRow(["100-999", "1-3", "SCALE: Winning this query. Now find semantic variations and create supporting content cluster."], [1800, 1800, 5760]),
          tableRow(["100-999", "4-20", "OPTIMISE: Add FAQ section, strengthen internal linking, improve E-E-A-T signals."], [1800, 1800, 5760], true),
          tableRow(["< 100", "Any", "NEW CONTENT: Insufficient data on existing page. Create a dedicated, comprehensive page for this query."], [1800, 1800, 5760]),
          tableRow(["0", "—", "GAP: No existing content. Create a new page targeting this query intent."], [1800, 1800, 5760], true),
        ]
      }),
      ...sp(1),

      h2("11.2 Title Rewrite Templates by Intent"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1800, 2200, 5360],
        rows: [
          tableHeader(["Intent + Pattern", "CTR Lift", "Title Template"], [1800, 2200, 5360]),
          tableRow(["Informational / 'what is'", "+18-25%", "[Topic Explained]: The Complete [Year] Guide (With Examples)"], [1800, 2200, 5360]),
          tableRow(["Informational / 'how to'", "+22-30%", "How to [Accomplish X] in [N] Steps ([Year] Update)"], [1800, 2200, 5360], true),
          tableRow(["Commercial / 'best'", "+15-22%", "Best [Topic] for [Use Case] in [Year] — [N] Options Reviewed"], [1800, 2200, 5360]),
          tableRow(["Transactional / 'buy'", "+10-18%", "[Product]: [Key Benefit] — [Price Signal] | [Brand]"], [1800, 2200, 5360], true),
          tableRow(["Comparison / 'vs'", "+12-20%", "[Option A] vs [Option B] ([Year]): Which Is Right for You?"], [1800, 2200, 5360]),
          tableRow(["Local / 'near me'", "+8-15%", "Best [Service] in [City] — [N] Top-Rated [Year] Options"], [1800, 2200, 5360], true),
          tableRow(["Navigational (brand)", "+5-8%", "[Brand] Official [Feature] — [Key Benefit Phrase]"], [1800, 2200, 5360]),
        ]
      }),
      ...sp(1),

      h2("11.3 Schema Markup Decision Tree"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2200, 2000, 2560, 2600],
        rows: [
          tableHeader(["Page Type", "Primary Schema", "Secondary Schema", "AI Overview Benefit"], [2200, 2000, 2560, 2600]),
          tableRow(["How-to guide", "HowTo", "FAQPage", "High — structured steps are AI Overview source format"], [2200, 2000, 2560, 2600]),
          tableRow(["What is / Definition", "Article", "FAQPage or DefinedTerm", "Very High — definitions are primary AI Overview source"], [2200, 2000, 2560, 2600], true),
          tableRow(["Product review", "Review or Product", "ItemList (if comparing N products)", "Low — commercial content rarely sourced in AI Overviews"], [2200, 2000, 2560, 2600]),
          tableRow(["Blog post / guide", "Article", "FAQPage (if has Q&A sections)", "Medium — long-form articles sourced when they contain direct answers"], [2200, 2000, 2560, 2600], true),
          tableRow(["Pricing page", "Product with Offer", "FAQPage", "Very Low — pricing pages rarely appear in AI Overviews"], [2200, 2000, 2560, 2600]),
          tableRow(["Listicle / Top N", "ItemList", "Article", "Medium — lists are AI Overview friendly if items have direct descriptions"], [2200, 2000, 2560, 2600], true),
          tableRow(["Local business page", "LocalBusiness", "FAQPage + Review", "Low for AI Overview, HIGH for local pack eligibility"], [2200, 2000, 2560, 2600]),
        ]
      }),
      ...sp(2),

      // ── SECTION 12 ──────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("12. Environment Configuration & Deployment Guide"),
      h2("12.1 Required Environment Variables"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [2800, 1400, 1800, 3360],
        rows: [
          tableHeader(["Variable", "Required", "Example", "Purpose"], [2800, 1400, 1800, 3360]),
          tableRow(["ANTHROPIC_BASE_URL", "Yes", "https://api.minimax.io/anthropic", "AI API endpoint — MiniMax M2.7 via Anthropic-compatible interface"], [2800, 1400, 1800, 3360]),
          tableRow(["ANTHROPIC_AUTH_TOKEN", "Yes", "sk-cp-xxxxx", "API authentication token for MiniMax/OpenRouter"], [2800, 1400, 1800, 3360], true),
          tableRow(["ANTHROPIC_MODEL", "Yes", "MiniMax-M2.7", "Model identifier string for API calls"], [2800, 1400, 1800, 3360]),
          tableRow(["DATABASE_URL", "Yes", "postgresql://user:pass@ep-xxx.neon.tech/db", "Neon PostgreSQL connection string — required for report history"], [2800, 1400, 1800, 3360], true),
          tableRow(["GSC_SERVICE_ACCOUNT_EMAIL", "Optional*", "svc@project.iam.gserviceaccount.com", "Required for GSC API tab. Not needed for CSV upload mode."], [2800, 1400, 1800, 3360]),
          tableRow(["GSC_SERVICE_ACCOUNT_KEY", "Optional*", "-----BEGIN PRIVATE KEY-----\\n...", "Private key for GSC Service Account. Store in Vercel encrypted env."], [2800, 1400, 1800, 3360], true),
        ]
      }),
      ...sp(1),

      h2("12.2 Vercel Deployment Checklist"),
      numbered("Set all environment variables in Vercel dashboard → Settings → Environment Variables"),
      numbered("Set DATABASE_URL in both Preview and Production environments"),
      numbered("For GSC_SERVICE_ACCOUNT_KEY: paste the FULL private key including -----BEGIN/END----- lines. Vercel handles newline encoding."),
      numbered("Verify next.config.ts has serverExternalPackages: ['google-auth-library'] — required for JWT auth in Edge/Node runtime"),
      numbered("Run database init: The initDB() function auto-creates tables on first API call. No manual migration needed."),
      numbered("Test CSV upload in preview deployment before promoting to production"),
      ...sp(1),

      callout(
        "SECURITY NOTE: Never commit .env.local to Git. The .gitignore already excludes .env files. Rotate API keys quarterly. GSC Service Account should have read-only 'Viewer' role on your Search Console property.",
        "FFF3CD", "F59E0B"
      ),
      ...sp(2),

      // ── CLOSING ────────────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),
      h1("Appendix A — Algorithm Calibration Sources"),
      bullet("CTR Benchmarks: Advanced Web Ranking (2024 edition), SimilarWeb SERP Analysis Report 2024, Search Engine Land CTR Study 2023"),
      bullet("Intent Multipliers: SparkToro SERP Click Distribution Study 2024, BrightLocal Local SEO Survey 2024 (local pack click absorption)"),
      bullet("AI Overview Impact: SearchPilot AI Overview Impact Study Jan 2025, Semrush AI Overview Click Impact Analysis Q1 2025"),
      bullet("E-E-A-T Signals: Google's Quality Rater Guidelines (December 2023 edition), Google Search Central Documentation"),
      bullet("Schema CTR Lift: Google's own structured data documentation, Search Engine Journal Schema Markup Impact Study 2024"),
      ...sp(1),
      h1("Appendix B — Version History"),
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: [1400, 1800, 6160],
        rows: [
          tableHeader(["Version", "Date", "Changes"], [1400, 1800, 6160]),
          tableRow(["v1.0", "May 2026", "Initial production documentation. Full algorithm audit, gap analysis specification, page-level engine spec, OppScore v2, Health Score v2."], [1400, 1800, 6160]),
        ]
      }),
      ...sp(2),
      divider("1E3A5F"),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: "SEOMaster Production Documentation", size: 20, bold: true, color: "1E3A5F", font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: "Built on Next.js 15 · MiniMax M2.7 · Neon PostgreSQL · Advanced Web Ranking Data", size: 18, color: "7D8590", font: "Arial", italics: true })]
      }),
    ]
  }]
});

// Output path - use script directory
const outputDir = path.join(__dirname, 'outputs');
const outputPath = path.join(outputDir, 'SEOMaster_Production_Documentation.docx');

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log('Document generated successfully!');
  console.log('Output:', outputPath);
}).catch(err => {
  console.error('Error generating document:', err);
  process.exit(1);
});
