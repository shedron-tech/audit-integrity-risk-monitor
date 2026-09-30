# Audit Integrity Risk Monitor

Browser userscript (Tampermonkey) that flags conflicting audit selections before submission.

## Problem
Audits pre-filled by an automated agent were sometimes submitted without a real review.
When a reviewer left a wrong decision in place, the result was a false-positive defect
that counted against the audit.

## Solution
- Detects when a tab has contradictory selections (a "Yes" field selected together with "No Abuse Found").
- Shows an alert with the tab and the field involved, plus a badge on the affected tab.
- Includes a checklist reminder and an on-hold list for cases that need a second opinion.
- Production version also logged, per case, whether I kept or overrode the agent's decision
  and exported the log as CSV. This public version is simplified.

## Result
- In a two-week sample I disagreed with the agent's decision on 146 of 149 audits,
  which showed how often a default decision could slip through unreviewed.
- After using the tool I had no false-positive defects on my audits.
- The logged records served as documentation when appealing defects.

## Built with
JavaScript, Tampermonkey, browser localStorage. Developed with AI assistance:
I defined the problem and the rules, tested the tool on real cases, and iterated on it.

## Note
The code is sanitized: URLs, labels and identifiers are generic, and no internal data is included.
