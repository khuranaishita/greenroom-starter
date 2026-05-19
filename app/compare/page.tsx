import { notFound } from "next/navigation";
import { FileWarning } from "lucide-react";
import { getShowById } from "@/lib/queries";
import { calculateSettlement } from "@/lib/dealMath";
import { formatMoney } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
} from "@/components/ui/card";

// Wet Cement – percentage_of_net, 85%, $550 expense cap
const SHOW_ID = "show_0001";

export default async function ComparePage() {
  const data = await getShowById(SHOW_ID);
  if (!data) notFound();

  const { deal, ticketSales, expenses } = data;
  if (!deal) notFound();

  const grossSoFar = ticketSales.reduce((s, t) => s + t.gross, 0);
  const totalFees = ticketSales.reduce((s, t) => s + t.fees, 0);
  const totalExpenses = expenses
    .filter((e) => !e.absorbedByVenue)
    .reduce((s, e) => s + e.amount, 0);
  const ticketCount = ticketSales.reduce((s, t) => s + (t.qty ?? 0), 0);

  const calc = calculateSettlement({
    deal,
    ticketSales,
    expenses,
    venueCapacity: data.venue?.capacity ?? undefined,
  });

  return (
    <div className="px-12 py-10 max-w-7xl">
      <div className="mb-10">
        <h1
          className="font-display text-[36px] font-medium text-ink-900 leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          Before vs After
        </h1>
        <p className="text-[13px] text-ink-400 mt-2">
          Wet Cement · percentage of net · 85% · $550 expense cap
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* ── BEFORE ── */}
        <div className="space-y-4">
          <div className="eyebrow text-[10px] text-ink-500 px-0.5 mb-2">
            Before — dead end
          </div>

          <Card accent="amber">
            <CardContent className="py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200/80 mb-5">
                <FileWarning className="h-5 w-5 text-amber-700" />
              </div>
              <h2
                className="font-display text-[22px] font-medium text-ink-900 mb-2"
                style={{ letterSpacing: "-0.02em" }}
              >
                The in-app tool can&apos;t settle a percentage of net yet.
              </h2>
              <p className="text-[13px] text-ink-500 max-w-md mx-auto leading-relaxed">
                Mariana would do this on a Google Sheet at 2am tonight. The
                inputs are below — but the math doesn&apos;t happen here.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>What the system has</CardTitle>
                <CardDescription>
                  The inputs Mariana would pull together to settle this show.
                  They&apos;re here — but disconnected from the deal terms.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Field label="Gross box office" mono value={formatMoney(grossSoFar)} />
                <Field label="Fees" mono value={formatMoney(totalFees)} />
                <Field label="Net box office" mono value={formatMoney(grossSoFar - totalFees)} />
              </div>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Field label="Tickets sold" mono value={String(ticketCount)} />
                <Field label="Expenses (line items)" mono value={String(expenses.filter((e) => !e.absorbedByVenue).length)} />
                <Field label="Expenses (passed through)" mono value={formatMoney(totalExpenses)} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── AFTER ── */}
        <div className="space-y-4">
          <div className="eyebrow text-[10px] text-ink-500 px-0.5 mb-2">
            After — working calculator
          </div>

          {calc.supported && (
            <>
              <div className="text-center py-8">
                <div className="eyebrow text-[10px] text-ink-400 mb-3">
                  Total to artist
                </div>
                <div
                  className="text-[72px] font-mono tabular font-bold text-ink-900 leading-none"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  {formatMoney(calc.totalToArtist)}
                </div>
              </div>

              <Card accent="brand">
                <CardHeader>
                  <div>
                    <CardTitle>Settlement worksheet</CardTitle>
                    <CardDescription className="font-mono">
                      {calc.finalFormula}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="divide-y divide-ink-100/80">
                  <Row label="Gross box office" value={formatMoney(calc.grossBoxOffice)} />
                  <Row label="Net box office" value={formatMoney(calc.netBoxOffice)} />
                  <Row label="Total expenses (passed through)" value={formatMoney(calc.totalExpenses)} />
                  <div className="pt-3" />
                  {calc.steps.map((step, i) => (
                    <Row
                      key={i}
                      label={step.label}
                      value={formatMoney(step.value)}
                      note={step.note}
                    />
                  ))}
                  <div className="pt-3" />
                  <div className="flex items-baseline justify-between py-3 font-semibold">
                    <span className="text-[13px] text-ink-900">Total to artist</span>
                    <span className="text-[18px] font-mono tabular text-ink-900">
                      {formatMoney(calc.totalToArtist)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <div>
        <div className="text-[13px] text-ink-600">{label}</div>
        {note && (
          <div className="text-[11.5px] text-ink-400 mt-0.5 max-w-md leading-snug">
            {note}
          </div>
        )}
      </div>
      <div className="text-[13.5px] text-ink-900 font-mono tabular">{value}</div>
    </div>
  );
}
