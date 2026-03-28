import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  BarChart3,
  Clock,
  Copy,
  History,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PeriodResult {
  periodId: string;
  number: number;
  isBig: boolean;
  color: string[];
}

interface Prediction {
  isBig: boolean;
  predictedNumber: number;
  confidence: number;
  confidenceLabel: "HIGH" | "MEDIUM" | "LOW";
  signal: number; // 0-100
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPeriodId(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();
  const nnn = String(minuteOfDay).padStart(3, "0");
  return `${y}${m}${d}-${nnn}`;
}

function getSecondsRemaining(date: Date): number {
  return 59 - date.getUTCSeconds();
}

function getColors(num: number): string[] {
  if (num === 0) return ["Red", "Violet"];
  if (num === 5) return ["Green", "Violet"];
  if ([1, 3, 7, 9].includes(num)) return ["Green"];
  return ["Red"];
}

function randomNumber(): number {
  return Math.floor(Math.random() * 10);
}

function buildResult(periodId: string, num?: number): PeriodResult {
  const number = num !== undefined ? num : randomNumber();
  return {
    periodId,
    number,
    isBig: number >= 5,
    color: getColors(number),
  };
}

function subtractMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() - mins * 60 * 1000);
}

function seedHistory(currentDate: Date, count = 20): PeriodResult[] {
  return Array.from({ length: count }, (_, i) => {
    const d = subtractMinutes(currentDate, count - i);
    return buildResult(getPeriodId(d));
  });
}

function computePrediction(history: PeriodResult[]): Prediction {
  if (history.length === 0) {
    return {
      isBig: true,
      predictedNumber: 7,
      confidence: 50,
      confidenceLabel: "LOW",
      signal: 50,
    };
  }

  const recent = history.slice(-20);
  const last10 = history.slice(-10);

  // Weighted recent bias
  let score = 0;
  last10.forEach((r, idx) => {
    const weight = idx + 1; // more recent = higher weight
    score += r.isBig ? weight : -weight;
  });
  const maxScore = last10.reduce((acc, _, idx) => acc + idx + 1, 0);
  const normalizedScore = (score / maxScore + 1) / 2; // 0-1, >0.5 means BIG

  // Streak detection – if streak >= 3, predict reversal
  let streakLen = 0;
  const lastType = recent[recent.length - 1]?.isBig;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].isBig === lastType) streakLen++;
    else break;
  }

  let isBig = normalizedScore >= 0.5;
  let signal = Math.abs(normalizedScore - 0.5) * 2; // 0-1

  // Streak reversal nudge
  if (streakLen >= 4) {
    isBig = !lastType;
    signal = Math.min(1, signal + 0.2);
  }

  // Alternating pattern boost
  let alternating = 0;
  for (let i = recent.length - 1; i >= 1; i--) {
    if (recent[i].isBig !== recent[i - 1].isBig) alternating++;
    else break;
  }
  if (alternating >= 3) {
    isBig = !recent[recent.length - 1]?.isBig;
    signal = Math.min(1, signal + 0.15);
  }

  const signalPct = Math.round(50 + signal * 45);
  const confidence = signalPct;
  const confidenceLabel: "HIGH" | "MEDIUM" | "LOW" =
    confidence > 65 ? "HIGH" : confidence >= 55 ? "MEDIUM" : "LOW";

  // Pick a specific number matching BIG/SMALL
  const candidates = isBig ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  // Bias toward numbers that haven't appeared recently
  const recentNums = recent.slice(-5).map((r) => r.number);
  const preferred = candidates.filter((n) => !recentNums.includes(n));
  const pool = preferred.length > 0 ? preferred : candidates;
  const predictedNumber = pool[Math.floor(Math.random() * pool.length)];

  return {
    isBig,
    predictedNumber,
    confidence,
    confidenceLabel,
    signal: signalPct,
  };
}

// ─── Color Helpers ─────────────────────────────────────────────────────────────
function colorDot(colors: string[]) {
  if (colors.includes("Violet")) {
    return (
      <span className="flex gap-0.5 items-center">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ background: "oklch(0.62 0.22 27)" }}
        />
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ background: "oklch(0.55 0.22 290)" }}
        />
      </span>
    );
  }
  const isGreen = colors.includes("Green");
  return (
    <span
      className="inline-block w-3 h-3 rounded-full"
      style={{
        background: isGreen ? "oklch(0.82 0.18 155)" : "oklch(0.62 0.22 27)",
      }}
    />
  );
}

function ColorLabel({ colors }: { colors: string[] }) {
  if (colors.length === 1) {
    const isGreen = colors[0] === "Green";
    return (
      <span
        className="text-xs font-bold uppercase"
        style={{
          color: isGreen ? "oklch(0.82 0.18 155)" : "oklch(0.62 0.22 27)",
        }}
      >
        {colors[0]}
      </span>
    );
  }
  return (
    <span
      className="text-xs font-bold uppercase"
      style={{ color: "oklch(0.55 0.22 290)" }}
    >
      {colors.join("+")}
    </span>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [history, setHistory] = useState<PeriodResult[]>(() =>
    seedHistory(now),
  );
  const [currentPeriodId, setCurrentPeriodId] = useState(() =>
    getPeriodId(now),
  );
  const [secondsLeft, setSecondsLeft] = useState(() =>
    getSecondsRemaining(now),
  );
  const [prediction, setPrediction] = useState<Prediction>(() =>
    computePrediction(seedHistory(now)),
  );
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "analysis" | "history" | "guide"
  >("dashboard");
  const [justFlipped, setJustFlipped] = useState(false);
  const prevPeriodRef = useRef(currentPeriodId);

  const advance = useCallback(
    (hist: PeriodResult[], completedPeriodId: string) => {
      const result = buildResult(completedPeriodId);
      const newHist = [...hist, result].slice(-40);
      const newDate = new Date();
      const newPeriodId = getPeriodId(newDate);
      const newPrediction = computePrediction(newHist);
      setHistory(newHist);
      setCurrentPeriodId(newPeriodId);
      setPrediction(newPrediction);
      setJustFlipped(true);
      setTimeout(() => setJustFlipped(false), 400);
      toast(
        <span>
          Period <strong>{completedPeriodId}</strong> → Number{" "}
          <strong style={{ color: "oklch(0.82 0.18 155)" }}>
            {result.number}
          </strong>{" "}
          ({result.isBig ? "BIG" : "SMALL"})
        </span>,
        { duration: 3000 },
      );
      return newHist;
    },
    [],
  );

  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    const tick = setInterval(() => {
      const d = new Date();
      const secs = getSecondsRemaining(d);
      const pid = getPeriodId(d);
      setSecondsLeft(secs);
      if (pid !== prevPeriodRef.current) {
        advance(historyRef.current, prevPeriodRef.current);
        prevPeriodRef.current = pid;
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [advance]);

  // Stats
  const last20 = history.slice(-20);
  const bigCount = last20.filter((r) => r.isBig).length;
  const smallCount = last20.length - bigCount;
  const bigPct = last20.length
    ? Math.round((bigCount / last20.length) * 100)
    : 50;
  const smallPct = 100 - bigPct;

  const timerColor =
    secondsLeft <= 10
      ? "text-glow-red" // danger
      : secondsLeft <= 20
        ? "text-glow-gold"
        : "text-glow-green";

  const timerStyle = {
    color:
      secondsLeft <= 10
        ? "oklch(0.62 0.22 27)"
        : secondsLeft <= 20
          ? "oklch(0.76 0.10 75)"
          : "oklch(0.82 0.18 155)",
  };

  return (
    <div
      className="min-h-screen grid-overlay"
      style={{
        background:
          "linear-gradient(160deg, oklch(0.12 0.028 243) 0%, oklch(0.14 0.032 237) 100%)",
      }}
    >
      <Toaster position="bottom-right" />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b border-border backdrop-blur-md"
        style={{ background: "oklch(0.12 0.028 243 / 0.85)" }}
      >
        <div className="max-w-[1100px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center glow-green"
              style={{
                background: "oklch(0.82 0.18 155 / 0.15)",
                border: "1px solid oklch(0.82 0.18 155 / 0.5)",
              }}
            >
              <span
                className="font-bold text-sm"
                style={{ color: "oklch(0.82 0.18 155)" }}
              >
                W
              </span>
            </div>
            <span
              className="font-bold text-lg tracking-tight"
              style={{ color: "oklch(0.96 0.015 243)" }}
            >
              Win<span style={{ color: "oklch(0.82 0.18 155)" }}>Go</span>
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-bold"
              style={{
                background: "oklch(0.82 0.18 155 / 0.15)",
                color: "oklch(0.82 0.18 155)",
                border: "1px solid oklch(0.82 0.18 155 / 0.3)",
              }}
            >
              1 MIN
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {(["dashboard", "analysis", "history", "guide"] as const).map(
              (tab) => (
                <button
                  type="button"
                  key={tab}
                  data-ocid={`nav.${tab}.link`}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-all"
                  style={{
                    color:
                      activeTab === tab
                        ? "oklch(0.82 0.18 155)"
                        : "oklch(0.67 0.04 220)",
                    background:
                      activeTab === tab
                        ? "oklch(0.82 0.18 155 / 0.12)"
                        : "transparent",
                    border:
                      activeTab === tab
                        ? "1px solid oklch(0.82 0.18 155 / 0.3)"
                        : "1px solid transparent",
                  }}
                >
                  {tab}
                </button>
              ),
            )}
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-ocid="auth.login.button"
              className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:opacity-80"
              style={{
                color: "oklch(0.96 0.015 243)",
                border: "1px solid oklch(0.26 0.03 240)",
              }}
            >
              Login
            </button>
            <button
              type="button"
              data-ocid="auth.register.button"
              className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:opacity-80 glow-green"
              style={{
                background: "oklch(0.82 0.18 155)",
                color: "oklch(0.10 0.02 155)",
              }}
            >
              Register
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <main className="max-w-[1100px] mx-auto px-4 py-8 space-y-6">
        {/* ── PREDICTION PANEL ─────────────────────────────────────────── */}
        <section
          data-ocid="prediction.panel"
          className="rounded-xl border overflow-hidden shadow-card"
          style={{
            background: "oklch(0.17 0.032 240)",
            borderColor: "oklch(0.26 0.03 240)",
          }}
        >
          {/* Panel header */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{
              borderColor: "oklch(0.26 0.03 240)",
              background: "oklch(0.15 0.03 240)",
            }}
          >
            <div className="flex items-center gap-3">
              <Activity
                className="w-4 h-4"
                style={{ color: "oklch(0.82 0.18 155)" }}
              />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "oklch(0.67 0.04 220)" }}
              >
                Current Period & Prediction
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs"
                style={{ color: "oklch(0.67 0.04 220)" }}
              >
                Period
              </span>
              <span
                className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                style={{
                  background: "oklch(0.82 0.18 155 / 0.12)",
                  color: "oklch(0.82 0.18 155)",
                  border: "1px solid oklch(0.82 0.18 155 / 0.3)",
                }}
              >
                {currentPeriodId}
              </span>
            </div>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            {/* Left: Countdown */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock
                  className="w-4 h-4"
                  style={{ color: "oklch(0.67 0.04 220)" }}
                />
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "oklch(0.67 0.04 220)" }}
                >
                  Time Remaining
                </span>
              </div>
              <div
                key={secondsLeft}
                className={`font-black tabular-nums leading-none number-flip ${timerColor}`}
                style={{
                  ...timerStyle,
                  fontSize: "88px",
                  fontFamily: "'Bricolage Grotesque', monospace",
                }}
                data-ocid="timer.display"
              >
                {String(secondsLeft).padStart(2, "0")}
              </div>
              <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "oklch(0.67 0.04 220)" }}
              >
                seconds
              </span>

              {/* Progress arc */}
              <div className="w-full mt-2">
                <div
                  className="w-full h-2 rounded-full"
                  style={{ background: "oklch(0.20 0.025 240)" }}
                >
                  <div
                    className="h-2 rounded-full transition-all duration-1000"
                    style={{
                      width: `${((59 - secondsLeft) / 59) * 100}%`,
                      background: timerStyle.color,
                      boxShadow: `0 0 8px ${timerStyle.color}`,
                    }}
                  />
                </div>
              </div>
              <span
                className="text-xs"
                style={{ color: "oklch(0.67 0.04 220)" }}
              >
                Real-time countdown • 1-minute period
              </span>
            </div>

            {/* Right: Prediction */}
            <div className="flex flex-col gap-4">
              <div
                className="rounded-xl p-5 border glow-green flex flex-col gap-3"
                style={{
                  background: "oklch(0.14 0.032 243)",
                  borderColor: "oklch(0.82 0.18 155 / 0.3)",
                }}
                data-ocid="prediction.card"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "oklch(0.67 0.04 220)" }}
                  >
                    AI Prediction
                  </span>
                  <Badge
                    className="text-xs font-bold uppercase"
                    style={{
                      background:
                        prediction.confidenceLabel === "HIGH"
                          ? "oklch(0.82 0.18 155 / 0.2)"
                          : prediction.confidenceLabel === "MEDIUM"
                            ? "oklch(0.76 0.10 75 / 0.2)"
                            : "oklch(0.62 0.22 27 / 0.2)",
                      color:
                        prediction.confidenceLabel === "HIGH"
                          ? "oklch(0.82 0.18 155)"
                          : prediction.confidenceLabel === "MEDIUM"
                            ? "oklch(0.76 0.10 75)"
                            : "oklch(0.62 0.22 27)",
                      border: `1px solid ${
                        prediction.confidenceLabel === "HIGH"
                          ? "oklch(0.82 0.18 155 / 0.4)"
                          : prediction.confidenceLabel === "MEDIUM"
                            ? "oklch(0.76 0.10 75 / 0.4)"
                            : "oklch(0.62 0.22 27 / 0.4)"
                      }`,
                    }}
                    data-ocid="prediction.confidence.badge"
                  >
                    {prediction.confidenceLabel} CONFIDENCE
                  </Badge>
                </div>

                <div className="flex items-end gap-4">
                  <div>
                    <div
                      className={`font-black leading-none text-glow-green ${justFlipped ? "number-flip" : ""}`}
                      style={{
                        fontSize: "52px",
                        color: "oklch(0.82 0.18 155)",
                      }}
                      data-ocid="prediction.bigsmall"
                    >
                      {prediction.isBig ? "BIG" : "SMALL"}
                    </div>
                    <div
                      className="text-xs uppercase tracking-widest mt-1"
                      style={{ color: "oklch(0.67 0.04 220)" }}
                    >
                      {prediction.isBig ? "Number ≥ 5" : "Number ≤ 4"}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div
                      className="text-xs uppercase tracking-widest mb-1"
                      style={{ color: "oklch(0.67 0.04 220)" }}
                    >
                      Predicted #
                    </div>
                    <div
                      className="font-black leading-none text-glow-gold"
                      style={{ fontSize: "52px", color: "oklch(0.76 0.10 75)" }}
                      data-ocid="prediction.number"
                    >
                      {prediction.predictedNumber}
                    </div>
                  </div>
                </div>

                {/* Confidence meter */}
                <div className="space-y-1.5">
                  <div
                    className="flex justify-between text-xs"
                    style={{ color: "oklch(0.67 0.04 220)" }}
                  >
                    <span>Signal Strength</span>
                    <span style={{ color: "oklch(0.82 0.18 155)" }}>
                      {prediction.signal}%
                    </span>
                  </div>
                  <div
                    className="flex gap-1"
                    data-ocid="prediction.confidence.meter"
                  >
                    {[
                      "s0",
                      "s1",
                      "s2",
                      "s3",
                      "s4",
                      "s5",
                      "s6",
                      "s7",
                      "s8",
                      "s9",
                    ].map((sid, i) => (
                      <div
                        key={sid}
                        className="flex-1 h-2 rounded-sm transition-all duration-500"
                        style={{
                          background:
                            i < Math.round(prediction.signal / 10)
                              ? prediction.confidenceLabel === "HIGH"
                                ? "oklch(0.82 0.18 155)"
                                : prediction.confidenceLabel === "MEDIUM"
                                  ? "oklch(0.76 0.10 75)"
                                  : "oklch(0.62 0.22 27)"
                              : "oklch(0.20 0.025 240)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-ocid="prediction.copy.button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `Period: ${currentPeriodId} | Prediction: ${prediction.isBig ? "BIG" : "SMALL"} | Number: ${prediction.predictedNumber} | Confidence: ${prediction.confidenceLabel}`,
                  );
                  toast.success("Prediction copied to clipboard!");
                }}
                className="w-full py-3 rounded-lg font-bold uppercase tracking-widest text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2"
                style={{
                  background: "transparent",
                  color: "oklch(0.76 0.10 75)",
                  border: "1.5px solid oklch(0.76 0.10 75)",
                  boxShadow: "0 0 12px oklch(0.76 0.10 75 / 0.2)",
                }}
              >
                <Copy className="w-4 h-4" />
                Copy Prediction
              </button>
            </div>
          </div>

          {/* Period Tracker strip */}
          <div className="px-6 pb-5">
            <div
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: "oklch(0.67 0.04 220)" }}
            >
              Period Tracker
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              data-ocid="period.tracker.list"
            >
              {history.slice(-10).map((r, idx) => (
                <div
                  key={r.periodId}
                  data-ocid={`period.tracker.item.${idx + 1}`}
                  className="shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all"
                  style={{
                    background: "oklch(0.14 0.032 243)",
                    borderColor: r.isBig
                      ? "oklch(0.82 0.18 155 / 0.3)"
                      : "oklch(0.62 0.22 27 / 0.3)",
                    minWidth: "52px",
                  }}
                >
                  <span
                    className="font-black text-lg leading-none"
                    style={{
                      color: r.isBig
                        ? "oklch(0.82 0.18 155)"
                        : "oklch(0.62 0.22 27)",
                    }}
                  >
                    {r.number}
                  </span>
                  <span
                    className="text-xs font-bold uppercase"
                    style={{
                      color: r.isBig
                        ? "oklch(0.82 0.18 155)"
                        : "oklch(0.62 0.22 27)",
                    }}
                  >
                    {r.isBig ? "B" : "S"}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "oklch(0.67 0.04 220)", fontSize: "9px" }}
                  >
                    {r.periodId.split("-")[1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ANALYSIS ROW ─────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Results History */}
          <section
            data-ocid="history.panel"
            className="rounded-xl border overflow-hidden shadow-card"
            style={{
              background: "oklch(0.17 0.032 240)",
              borderColor: "oklch(0.26 0.03 240)",
            }}
          >
            <div
              className="px-5 py-4 border-b flex items-center gap-2"
              style={{
                borderColor: "oklch(0.26 0.03 240)",
                background: "oklch(0.15 0.03 240)",
              }}
            >
              <History
                className="w-4 h-4"
                style={{ color: "oklch(0.76 0.10 75)" }}
              />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "oklch(0.67 0.04 220)" }}
              >
                Recent Results History
              </span>
            </div>
            <div className="overflow-auto" style={{ maxHeight: "340px" }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: "oklch(0.26 0.03 240)" }}>
                    {["Period", "#", "Type", "Color"].map((h) => (
                      <TableHead
                        key={h}
                        className="text-xs uppercase tracking-wide"
                        style={{ color: "oklch(0.67 0.04 220)" }}
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...history]
                    .reverse()
                    .slice(0, 20)
                    .map((r, idx) => (
                      <TableRow
                        key={r.periodId}
                        data-ocid={`history.item.${idx + 1}`}
                        style={{ borderColor: "oklch(0.26 0.03 240 / 0.5)" }}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <TableCell
                          className="font-mono text-xs"
                          style={{ color: "oklch(0.67 0.04 220)" }}
                        >
                          {r.periodId}
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-black text-base"
                            style={{
                              color: r.isBig
                                ? "oklch(0.82 0.18 155)"
                                : "oklch(0.62 0.22 27)",
                            }}
                          >
                            {r.number}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                            style={{
                              background: r.isBig
                                ? "oklch(0.82 0.18 155 / 0.15)"
                                : "oklch(0.62 0.22 27 / 0.15)",
                              color: r.isBig
                                ? "oklch(0.82 0.18 155)"
                                : "oklch(0.62 0.22 27)",
                            }}
                          >
                            {r.isBig ? "BIG" : "SMALL"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {colorDot(r.color)}
                            <ColorLabel colors={r.color} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* BIG/SMALL Analysis */}
          <section
            data-ocid="analysis.panel"
            className="rounded-xl border overflow-hidden shadow-card"
            style={{
              background: "oklch(0.17 0.032 240)",
              borderColor: "oklch(0.26 0.03 240)",
            }}
          >
            <div
              className="px-5 py-4 border-b flex items-center gap-2"
              style={{
                borderColor: "oklch(0.26 0.03 240)",
                background: "oklch(0.15 0.03 240)",
              }}
            >
              <BarChart3
                className="w-4 h-4"
                style={{ color: "oklch(0.82 0.18 155)" }}
              />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "oklch(0.67 0.04 220)" }}
              >
                BIG / SMALL Analysis
              </span>
              <span
                className="ml-auto text-xs"
                style={{ color: "oklch(0.67 0.04 220)" }}
              >
                Last {last20.length} periods
              </span>
            </div>
            <div className="p-6 space-y-6">
              {/* BIG bar */}
              <div className="space-y-2" data-ocid="analysis.big.section">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className="w-4 h-4"
                      style={{ color: "oklch(0.82 0.18 155)" }}
                    />
                    <span
                      className="font-bold uppercase tracking-widest text-sm"
                      style={{ color: "oklch(0.82 0.18 155)" }}
                    >
                      BIG
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "oklch(0.67 0.04 220)" }}
                    >
                      (≥ 5)
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className="font-black text-2xl"
                      style={{ color: "oklch(0.82 0.18 155)" }}
                    >
                      {bigPct}%
                    </span>
                    <span
                      className="text-xs ml-1"
                      style={{ color: "oklch(0.67 0.04 220)" }}
                    >
                      {bigCount}/{last20.length}
                    </span>
                  </div>
                </div>
                <div
                  className="h-4 rounded-full overflow-hidden"
                  style={{ background: "oklch(0.20 0.025 240)" }}
                >
                  <div
                    className="h-4 rounded-full transition-all duration-700"
                    style={{
                      width: `${bigPct}%`,
                      background:
                        "linear-gradient(90deg, oklch(0.82 0.18 155), oklch(0.72 0.15 155))",
                      boxShadow: "0 0 8px oklch(0.82 0.18 155 / 0.5)",
                    }}
                    data-ocid="analysis.big.progress"
                  />
                </div>
              </div>

              {/* SMALL bar */}
              <div className="space-y-2" data-ocid="analysis.small.section">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className="w-4 h-4 rotate-180"
                      style={{ color: "oklch(0.62 0.22 27)" }}
                    />
                    <span
                      className="font-bold uppercase tracking-widest text-sm"
                      style={{ color: "oklch(0.62 0.22 27)" }}
                    >
                      SMALL
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "oklch(0.67 0.04 220)" }}
                    >
                      (≤ 4)
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className="font-black text-2xl"
                      style={{ color: "oklch(0.62 0.22 27)" }}
                    >
                      {smallPct}%
                    </span>
                    <span
                      className="text-xs ml-1"
                      style={{ color: "oklch(0.67 0.04 220)" }}
                    >
                      {smallCount}/{last20.length}
                    </span>
                  </div>
                </div>
                <div
                  className="h-4 rounded-full overflow-hidden"
                  style={{ background: "oklch(0.20 0.025 240)" }}
                >
                  <div
                    className="h-4 rounded-full transition-all duration-700"
                    style={{
                      width: `${smallPct}%`,
                      background:
                        "linear-gradient(90deg, oklch(0.62 0.22 27), oklch(0.52 0.18 27))",
                      boxShadow: "0 0 8px oklch(0.62 0.22 27 / 0.5)",
                    }}
                    data-ocid="analysis.small.progress"
                  />
                </div>
              </div>

              {/* Divider */}
              <div
                className="border-t"
                style={{ borderColor: "oklch(0.26 0.03 240)" }}
              />

              {/* Pattern analysis */}
              <div className="space-y-3">
                <div
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "oklch(0.67 0.04 220)" }}
                >
                  Last 10 Pattern
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {history.slice(-10).map((r, idx) => (
                    <div
                      key={r.periodId}
                      data-ocid={`pattern.item.${idx + 1}`}
                      className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs"
                      style={{
                        background: r.isBig
                          ? "oklch(0.82 0.18 155 / 0.15)"
                          : "oklch(0.62 0.22 27 / 0.15)",
                        color: r.isBig
                          ? "oklch(0.82 0.18 155)"
                          : "oklch(0.62 0.22 27)",
                        border: `1px solid ${r.isBig ? "oklch(0.82 0.18 155 / 0.3)" : "oklch(0.62 0.22 27 / 0.3)"}`,
                      }}
                    >
                      {r.isBig ? "B" : "S"}
                    </div>
                  ))}
                </div>
              </div>

              {/* Streak info */}
              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  let streak = 1;
                  const last = history[history.length - 1];
                  for (let i = history.length - 2; i >= 0; i--) {
                    if (history[i].isBig === last?.isBig) streak++;
                    else break;
                  }
                  return (
                    <>
                      <div
                        className="rounded-lg p-3 text-center"
                        style={{
                          background: "oklch(0.14 0.032 243)",
                          border: "1px solid oklch(0.26 0.03 240)",
                        }}
                      >
                        <div
                          className="text-xs uppercase tracking-wide mb-1"
                          style={{ color: "oklch(0.67 0.04 220)" }}
                        >
                          Current Streak
                        </div>
                        <div
                          className="font-black text-2xl"
                          style={{
                            color: last?.isBig
                              ? "oklch(0.82 0.18 155)"
                              : "oklch(0.62 0.22 27)",
                          }}
                        >
                          {streak}×
                        </div>
                        <div
                          className="text-xs font-bold uppercase"
                          style={{
                            color: last?.isBig
                              ? "oklch(0.82 0.18 155)"
                              : "oklch(0.62 0.22 27)",
                          }}
                        >
                          {last?.isBig ? "BIG" : "SMALL"}
                        </div>
                      </div>
                      <div
                        className="rounded-lg p-3 text-center"
                        style={{
                          background: "oklch(0.14 0.032 243)",
                          border: "1px solid oklch(0.26 0.03 240)",
                        }}
                      >
                        <div
                          className="text-xs uppercase tracking-wide mb-1"
                          style={{ color: "oklch(0.67 0.04 220)" }}
                        >
                          Next Signal
                        </div>
                        <div
                          className="font-black text-2xl"
                          style={{
                            color: prediction.isBig
                              ? "oklch(0.82 0.18 155)"
                              : "oklch(0.62 0.22 27)",
                          }}
                        >
                          {prediction.isBig ? "↑" : "↓"}
                        </div>
                        <div
                          className="text-xs font-bold uppercase"
                          style={{
                            color: prediction.isBig
                              ? "oklch(0.82 0.18 155)"
                              : "oklch(0.62 0.22 27)",
                          }}
                        >
                          {prediction.isBig ? "BIG" : "SMALL"}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </section>
        </div>

        {/* ── COLOR GUIDE ──────────────────────────────────────────────── */}
        <section
          data-ocid="guide.panel"
          className="rounded-xl border p-5"
          style={{
            background: "oklch(0.17 0.032 240)",
            borderColor: "oklch(0.26 0.03 240)",
          }}
        >
          <div
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "oklch(0.67 0.04 220)" }}
          >
            Color & Number Guide
          </div>
          <div className="flex flex-wrap gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const colors = getColors(n);
              const isBig = n >= 5;
              return (
                <div
                  key={n}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border"
                  style={{
                    background: "oklch(0.14 0.032 243)",
                    borderColor: isBig
                      ? "oklch(0.82 0.18 155 / 0.2)"
                      : "oklch(0.62 0.22 27 / 0.2)",
                    minWidth: "58px",
                  }}
                >
                  <span
                    className="font-black text-xl leading-none"
                    style={{
                      color: isBig
                        ? "oklch(0.82 0.18 155)"
                        : "oklch(0.62 0.22 27)",
                    }}
                  >
                    {n}
                  </span>
                  <span
                    className="text-xs font-bold uppercase"
                    style={{
                      color: isBig
                        ? "oklch(0.82 0.18 155)"
                        : "oklch(0.62 0.22 27)",
                    }}
                  >
                    {isBig ? "BIG" : "SML"}
                  </span>
                  <div className="flex gap-0.5">{colorDot(colors)}</div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer
        className="border-t mt-8 py-6"
        style={{ borderColor: "oklch(0.26 0.03 240)" }}
      >
        <div className="max-w-[1100px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs" style={{ color: "oklch(0.67 0.04 220)" }}>
            ⚠️ For entertainment purposes only. Not financial advice. Results are
            simulated.
          </p>
          <p className="text-xs" style={{ color: "oklch(0.50 0.03 240)" }}>
            © {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "oklch(0.82 0.18 155)" }}
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
