import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowRight, ArrowLeft, Check, Home, Zap, Car, Shield, Tv,
  Plus, Calendar, TrendingUp, PiggyBank, Sparkles, Target, LayoutDashboard,
  Bell, Edit3, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type Expense = { id: string; name: string; icon: any; amount: number; recurring: boolean };

const DEFAULT_EXPENSES: Expense[] = [
  { id: "1", name: "Rent", icon: Home, amount: 1200, recurring: true },
  { id: "2", name: "Utilities", icon: Zap, amount: 140, recurring: true },
  { id: "3", name: "Subscriptions", icon: Tv, amount: 45, recurring: true },
  { id: "4", name: "Insurance", icon: Shield, amount: 180, recurring: true },
  { id: "5", name: "Transportation", icon: Car, amount: 220, recurring: true },
];

const STEPS = 8;

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50/60 via-white to-white flex items-center justify-center p-4">
    <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-[92vh] rounded-[2rem] bg-white shadow-[0_30px_80px_-20px_rgba(16,185,129,0.25)] border border-emerald-100/60 overflow-hidden flex flex-col">
      {children}
    </div>
  </div>
);

const ProgressDots = ({ step }: { step: number }) => (
  <div className="flex items-center gap-1.5 px-6 pt-5">
    {Array.from({ length: STEPS }).map((_, i) => (
      <motion.div
        key={i}
        className="h-1 rounded-full bg-emerald-100 flex-1 overflow-hidden"
      >
        <motion.div
          initial={false}
          animate={{ width: i < step ? "100%" : i === step ? "60%" : "0%" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-emerald-500"
        />
      </motion.div>
    ))}
  </div>
);

const StepHeader = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) => (
  <div className="px-6 pt-5 pb-3">
    <p className="text-[11px] font-semibold tracking-wider text-emerald-600 uppercase">{eyebrow}</p>
    <h2 className="text-[22px] font-semibold text-slate-900 mt-1 leading-tight">{title}</h2>
    {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
  </div>
);

const NavBar = ({
  step, onBack, onNext, nextLabel = "Continue", disabled,
}: { step: number; onBack: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean }) => (
  <div className="px-6 pb-6 pt-3 flex items-center gap-3 border-t border-slate-100 bg-white">
    {step > 0 && (
      <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-500 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" />
      </Button>
    )}
    <Button
      onClick={onNext}
      disabled={disabled}
      className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-[0_8px_20px_-8px_rgba(16,185,129,0.6)]"
    >
      {nextLabel} <ArrowRight className="ml-1.5 w-4 h-4" />
    </Button>
  </div>
);

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 2 state
  const [income, setIncome] = useState(4500);
  const [frequency, setFrequency] = useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [payDate, setPayDate] = useState("5");

  // Step 3 state
  const [expenses, setExpenses] = useState<Expense[]>(DEFAULT_EXPENSES);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  // Step 4 state
  const [goal, setGoal] = useState(500);

  const remaining = income - totalExpenses;
  const safeSpend = Math.max(0, remaining - goal);
  const weeklyLimit = Math.max(0, safeSpend / 4);

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Shell>
      <ProgressDots step={step} />

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col overflow-y-auto"
          >
            {/* STEP 0 — Welcome */}
            {step === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-20 h-20 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(16,185,129,0.6)] mb-6"
                >
                  <Wallet className="w-10 h-10 text-white" />
                </motion.div>
                <motion.h1
                  initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="text-3xl font-bold text-slate-900 tracking-tight"
                >
                  Welcome to FinFlow
                </motion.h1>
                <motion.p
                  initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="text-slate-500 mt-3 max-w-xs"
                >
                  Let's set up your monthly financial flow.
                </motion.p>
              </div>
            )}

            {/* STEP 1 — Income */}
            {step === 1 && (
              <div className="flex-1 flex flex-col">
                <StepHeader eyebrow="Step 1 of 7" title="Monthly income" sub="Add your monthly income information." />
                <div className="px-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Monthly income</label>
                    <div className="relative mt-1.5">
                      <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="number"
                        value={income}
                        onChange={(e) => setIncome(Number(e.target.value) || 0)}
                        className="h-12 pl-9 text-lg font-semibold rounded-xl border-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Frequency</label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {(["weekly", "biweekly", "monthly"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFrequency(f)}
                          className={`h-10 rounded-xl text-xs font-medium capitalize transition-all ${
                            frequency === f
                              ? "bg-emerald-500 text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.7)]"
                              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Pay day</label>
                    <div className="relative mt-1.5">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        placeholder="Day of month"
                        className="h-12 pl-9 rounded-xl border-slate-200"
                      />
                    </div>
                  </div>

                  <motion.div
                    layout
                    className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                  >
                    <p className="text-[11px] uppercase tracking-wider text-emerald-100">Available balance</p>
                    <motion.p
                      key={income}
                      initial={{ scale: 0.95, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-bold mt-1"
                    >
                      {fmt(income)}
                    </motion.p>
                    <p className="text-xs text-emerald-100 mt-1 capitalize">{frequency} • day {payDate}</p>
                  </motion.div>
                </div>
              </div>
            )}

            {/* STEP 2 — Fixed expenses */}
            {step === 2 && (
              <div className="flex-1 flex flex-col">
                <StepHeader eyebrow="Step 2 of 7" title="Fixed expenses" sub="Add your recurring monthly expenses." />
                <div className="px-6 space-y-2">
                  {expenses.map((e) => {
                    const Icon = e.icon;
                    return (
                      <motion.div
                        layout
                        key={e.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70 border border-slate-100"
                      >
                        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{e.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Switch
                              checked={e.recurring}
                              onCheckedChange={(v) =>
                                setExpenses((p) => p.map((x) => x.id === e.id ? { ...x, recurring: v } : x))
                              }
                              className="scale-75 data-[state=checked]:bg-emerald-500"
                            />
                            <span className="text-[10px] text-slate-500">Recurring</span>
                          </div>
                        </div>
                        <Input
                          type="number"
                          value={e.amount}
                          onChange={(ev) =>
                            setExpenses((p) => p.map((x) => x.id === e.id ? { ...x, amount: Number(ev.target.value) || 0 } : x))
                          }
                          className="w-20 h-9 text-right text-sm font-semibold rounded-lg border-slate-200"
                        />
                      </motion.div>
                    );
                  })}
                  <button
                    onClick={() => setExpenses((p) => [...p, { id: crypto.randomUUID(), name: "New expense", icon: Plus, amount: 0, recurring: true }])}
                    className="w-full h-11 rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add expense
                  </button>

                  <div className="mt-3 flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Total / month</span>
                    <motion.span key={totalExpenses} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-xl font-bold">
                      {fmt(totalExpenses)}
                    </motion.span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Goal */}
            {step === 3 && (
              <div className="flex-1 flex flex-col">
                <StepHeader eyebrow="Step 3 of 7" title="End-of-month goal" sub="How much would you like remaining at the end of the month?" />
                <div className="px-6 space-y-5">
                  <div className="text-center py-4">
                    <motion.p key={goal} initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="text-5xl font-bold text-slate-900 tracking-tight">
                      {fmt(goal)}
                    </motion.p>
                    <p className="text-xs text-slate-500 mt-1">Protected balance</p>
                  </div>
                  <Slider
                    value={[goal]}
                    onValueChange={([v]) => setGoal(v)}
                    min={0}
                    max={Math.max(100, remaining)}
                    step={50}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>$0</span>
                    <span>{fmt(Math.max(100, remaining))}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-700">Safe to spend</p>
                      <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(safeSpend)}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Weekly limit</p>
                      <p className="text-lg font-bold text-slate-800 mt-1">{fmt(weeklyLimit)}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">Allocation</span>
                      <span className="text-xs font-medium text-slate-700">{Math.round((goal / Math.max(1, income)) * 100)}% protected</span>
                    </div>
                    <Progress value={(goal / Math.max(1, income)) * 100} className="h-2 bg-slate-100 [&>div]:bg-emerald-500" />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 — Auto organization */}
            {step === 4 && (
              <div className="flex-1 flex flex-col">
                <StepHeader eyebrow="Step 4 of 7" title="Automatic organization" sub="FinFlow organizes your month automatically." />
                <div className="px-6 space-y-3">
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const isBill = [4, 11, 14, 22].includes(i);
                      const isPay = i === 4;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.015 }}
                          className={`aspect-square rounded-md text-[9px] font-medium flex items-center justify-center ${
                            isPay
                              ? "bg-emerald-500 text-white"
                              : isBill
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          {i + 1}
                        </motion.div>
                      );
                    })}
                  </div>

                  {[
                    { label: "Weekly limit", value: fmt(weeklyLimit), icon: TrendingUp, color: "emerald" },
                    { label: "Bills separated", value: fmt(totalExpenses), icon: Calendar, color: "amber" },
                    { label: "Protected balance", value: fmt(goal), icon: Shield, color: "slate" },
                  ].map((c, i) => {
                    const Icon = c.icon;
                    return (
                      <motion.div
                        key={c.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          c.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                          c.color === "amber" ? "bg-amber-50 text-amber-600" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="flex-1 text-sm text-slate-700">{c.label}</span>
                        <span className="text-sm font-bold text-slate-900">{c.value}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 5 — Dashboard preview */}
            {step === 5 && (
              <div className="flex-1 flex flex-col">
                <StepHeader eyebrow="Step 5 of 7" title="Your dashboard" sub="A clear view of your monthly flow." />
                <div className="px-6 space-y-3">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white"
                  >
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">Current balance</p>
                    <p className="text-3xl font-bold mt-1">{fmt(remaining)}</p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-300">
                      <Shield className="w-3 h-3 text-emerald-400" />
                      {fmt(goal)} protected
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-2 gap-2">
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-3 rounded-2xl bg-emerald-50">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-700">Weekly</p>
                      <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(weeklyLimit)}</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-3 rounded-2xl bg-amber-50">
                      <p className="text-[10px] uppercase tracking-wider text-amber-700">Upcoming bills</p>
                      <p className="text-lg font-bold text-amber-700 mt-1">{fmt(totalExpenses)}</p>
                    </motion.div>
                  </div>

                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-3 rounded-2xl bg-white border border-slate-100 space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Categories</p>
                    {expenses.slice(0, 3).map((e) => {
                      const Icon = e.icon;
                      const pct = (e.amount / Math.max(1, totalExpenses)) * 100;
                      return (
                        <div key={e.id}>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-3 h-3 text-slate-500" />
                            <span className="text-xs text-slate-700 flex-1">{e.name}</span>
                            <span className="text-xs font-medium text-slate-900">{fmt(e.amount)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: 0.3 }}
                              className="h-full bg-emerald-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                </div>
              </div>
            )}

            {/* STEP 6 — Tutorial highlights */}
            {step === 6 && (
              <div className="flex-1 flex flex-col">
                <StepHeader eyebrow="Step 6 of 7" title="Quick tour" sub="Here's where everything lives." />
                <div className="px-6 space-y-2">
                  {[
                    { icon: Edit3, title: "Edit expenses", desc: "Tap any category card" },
                    { icon: DollarSign, title: "Update income", desc: "Top of dashboard" },
                    { icon: Target, title: "Track remaining", desc: "Always visible in header" },
                    { icon: Bell, title: "Upcoming payments", desc: "Calendar view" },
                  ].map((h, i) => {
                    const Icon = h.icon;
                    return (
                      <motion.div
                        key={h.title}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="relative flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100"
                      >
                        <div className="relative w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <Icon className="w-4 h-4" />
                          <motion.span
                            animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                            className="absolute inset-0 rounded-xl bg-emerald-400/40"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{h.title}</p>
                          <p className="text-xs text-slate-500">{h.desc}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 7 — Completion */}
            {step === 7 && (
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(16,185,129,0.6)] mb-6"
                >
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </motion.div>
                <motion.h2
                  initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold text-slate-900"
                >
                  You're ready to start using FinFlow.
                </motion.h2>
                <motion.p
                  initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-slate-500 mt-2"
                >
                  Your monthly flow is set up.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="w-full mt-8 space-y-2"
                >
                  <Button
                    onClick={() => navigate("/app")}
                    className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-1.5" /> Go to Dashboard
                  </Button>
                  <Button
                    onClick={() => navigate("/app")}
                    variant="ghost"
                    className="w-full h-11 text-slate-600"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" /> Start Planning
                  </Button>
                </motion.div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {step < STEPS - 1 && (
        <NavBar
          step={step}
          onBack={back}
          onNext={next}
          nextLabel={step === 0 ? "Start Setup" : "Continue"}
        />
      )}
    </Shell>
  );
};

export default Onboarding;
