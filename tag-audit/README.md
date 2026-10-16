# Tag audit

The audit in #174 checks every flag's tags against what flagcdn actually shows, in
batches a human reviews row by row. This file is how to run a batch. What the tags
*mean* — which shapes earn `circle`, when a ribbon is a ribbon, which colours count —
is in [`vocabulary-rules.md`](vocabulary-rules.md), and it decides every proposal.

The site renders flagcdn's images, so flagcdn is the source of truth: when the data
and the picture disagree, the data is wrong.

## The files

| File | Role |
|---|---|
| `proposals.original.tsv` | The batch as proposed. Never edited after it is committed. |
| `proposals.tsv` | The same rows; the reviewer deletes the ones they disagree with. |
| `rejected.tsv` | Rejections, keyed on the flag's baseline image hash, so a declined row is not proposed again until flagcdn changes the picture. Written by the apply script. |
| `tranches.tsv` | Which tranche each flag belongs to, frozen so that a new flag cannot shift the others. |
| `batch-baseline.tsv` | The baseline image hash of every flag in the current batch's tranche, recorded when the batch is proposed and checked before it is applied. |
| `needs-a-human.tsv` | Questions the audit will not decide. Not applied by anything. |
| `vocabulary-rules.md` | The rules, the motifs seen so far, and the candidates for the next removal round. |

Every row leads with the flag's English name and then its code. The reviewer reads the
name; the script applies by the code and refuses a row where the two disagree.

## Running a tranche

The flags are worked through in eight tranches of about 32, listed in
[`tranches.tsv`](tranches.tsv). The list is frozen: deriving tranches from
`flaginfo.json` would shift every flag after a new or removed one into another tranche.
A flag added later is not in it. The tranche pull request that audits it adds it, under
its own number; nothing else adds rows, so a tranche's list cannot change under an open
review. Find the last merged *Propose tranche N* pull request to see
which is next, then list it:

```
awk -F'\t' '!/^#/ && $3==6 {print $2}' tag-audit/tranches.tsv
```

1. **Check the rules first.** `vocabulary-rules.md` names flags as examples rather than
   counting them. Confirm each rule still holds across `flaginfo.json` before
   proposing anything, for example that every `bird` flag carries `animal`, and that
   no `crown` flag carries `hat`.
2. **Look at every flag.** `scripts/tag-audit-look.mjs` downloads the images, writes
   contact sheets of eight, and prints how much of each flag is each filter colour:

   ```
   node scripts/tag-audit-look.mjs --out /tmp/tranche $(awk -F'\t' '!/^#/ && $3==6 {print $2}' tag-audit/tranches.tsv)
   node scripts/tag-audit-look.mjs --out /tmp/tranche-zoom --size w1280 bo mt
   ```

   The script first checks that flagcdn still serves the picture `flag-baseline/`
   records, and stops if not: a rejection is stamped with that baseline's hash, so a
   changed flag is audited after the image watch's pull request is merged, not before.

   Read the sheets, then open coats of arms and small emblems at `w1280`; details that
   matter are often invisible at 320 px. Trust the colour count over your eye for
   colours, and the image over the count for everything else. The flag's own
   `symbolism` text often names what an emblem is.
3. **Decide what to propose**, by the rules:
   - Additions and aliases only. A tag that looks wrong goes to the removal candidates
     in `vocabulary-rules.md`; removals are a round of their own.
   - Aliases only for plain emblems someone would search for by name, singular and
     plural where there are several. Mark each one *proposed* in the motif list until
     the batch is applied.
   - Anything genuinely undecidable goes to `needs-a-human.tsv`, not into the batch.
   - Protected tags (flag families, religions, `whitney_smith`) are never proposed; the
     apply script refuses them.
4. **Write the batch.** Put the same rows in `proposals.original.tsv` and
   `proposals.tsv`, under the header the previous batch used, then
   `node scripts/apply-tag-audit.mjs --dry-run`. It must apply every row without a
   `FAIL`. Write it before testing aliases: the test applies these files to a copy, so
   until they hold the new rows it only re-applies the previous batch. In the same
   commit, record which picture of each flag the batch is reviewed against:

   ```
   node scripts/tag-audit-baseline.mjs record 6
   ```

   This writes `batch-baseline.tsv`. The look script has just confirmed that flagcdn
   serves what `flag-baseline/` holds, so these are the pictures the reviewer sees.
5. **Test every alias in a browser.** The search turns a filter word into the filter
   and matches the rest as a substring, so reason less and measure:

   ```
   rm -rf /tmp/copy && rsync -a --exclude node_modules --exclude .git ./ /tmp/copy/
   (cd /tmp/copy && node scripts/apply-tag-audit.mjs)
   node scripts/tag-audit-search.mjs --root /tmp/copy "southern cross" "dolphins"
   ```

   Each alias must find the flag it was added for. Every other flag it finds must be
   one the word also fits: `eagle` finds every eagle flag, and should. A match the word
   does not describe, through another flag's name or alias (`pine` also finds the
   Philippines), is worth a sentence in the pull request.
6. **Open the pull request**, titled *Propose tranche N of the tag audit*.
   `node scripts/tag-audit-table.mjs` prints the rows as tables with each flag's image
   and a flagfilter.com link. Clicking the image opens flagcdn's SVG of the flag, which
   zooms without limit, so a row about a small detail can be checked there. Put the medium-confidence rows, the ones most worth
   disagreeing with, in the description, and do not apply anything.

## After review

The owner deletes rows in `proposals.tsv`, often in the GitHub editor, and says so.
Then, on the same branch:

1. Check that every flag is still the picture it was reviewed against. A rejection is
   stamped with the hash of the flag's baseline image, so applying a decision against
   a different picture records it wrongly. Rebase first, onto the `origin/master` that
   `git fetch` updates (not the local `master`, which it does not move), then compare
   with the recording made when the batch was proposed:

   ```
   git fetch origin master
   git rebase origin/master
   node scripts/tag-audit-baseline.mjs check
   ```

   The check reads `batch-baseline.tsv`, not git history, so earlier rebases during
   review cannot hide anything from it. It fails on a flag whose baseline changed, a
   flag that joined the tranche after the batch was proposed, and one that left it.
   For a changed flag, delete its rows from both proposals files, if it has any, so
   they are neither applied nor rejected, and say in the pull request that it changed
   during review: its new picture goes through the image watch's checklist, and any
   proposal for it comes in a later batch. Look at a flag that joined before applying,
   or move it to a later tranche in `tranches.tsv`. Then record again, so the check
   passes on what is actually being applied.

   Last, run the look script on the tranche. The check covers changes the image watch
   has merged; for one it has not picked up yet, this stops on any flag whose flagcdn
   image no longer matches the baseline. Treat those flags as changed.

   ```
   node scripts/tag-audit-look.mjs --out /tmp/recheck $(awk -F'\t' '!/^#/ && $3==6 {print $2}' tag-audit/tranches.tsv)
   ```
2. `node scripts/apply-tag-audit.mjs`, then run it again: the second run must change
   nothing.
3. Update `vocabulary-rules.md` to match what survived: drop *proposed* from kept
   aliases, remove rejected ones from the motif list, and write down any rule the
   owner's decisions implied.
4. Run the validators and the Playwright suite, push, comment the apply output on the
   PR, and squash-merge once CI and review are green.

When enough removal candidates have gathered, run them as their own batch
(`remove` rows), reviewed the same way.
