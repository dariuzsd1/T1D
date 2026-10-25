# Going public: staged plan, and how to get it checked by professionals

Companion to `GO_PUBLIC_STRESS_TEST_BRIEF.md`. That one is the engineering
audit. This one is the gates, the paperwork, and how to spend a small budget on
professional review without wasting it.

**I am not a lawyer and this is not legal advice.** Everything below marked
*(confirm)* is my reading of the shape of the problem, written so a professional
can agree or correct it quickly. Treat it as the question, not the answer.

---

## The decision you left open: what is the first beta for?

You said you were not sure. Here is the reasoning, then the recommendation.

The legal weight of this does not scale with *having* users. It scales with three
things: **how many**, **whether they are strangers**, and **what you claim**. A
dozen people you personally know, who you have told plainly what this is, sits at
the bottom of all three axes. A public post to a diabetes subreddit sits much
higher on all three at once.

So the useful question is not "feedback or real use". It is "how small and how
honest can stage one be while still teaching you something". And here feedback-
only is actually the *worse* trade: a person poking at sample data cannot tell
you whether the reorder date was right, which is the only thing that matters
about this app. You would spend the caution and learn the least.

**Recommendation: real use, with people you know, at a size you can name.** Ten
to fifteen. Each one told directly, by you, in words: what it does, that it is
new, that they must not stop checking their own supplies, and that you can see
nothing about them you have not been given. That is a defensible footing, it
produces the only feedback worth having, and it needs no lawyer to start.

The thing that needs a lawyer is **stage two** — the public post. Do not skip
from stage one to a subreddit.

## The stages, and the gate on each

### Stage 0 — now. You, alone.
Already true. Nothing to do.

### Stage 1 — ten to fifteen people you know, using it for real.
**Gate, all of which you can do yourself:**
- The engineering audit from the other brief has no unmitigated blocker or high.
- A plain-language privacy notice. Not a template dump: what you collect, where
  it lives (Supabase, `eu-west-1`), who can see it (you, technically, as project
  owner — say so), how to get it out, how to delete it.
- Working export and delete. A user must be able to leave with their data and
  leave nothing behind.

  **This gate does not currently hold.** `src/lib/dataExport.ts` lists nine
  tables. Four user-scoped tables are missing from it:

  | table | what it holds | why it matters |
  |---|---|---|
  | `activity_log` | every logged action of theirs | plainly personal data |
  | `analytics_events` | their usage events (opt-in) | personal data even if opt-in |
  | `fcm_tokens` | their device push tokens | device identifiers |
  | `notification_log` | which alerts were sent to them | a record about them |

  The first three are straightforward additions. `notification_log` is harder on
  purpose: it has RLS enabled with **zero client policies**, so the browser
  cannot read it at all — that is deliberate (only the Edge Function's service
  role touches it). Making it exportable means either a narrow read policy or a
  server-side export route, and that is a decision, not an oversight.

  *(confirm)* My reading is that GDPR access and portability cover all four, so
  decide this before stage 1 rather than after. Also verify that account
  deletion actually cascades to all of them — the FK cascades look right in
  `setup.sql`, but "looks right" has been wrong five times in this project.
- Accept the **data processing agreements** Supabase and Vercel already publish.
  Free, a few clicks, and *(confirm)* the thing GDPR Art 28 wants from you as a
  controller using processors. Do this before stage 1, not stage 2.
- A written note of who the users are and that they consented. An email thread
  is fine at this size.
- Error monitoring, with PHI scrubbed from payloads. You are currently blind.
- Say, in the app, that it is not a medical device and does not give medical
  advice, and that supply decisions stay with the user and their clinician.

### Stage 2 — a public beta. Strangers. A post somewhere.
**Gate:**
- Everything from stage 1, holding.
- **The legal consultation below has happened**, and whatever it surfaces is
  resolved.
- A decision on the entity (see below).
- A support channel you can actually keep up with, and a catalog-contribution
  route — because the first thing strangers hit is a product you do not have.
- Clinical review done (below). Cheaper and easier than the legal piece.
- A kill switch: one documented way to take it down or stop notifications fast.

### Stage 3 — open.
Not worth planning yet. It depends entirely on what stage 2 teaches you.

## Entity: when it stops being optional

You said you would set one up if needed. My read *(confirm)*:

- **Stage 1 does not need one.** Friends, consent, no money changing hands.
- **Stage 2 probably does**, for two reasons that have nothing to do with tax.
  It puts a legal person other than you between your personal assets and a claim,
  and some vendors will not sign agreements with an individual. If stage 2 is
  real, treat incorporation as part of its gate and ask the lawyer about it in
  the same consultation — it is a cheap question once you have them on the phone.

## The legal consultation: how to spend a few hundred well

A few hundred buys you **one scoped conversation, not an opinion letter.** So do
not ask "is my app legal". Ask triage questions that change what you build.

### Who to engage
A lawyer who does **digital health / health tech**, in your jurisdiction. Not a
generalist, not a US firm if you are in the EU. Ask up front: "have you advised
a consumer health app on GDPR and on medical-device qualification?" If they
hesitate on the second half, they are the wrong person — that is the expensive
question.

### Send this ahead, as one page
Make them read it before the clock starts.
1. What the app does, in three sentences, in the plainest words you have.
2. **What it does not do**: no dosing advice, no glucose readings, no treatment
   recommendation, no clinician-facing features, no data sold or shared.
3. The data: identity (email), supply inventory, prescription metadata,
   optionally a medical-ID card (name, blood type, diagnosis, allergies,
   emergency contacts). Where it is hosted and in which region.
4. Who sees it: the user; a caregiver only if the user invites one and the
   caregiver accepts; you, technically, as project owner.
5. Users: stage 1 is N people known to you; stage 2 is a public beta of unknown
   size, in which countries.
6. That it is free and you are not a clinician or a provider.

### Ask these, in this order
1. **Is this a medical device where I am launching?** Software that forecasts
   when a patient will run out of insulin — does that fall inside EU MDR
   (Annex VIII Rule 11, MDCG 2019-11 on software qualification), or is it
   logistics software outside it? **This is the question that can stop the
   project**, so ask it first and get the reasoning, not just the answer.
2. **What wording would push it over that line?** You need to know which claims
   to never make. Get concrete phrasings to avoid.
3. **GDPR**: health data is special-category. Is explicit consent the right
   lawful basis for a free consumer app, and what must the notice say? Is a DPIA
   required at stage 2, and if so can a short one suffice?
4. **Does HIPAA apply to me at all?** My reading *(confirm)* is **no** — a
   direct-to-consumer app is not a covered entity or a business associate unless
   you are acting for a provider or insurer, so the BAA question may be moot and
   `CLAUDE.md` §3 may be over-cautious on this point. Worth two minutes to
   confirm, because if it is moot it removes a cost you have been budgeting for.
5. **Liability**: what do terms of service realistically do for me if someone
   says the app made them run out of insulin, and is insurance worth it at
   stage 2?
6. **Entity**: does a company meaningfully protect me here, and at what stage?

### Free routes worth using first
These can make the paid hour much more productive, or occasionally replace it.
- **Your national data protection authority.** Most publish plain-language SME
  guidance and many answer written questions for free. Slow, but authoritative.
- **The competent authority for medical devices in your country** often answers
  qualification queries. This is exactly the sort of borderline case they see.
- **University law clinics** with a tech or health specialism take small projects
  pro bono.
- **The open-source diabetes community.** Nightscout, Loop, AndroidAPS, the
  `#WeAreNotWaiting` people — they have walked directly into this question,
  repeatedly, and some of them have lawyers' answers already. This is the single
  most underrated route on this list: free, specific, and from people who
  understand both the regulation and the disease.

## Clinical review: cheaper, easier, do it earlier

Separate from the legal piece and much less painful. You are not asking anyone
to certify anything — you are asking a clinician whether the numbers and the
wording are defensible.

**Who:** your own endocrinologist or diabetes specialist nurse is the obvious
first ask, and costs nothing but a conversation at your next appointment. Failing
that, a diabetes patient organisation (Breakthrough T1D, Diabetes UK, your
national association) — these groups frequently review patient tools and will
often connect you to someone.

**What to put in front of them**, concretely, not the whole app:
1. The discard-window table: 10 days for a Humalog Mix pen, 28 for most, 42 for
   Novolin, 56 for Tresiba and Toujeo, 40 for the U-500 vial. Are these right
   and are any dangerous to get wrong?
2. The in-use window beating volume for low doses — that a 300-unit pen at
   20u/day is 10 days of supply, not 15. Is that how they would counsel a patient?
3. The wear rates, especially where the app now uses a measured cadence instead
   of the label.
4. The rescue-item handling: glucagon and ketones on expiry, fast carbs on
   consumption. Right call?
5. **The wording.** Does anything read as clinical advice? This is where a
   clinician's instinct is worth more than your judgement or mine.

Ask them explicitly: *"is there anything here that could hurt someone?"* and
write down the answer verbatim.

## What I would do next, in order

1. Pick the ten to fifteen people. Write the plain-language note you will send
   them. That note is also 80% of your privacy notice.
2. Run the engineering stress test from the other brief. Fix blockers.
3. Accept the Supabase and Vercel DPAs. Add error monitoring. Verify export and
   delete actually work end to end.
4. Start stage 1. Learn things.
5. In parallel, ask your endocrinologist, and post the qualification question to
   the open-source diabetes community.
6. Only once stage 1 has taught you something, book the paid consultation — you
   will ask much better questions with real users behind you, and the few hundred
   will go further.

Do not post this publicly until step 6 has happened.
