import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowRight, ArrowLeft, Check, Plus, PiggyBank,
  TrendingUp, ShoppingBag, Home, Sparkles, Target, BarChart3,
  Trophy, LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const TOTAL_STEPS = 8;

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50/60 via-white to-white flex items-center justify-center p-4">
    <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-[92vh] rounded-[2rem] bg-white shadow-[0_30px_80px_-20px_rgba(16,185,129,0.25)] border border-emerald-100/60 overflow-hidden flex flex-col">
      {children}
    </div>
  </div>
);

const ProgressBar = ({ step }: { step: number }) => (
  <div className="flex items-center gap-1.5 px-6 pt-5">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <div key={i} className="h-1 rounded-full bg-emerald-100 flex-1 overflow-hidden">
        <motion.div
          initial={false}
          animate={{ width: i < step ? "100%" : i === step ? "55%" : "0%" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-emerald-500"
        />
      </div>
    ))}
  </div>
);

const slideVariants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit:   { opacity: 0, x: -24 },
};

const Onboarding = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [income, setIncome] = useState(4000);
  const [split, setSplit] = useState({ ess: 50, want: 30, save: 20 });
  const [targetValue, setTargetValue] = useState(50000);

  const essLimit  = (income * split.ess) / 100;
  const wantLimit = (income * split.want) / 100;
  const saveLimit = (income * split.save) / 100;
  const totalSpent = essLimit + wantLimit;
  const moneyLeft = income - totalSpent; // equals saveLimit by definition

  // Auto-normalize so ess+want+save always = 100
  const updateSplit = (key: "ess" | "want" | "save", v: number) => {
    setSplit((p) => {
      const others = (["ess", "want", "save"] as const).filter((k) => k !== key);
      const remaining = 100 - v;
      const otherSum = p[others[0]] + p[others[1]];
      let a: number, b: number;
      if (otherSum === 0) { a = Math.round(remaining / 2); b = remaining - a; }
      else {
        a = Math.round((p[others[0]] / otherSum) * remaining);
        b = remaining - a;
      }
      return { ...p, [key]: v, [others[0]]: a, [others[1]]: b } as typeof p;
    });
  };

  // Auto-increasing reserve goal milestones
  const GOAL_MILESTONES = [1000, 3000, 5000, 10000, 20000, 50000, 100000];

  // Inverted projection: given a target value, how many years to reach it?
  const yearsToTarget = useMemo(() => {
    const r = 0.006; // ~7.4% a.a.
    if (saveLimit <= 0 || targetValue <= 0) return Infinity;
    const ratio = 1 + (targetValue * r) / saveLimit;
    const months = Math.log(ratio) / Math.log(1 + r);
    return months / 12;
  }, [saveLimit, targetValue]);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const finish = () => navigate("/app");

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5">
        <button
          onClick={back}
          disabled={step === 0}
          className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-700 disabled:opacity-0 hover:bg-emerald-50 transition"
          aria-label={t("Voltar")}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-[11px] font-medium text-emerald-700/70">
          {step + 1} / {TOTAL_STEPS}
        </div>
        <div className="scale-90 origin-right"><LanguageSwitcher /></div>
      </div>

      <ProgressBar step={step} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            {step === 0 && (
              <div className="flex flex-col items-center text-center pt-10">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 180, damping: 14 }}
                  className="w-20 h-20 rounded-3xl bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-200 mb-6"
                >
                  <Wallet className="w-10 h-10" />
                </motion.div>
                <h1 className="text-2xl font-bold text-emerald-950">
                  {t("Bem-vindo ao FinFlow")}
                </h1>
                <p className="text-sm text-emerald-900/60 mt-3 max-w-[280px] leading-relaxed">
                  {t("Em poucos passos você aprende como acompanhar o quanto sobra no seu mês.")}
                </p>
                <div className="mt-8 grid gap-2 w-full text-left">
                  {[
                    { icon: TrendingUp, label: t("Cadastre sua renda") },
                    { icon: BarChart3,  label: t("Defina seu orçamento") },
                    { icon: Sparkles,   label: t("Acompanhe o que sobra") },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-600">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm text-emerald-950 font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-emerald-950">{t("Qual é sua renda mensal?")}</h2>
                <p className="text-sm text-emerald-900/60 mt-2">
                  {t("Some todas as suas fontes de renda do mês.")}
                </p>

                <div className="mt-8 p-5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <p className="text-xs uppercase tracking-wide text-emerald-700/70 font-semibold">
                    {t("Renda mensal")}
                  </p>
                  <motion.p
                    key={income}
                    initial={{ scale: 0.95, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl font-bold text-emerald-950 mt-2"
                  >
                    {fmt(income)}
                  </motion.p>
                  <Slider
                    className="mt-5"
                    value={[income]}
                    onValueChange={([v]) => setIncome(v)}
                    min={500} max={20000} step={100}
                  />
                  <div className="flex justify-between text-[11px] text-emerald-700/60 mt-2">
                    <span>$500</span><span>$20.000</span>
                  </div>
                </div>

                <p className="text-xs text-emerald-900/50 mt-5 leading-relaxed">
                  {t("No app você pode cadastrar várias fontes (salário, freelas, etc.) com frequências diferentes.")}
                </p>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold text-emerald-950">{t("Divida seu orçamento")}</h2>
                <p className="text-sm text-emerald-900/60 mt-2">
                  {t("FinFlow usa a regra 50-30-20. Você pode ajustar quando quiser.")}
                </p>

                <div className="mt-6 space-y-4">
                  {[
                    { key: "ess",  label: t("Essenciais"),       color: "bg-emerald-500", value: split.ess,  limit: essLimit },
                    { key: "want", label: t("Desejos"),          color: "bg-amber-400",   value: split.want, limit: wantLimit },
                    { key: "save", label: t("Reserva / Investimentos"), color: "bg-sky-500", value: split.save, limit: saveLimit },
                  ].map((row) => (
                    <div key={row.key} className="p-4 rounded-2xl bg-white border border-emerald-100/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${row.color}`} />
                          <span className="text-sm font-medium text-emerald-950">{row.label}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-emerald-950">{row.value}%</p>
                          <p className="text-[11px] text-emerald-700/60">{fmt(row.limit)}</p>
                        </div>
                      </div>
                      <Slider
                        className="mt-3"
                        value={[row.value]}
                        onValueChange={([v]) =>
                          updateSplit(row.key as "ess" | "want" | "save", v)
                        }
                        min={0} max={100} step={1}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-emerald-700/70 font-medium">
                    {t("Total:")} <span className="text-emerald-950 font-bold">{split.ess + split.want + split.save}%</span>
                  </span>
                  <span className="text-emerald-700/60">{t("Sempre 100%")}</span>
                </div>

                <div className="mt-4 h-2 rounded-full overflow-hidden flex bg-emerald-50">
                  <motion.div animate={{ width: `${split.ess}%` }}  className="bg-emerald-500" />
                  <motion.div animate={{ width: `${split.want}%` }} className="bg-amber-400" />
                  <motion.div animate={{ width: `${split.save}%` }} className="bg-sky-500" />
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold text-emerald-950">{t("Suponha que você gastou conforme planejou")}</h2>
                <p className="text-sm text-emerald-900/60 mt-2">
                  {t("Cada categoria foi usada exatamente até o limite. Veja o que acontece.")}
                </p>

                <div className="mt-5 space-y-2.5">
                  {[
                    { label: t("Essenciais"), used: essLimit,  limit: essLimit,  color: "bg-emerald-500" },
                    { label: t("Desejos"),    used: wantLimit, limit: wantLimit, color: "bg-amber-400" },
                  ].map((c, idx) => (
                    <div key={c.label} className="p-3 rounded-xl bg-white border border-emerald-100">
                      <div className="flex justify-between text-xs text-emerald-900 mb-1.5">
                        <span className="font-medium">{c.label}</span>
                        <span className="text-emerald-700/70">{fmt(c.used)} / {fmt(c.limit)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-emerald-50 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: idx * 0.2 }}
                          className={`h-full ${c.color}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200"
                >
                  <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">
                    {t("Sobrou no fim do mês")}
                  </p>
                  <p className="text-4xl font-bold mt-1">{fmt(moneyLeft)}</p>
                  <div className="flex justify-between mt-3 text-xs opacity-90">
                    <span>{t("Renda:")} {fmt(income)}</span>
                    <span>{t("Gastos:")} {fmt(totalSpent)}</span>
                  </div>
                </motion.div>

                <p className="text-xs text-emerald-900/60 mt-4 leading-relaxed">
                  {t("Esse valor que sobra vai direto para sua reserva e investimentos.")}
                </p>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-200">
                    <PiggyBank className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-950">{t("Sua reserva cresce todo mês")}</h2>
                </div>
                <p className="text-sm text-emerald-900/60 mt-3">
                  {t("O que sobra vai para sua reserva. A meta começa pequena e aumenta sozinha a cada conquista.")}
                </p>

                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-200"
                >
                  <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">
                    {t("Aporte deste mês")}
                  </p>
                  <p className="text-4xl font-bold mt-1">+{fmt(saveLimit)}</p>
                  <p className="text-xs opacity-90 mt-2">{t("Vai direto pra sua reserva")}</p>
                </motion.div>

                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold text-emerald-900/80 uppercase tracking-wide">
                    {t("Próximas metas (aumentam sozinhas)")}
                  </p>
                  {GOAL_MILESTONES.slice(0, 5).map((g, i) => {
                    const monthsNeeded = saveLimit > 0 ? Math.ceil(g / saveLimit) : 0;
                    return (
                      <motion.div
                        key={g}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-emerald-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Target className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-medium text-emerald-950">{fmt(g)}</span>
                        </div>
                        <span className="text-[11px] text-emerald-700/70">
                          {saveLimit > 0 ? `~${monthsNeeded} ${t("meses")}` : "—"}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-950">{t("Metas que nunca acabam")}</h2>
                </div>
                <p className="text-sm text-emerald-900/60 mt-3">
                  {t("Cada meta batida vira uma nova, maior. Você nunca para de evoluir.")}
                </p>

                <div className="mt-6 space-y-2.5">
                  {[
                    { label: t("Meta 1: Reserva de emergência"), value: 1000, done: true },
                    { label: t("Meta 2: Viagem"), value: 3000, done: true },
                    { label: t("Meta 3: Investimento inicial"), value: 8000, done: false },
                    { label: t("Próxima meta..."), value: null as number | null, done: false },
                  ].map((g, i) => (
                    <motion.div
                      key={g.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        g.done ? "bg-emerald-50 border-emerald-200" : "bg-white border-emerald-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          g.done ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-400 border border-dashed border-emerald-200"
                        }`}>
                          {g.done ? <Check className="w-4 h-4" /> : <Target className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-sm font-medium text-emerald-950">{g.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700">
                        {g.value ? fmt(g.value) : "∞"}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
                  <p className="text-xs leading-relaxed text-emerald-900/80">
                    {t("O FinFlow mantém você motivado: a cada conquista, uma nova meta aparece automaticamente e seu dinheiro continua crescendo.")}
                  </p>
                </div>
              </div>
            )}

            {step === 6 && (
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-200">
                    <LineChart className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-950">{t("Projeção dos seus ganhos")}</h2>
                </div>
                <p className="text-sm text-emerald-900/60 mt-3">
                  {t("Veja para onde seu dinheiro pode te levar mantendo o ritmo.")}
                </p>

                <motion.div
                  key={projection}
                  initial={{ opacity: 0.6, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-200"
                >
                  <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">
                    {t("Em")} {years} {t("anos você terá")}
                  </p>
                  <p className="text-4xl font-bold mt-1">{fmt(projection)}</p>
                  <p className="text-xs opacity-90 mt-2">
                    {t("Guardando")} {fmt(saveLimit)} {t("por mês")}
                  </p>
                </motion.div>

                <div className="mt-5 p-4 rounded-2xl bg-white border border-emerald-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-emerald-900">{t("Período")}</span>
                    <span className="text-sm font-bold text-emerald-950">{years} {t("anos")}</span>
                  </div>
                  <Slider
                    value={[years]}
                    onValueChange={([v]) => setYears(v)}
                    min={1} max={30} step={1}
                  />
                  <div className="flex justify-between text-[11px] text-emerald-700/60 mt-2">
                    <span>1</span><span>30</span>
                  </div>
                </div>

                <p className="text-xs text-emerald-900/60 mt-4 leading-relaxed">
                  {t("Com consistência, você conquista objetivos maiores: casa própria, liberdade financeira, aposentadoria tranquila.")}
                </p>
              </div>
            )}

            {step === 7 && (
              <div className="flex flex-col items-center text-center pt-8">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  className="w-20 h-20 rounded-3xl bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-200 mb-6"
                >
                  <Check className="w-10 h-10" />
                </motion.div>
                <h2 className="text-2xl font-bold text-emerald-950">{t("Tudo pronto!")}</h2>
                <p className="text-sm text-emerald-900/60 mt-3 max-w-[280px] leading-relaxed">
                  {t("Você já entendeu o essencial. Agora é só usar o FinFlow no seu dia a dia.")}
                </p>

                <div className="mt-8 w-full grid gap-2 text-left">
                  {[
                    { icon: Home,      label: t("Painel principal com seu saldo do mês") },
                    { icon: PiggyBank, label: t("Reserva e investimentos com metas") },
                    { icon: Target,    label: t("Relatório mensal para ajustar sua rota") },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-600">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm text-emerald-950 font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <div className="px-6 pb-6 pt-2">
        {step < TOTAL_STEPS - 1 ? (
          <Button
            onClick={next}
            className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-xl"
          >
            {step === 0 ? t("Começar") : t("Continuar")}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={finish}
            className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-xl"
          >
            {t("Ir para o app")}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        )}
      </div>
    </Shell>
  );
};

export default Onboarding;
