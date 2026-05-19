# Settlement Calculator: Fixing the 63% Gap
**Greenroom Applied AI PM Case Study**

## The slice I picked and why

63% of deals at The Crescent can't be settled in the 
app. Mariana is in a spreadsheet every week not because 
the UX is bad — but because the math literally doesn't 
happen in the product. The app shows her a screen that 
says "Mariana would do this on a Google Sheet at 2am 
tonight." That's the problem I picked.

I chose this over dispute resolution, audit trails, and 
agent comms because it has the clearest leverage point: 
fix the calculator, and every downstream problem — 
disputes, trust, agent communication — gets easier. 
You can't build trust on a number that came from a 
spreadsheet Mariana ran at 2am with no audit trail.

The CEO memo confirmed it: "Settlement is the place we 
are most clearly losing on craft. 18% of customers use 
the in-app tool. The other 82% default to spreadsheets."
That's not a UX problem. That's an existential signal.

## What I built

**1. % of net calculator**
Replaced the dead-end "can't settle" screen for 
percentage_of_net deals with a working step-by-step 
calculator. It uses real data already in the system — 
ticket sales, fees, expenses — and runs the math that 
Mariana was doing manually in a spreadsheet. Styled 
exactly like the existing flat deal worksheet so it 
feels native. No AI required — the data was already 
there, just disconnected.

**2. Disputed status warning banner**
Added an amber warning on settlement pages where 
status = 'disputed' but the agent has left a positive 
sign-off. Example: "Looks good — TM. Wire to the usual 
account when ready." This surfaces a real data integrity 
problem I found while querying the database directly.

**3. Before/After compare page**
Added /compare to show the exact problem and fix 
side-by-side using real Wet Cement data. Used in the 
Loom walkthrough.

## What I found in the data

The brief hinted at one disputed settlement with a 
positive sign-off. When I queried the database directly 
I found 23 of them — every single disputed settlement 
has a positive agent sign-off. "OK. Good night." "👍" 
"Looks good." "ok wire monday."

These settlements are stuck in disputed status 
permanently even though the humans resolved them. 
Money may never have been wired because the system 
still shows them as disputed. This is a systemic data 
integrity problem, not a one-off bug.

The most telling: stl_show_0007 — "Looks good — TM. 
Wire to the usual account when ready." Status: disputed.

I also found that the deal freetext notes are the real 
source of truth. Structured fields like guarantee_amount 
and percentage are often stale or wrong. show_0007's 
notes say "structured field still reflects original 
$11,000 — confirm before settlement." This is why AI 
deal parsing matters — it should read the freetext, 
not the structured fields.

## What I cut and why

**AI deal parsing for Vs deals:** The shell exists in 
the app but requires an Anthropic API key. I chose to 
fix the % of net calculator first because it has zero 
dependencies and affects more shows. AI parsing is the 
right next layer — it prevents the Coastal Spell 
scenario ($720 dispute with WME over ambiguous deal 
language) by flagging unclear terms before settlement.

**Walkout pots and tier ratchets:** Valid extensions 
but scope creep. show_0007 has a walkout pot — I noted 
it, didn't build it. It goes in "what's next."

**Agent portal / sharing:** High value but a completely 
separate surface. Out of scope for this slice.

**Full audit trail:** The step-by-step calculator is 
the audit trail for now. Every line is labeled so the 
tour manager can verify the math.

## How I'd validate this

The single metric that matters: does Mariana open a 
spreadsheet after this ships?

Specifically:
- Shadow Mariana through one real settlement night 
  before and after
- Measure time-to-settled for % of net shows
- Track whether the "actually settled off-platform" 
  field gets used less
- Count disputed settlements that have positive 
  sign-offs — this number should drop to zero as 
  statuses get cleaned up

## What I'd ship next

1. **Fix the 23 stale disputed settlements** — run a 
   migration that flags them for Mariana to review and 
   resolve. Quick win, high trust impact.

2. **AI deal parsing for Vs deals** — read the 
   deal_notes_freetext, extract structured terms, flag 
   ambiguous language before settlement runs. This 
   directly prevents the Coastal Spell scenario.

3. **Pre-settlement ambiguity check** — surface unclear 
   deal terms at deal entry, not at 2am. "Marketing 
   recoup of $900 — is this inside or outside the 
   expense cap?" Answer it in December, not March.

4. **Walkout pot support** — show_0007 needs it. 
   Straightforward math extension.