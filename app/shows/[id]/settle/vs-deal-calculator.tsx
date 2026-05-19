"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

type TicketSaleInput = { gross: number; fees: number; qty: number | null };
type ExpenseInput = { amount: number; category: string; description: string | null };

type EditableTerms = {
  guarantee: number;
  artistPct: number;        // 0–100 display value
  expenseCap: number | null;
  hospitalityCap: number | null;
  walkoutPot: boolean;
  walkoutPotThreshold: number | null;
  bonusNote: string;
};

type ParseResult = {
  guarantee_amount: number | null;
  artist_percentage: number | null;
  expense_cap: number | null;
  hospitality_cap: number | null;
  walkout_pot: boolean;
  walkout_pot_threshold: number | null;
  bonus_conditions: string | null;
  ambiguous_terms: string[];
  error?: string;
};

export function VsDealCalculator({
  dealNotesFreetext,
  guaranteeAmount,
  percentageDecimal,
  expenseCap,
  hospitalityCap,
  ticketSales,
  expenses,
  artistName,
}: {
  dealNotesFreetext: string;
  guaranteeAmount: number;
  percentageDecimal: number;
  expenseCap: number | null;
  hospitalityCap: number | null;
  ticketSales: TicketSaleInput[];
  expenses: ExpenseInput[];
  artistName: string;
}) {
  const [terms, setTerms] = useState<EditableTerms>({
    guarantee: guaranteeAmount,
    artistPct: Math.round(percentageDecimal * 100),
    expenseCap,
    hospitalityCap,
    walkoutPot: false,
    walkoutPotThreshold: null,
    bonusNote: "",
  });
  const [ambiguities, setAmbiguities] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasAiParsed, setHasAiParsed] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calc = useMemo(() => {
    const gross = ticketSales.reduce((s, t) => s + t.gross, 0);
    const fees = ticketSales.reduce((s, t) => s + t.fees, 0);
    const net = gross - fees;

    const rawExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const cappedExpenses =
      terms.expenseCap != null
        ? Math.min(rawExpenses, terms.expenseCap)
        : rawExpenses;
    const expenseWasCapped =
      terms.expenseCap != null && rawExpenses > terms.expenseCap;

    const netAfterExpenses = net - cappedExpenses;
    const artistPctTake = netAfterExpenses * (terms.artistPct / 100);
    const guarantee = terms.guarantee;
    const pctWins = artistPctTake >= guarantee;
    const vsAmount = Math.max(artistPctTake, guarantee);

    let walkoutAmount: number | null = null;
    if (terms.walkoutPot && terms.walkoutPotThreshold != null) {
      walkoutAmount = Math.max(0, gross - terms.walkoutPotThreshold);
    }

    return {
      gross,
      fees,
      net,
      rawExpenses,
      cappedExpenses,
      expenseWasCapped,
      netAfterExpenses,
      artistPctTake,
      guarantee,
      pctWins,
      vsAmount,
      walkoutAmount,
      totalToArtist: vsAmount,
    };
  }, [ticketSales, expenses, terms]);

  const parseDeal = useCallback(async () => {
    setIsParsing(true);
    setParseError(null);
    try {
      const res = await fetch("/api/parse-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealNotes: dealNotesFreetext }),
      });
      const data: ParseResult = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "API error");
      }
      setAmbiguities(data.ambiguous_terms ?? []);
      setHasAiParsed(true);
      setTerms((prev) => ({
        ...prev,
        guarantee: data.guarantee_amount ?? prev.guarantee,
        artistPct: data.artist_percentage ?? prev.artistPct,
        expenseCap: data.expense_cap !== undefined ? data.expense_cap : prev.expenseCap,
        hospitalityCap: data.hospitality_cap !== undefined ? data.hospitality_cap : prev.hospitalityCap,
        walkoutPot: data.walkout_pot ?? prev.walkoutPot,
        walkoutPotThreshold: data.walkout_pot_threshold ?? prev.walkoutPotThreshold,
        bonusNote: data.bonus_conditions ?? prev.bonusNote,
      }));
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to parse deal. Is ANTHROPIC_API_KEY set?",
      );
    } finally {
      setIsParsing(false);
    }
  }, [dealNotesFreetext]);

  const generateSummary = useCallback(async () => {
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName,
          calculation: {
            grossRevenue: calc.gross,
            platformFees: calc.fees,
            netRevenue: calc.net,
            rawExpenses: calc.rawExpenses,
            expensesApplied: calc.cappedExpenses,
            expensesWereCapped: calc.expenseWasCapped,
            expenseCap: terms.expenseCap,
            netAfterExpenses: calc.netAfterExpenses,
            artistPercentage: `${terms.artistPct}%`,
            artistPercentageTake: calc.artistPctTake,
            guarantee: calc.guarantee,
            winner: calc.pctWins
              ? `${terms.artistPct}% take ($${calc.artistPctTake.toFixed(2)})`
              : `guarantee ($${calc.guarantee.toFixed(2)})`,
            totalToArtist: calc.totalToArtist,
            ...(terms.bonusNote ? { bonusNote: terms.bonusNote } : {}),
            ...(terms.walkoutPot && calc.walkoutAmount != null
              ? { walkoutPotAmount: calc.walkoutAmount }
              : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "API error");
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "Failed to generate summary.",
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [calc, terms, artistName]);

  const copySummary = useCallback(() => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* Deal notes + AI parse */}
      <Card accent="amber">
        <CardHeader>
          <div>
            <CardTitle>Deal notes</CardTitle>
            <CardDescription>
              What Mariana actually trusts. Structured fields may be stale.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={parseDeal}
            disabled={isParsing}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing…
              </>
            ) : hasAiParsed ? (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Re-parse
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Parse deal with AI
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed whitespace-pre-wrap">
            {dealNotesFreetext || (
              <span className="text-ink-400">No deal notes on file.</span>
            )}
          </div>
          {parseError && (
            <div className="mt-3 text-[12px] text-rose-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {parseError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ambiguity flags */}
      {ambiguities.length > 0 && (
        <div className="space-y-2.5">
          <div className="eyebrow text-[10px] text-ink-500 px-0.5">
            Ambiguities found — resolve before settling
          </div>
          {ambiguities.map((flag, i) => (
            <div
              key={i}
              className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-4 flex gap-3"
            >
              <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-[12.5px] text-ink-800 leading-relaxed">
                {flag}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editable deal terms */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Deal terms</CardTitle>
            <CardDescription>
              {hasAiParsed
                ? "Updated from AI parse. Edit anything that looks wrong."
                : "Pre-filled from structured fields. Use AI parse to update from the notes above."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            <TermField
              label="Guarantee"
              prefix="$"
              value={terms.guarantee}
              onChange={(v) => setTerms((p) => ({ ...p, guarantee: v }))}
            />
            <TermField
              label="Artist %"
              suffix="%"
              value={terms.artistPct}
              onChange={(v) => setTerms((p) => ({ ...p, artistPct: v }))}
            />
            <TermField
              label="Expense cap"
              prefix="$"
              value={terms.expenseCap ?? 0}
              onChange={(v) =>
                setTerms((p) => ({ ...p, expenseCap: v > 0 ? v : null }))
              }
              placeholder="Uncapped"
            />
            <TermField
              label="Hospitality cap"
              prefix="$"
              value={terms.hospitalityCap ?? 0}
              onChange={(v) =>
                setTerms((p) => ({ ...p, hospitalityCap: v > 0 ? v : null }))
              }
              placeholder="Uncapped"
            />
          </div>

          {/* Walkout pot toggle */}
          <div className="mt-6 flex items-center gap-3">
            <button
              role="switch"
              aria-checked={terms.walkoutPot}
              onClick={() =>
                setTerms((p) => ({ ...p, walkoutPot: !p.walkoutPot }))
              }
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 ${terms.walkoutPot ? "bg-brand-700" : "bg-ink-200"}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${terms.walkoutPot ? "translate-x-[18px]" : "translate-x-[2px]"}`}
              />
            </button>
            <span className="text-[13px] text-ink-700">Walkout pot</span>
          </div>

          {terms.walkoutPot && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-5">
              <TermField
                label="Walkout threshold"
                prefix="$"
                value={terms.walkoutPotThreshold ?? 0}
                onChange={(v) =>
                  setTerms((p) => ({ ...p, walkoutPotThreshold: v > 0 ? v : null }))
                }
                placeholder="e.g. 3200"
              />
            </div>
          )}

          {terms.bonusNote && (
            <div className="mt-5">
              <div className="eyebrow text-[10px] text-ink-500 mb-1.5">
                Bonus conditions
              </div>
              <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-3 ring-1 ring-ink-200/60 leading-relaxed">
                {terms.bonusNote}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VS calculator */}
      <Card accent="brand">
        <CardHeader>
          <div>
            <CardTitle>VS deal calculator</CardTitle>
            <CardDescription>
              Guarantee vs {terms.artistPct}% of net — whichever is greater.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-ink-100/80">
          <CalcRow label="Gross ticket revenue" value={calc.gross} />
          <CalcRow
            label="Less: platform / CC fees"
            value={-calc.fees}
            note={
              calc.gross > 0
                ? `${((calc.fees / calc.gross) * 100).toFixed(1)}% of gross`
                : undefined
            }
          />
          <CalcRow label="Net revenue" value={calc.net} bold />
          <CalcRow
            label="Less: expenses"
            value={-calc.cappedExpenses}
            note={
              calc.expenseWasCapped
                ? `Capped at ${formatMoney(terms.expenseCap)} · actual ${formatMoney(calc.rawExpenses)}`
                : terms.expenseCap != null
                  ? `Under cap (${formatMoney(terms.expenseCap)} cap)`
                  : undefined
            }
          />
          <CalcRow label="Net after expenses" value={calc.netAfterExpenses} bold />

          <div className="pt-3" />

          <CalcRow
            label={`${terms.artistPct}% of net (percentage path)`}
            value={calc.artistPctTake}
          />
          <CalcRow label="Guarantee (floor)" value={calc.guarantee} />

          <div className="py-3 flex items-baseline justify-between">
            <div>
              <div className="text-[13px] font-semibold text-ink-900">
                Winner:{" "}
                <span className="text-brand-700">
                  {calc.pctWins
                    ? `${terms.artistPct}% take is greater`
                    : "guarantee is greater"}
                </span>
              </div>
            </div>
            <div className="text-[13.5px] font-semibold font-mono tabular text-ink-900">
              {formatMoney(calc.vsAmount)}
            </div>
          </div>

          {terms.walkoutPot && calc.walkoutAmount != null && (
            <CalcRow
              label="Walkout pot"
              value={calc.walkoutAmount}
              note={`100% of gross above ${formatMoney(terms.walkoutPotThreshold)}`}
            />
          )}

          <div className="pt-3" />

          {/* Hero payout */}
          <div className="pt-4 pb-2">
            <div className="eyebrow text-[10px] text-ink-500 mb-2">
              Final artist payout
            </div>
            <div
              className="text-[56px] font-mono tabular font-bold text-ink-900 leading-none"
              style={{ letterSpacing: "-0.03em" }}
            >
              {formatMoney(calc.totalToArtist)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tour manager summary */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Tour manager summary</CardTitle>
            <CardDescription>
              Plain English — ready to copy into an email or text.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={generateSummary}
            disabled={isGeneratingSummary}
          >
            {isGeneratingSummary ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <MessageSquare className="h-3.5 w-3.5" /> Generate summary
              </>
            )}
          </Button>
        </CardHeader>
        {(summary || summaryError) && (
          <CardContent>
            {summaryError ? (
              <div className="text-[12px] text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {summaryError}
              </div>
            ) : (
              <div className="relative">
                <div className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-4 pr-10 ring-1 ring-ink-200/60 leading-relaxed">
                  {summary}
                </div>
                <button
                  onClick={copySummary}
                  title={copied ? "Copied!" : "Copy to clipboard"}
                  className="absolute top-3 right-3 p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100 transition-colors"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-brand-700" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function TermField({
  label,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="eyebrow text-[10px] text-ink-500 mb-1.5">{label}</div>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-[13px] text-ink-400 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={placeholder}
          className={`w-full bg-canvas-soft rounded-md py-2 text-[13px] font-mono tabular text-ink-900 ring-1 ring-ink-200/80 focus:outline-none focus:ring-2 focus:ring-brand-700/50 transition-all ${
            prefix ? "pl-6 pr-3" : suffix ? "pl-3 pr-7" : "px-3"
          }`}
        />
        {suffix && (
          <span className="absolute right-3 text-[13px] text-ink-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function CalcRow({
  label,
  value,
  note,
  bold,
}: {
  label: string;
  value: number;
  note?: string;
  bold?: boolean;
}) {
  const isNegative = value < 0;
  return (
    <div className={`flex items-baseline justify-between py-2.5 ${bold ? "font-semibold" : ""}`}>
      <div>
        <div className={`text-[13px] ${bold ? "text-ink-900" : "text-ink-600"}`}>
          {label}
        </div>
        {note && (
          <div className="text-[11.5px] text-ink-400 mt-0.5 max-w-xs leading-snug">
            {note}
          </div>
        )}
      </div>
      <div
        className={`text-[13.5px] font-mono tabular ${
          bold ? "text-ink-900" : "text-ink-800"
        }`}
      >
        {isNegative
          ? `(${formatMoney(Math.abs(value))})`
          : formatMoney(value)}
      </div>
    </div>
  );
}
