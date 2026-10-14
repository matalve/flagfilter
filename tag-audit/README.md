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
| `needs-a-human.tsv` | Questions the audit will not decide. Not applied by anything. |
| `vocabulary-rules.md` | The rules, the motifs seen so far, and the candidates for the next removal round. |

Every row leads with the flag's English name and then its code. The reviewer reads the
name; the script applies by the code and refuses a row where the two disagree.

## Running a tranche

The flags are worked through in eight tranches of about 32: every 8th flag in code
order, tranche *n* taking `NR%8 == n` (tranche 8 is `NR%8 == 0`). Find the last merged
*Propose tranche N* pull request to see which is next, then list it:

```
jq -r '.[].shortname' flaginfo.json | sort | awk 'NR%8==6'
```

1. **Check the rules first.** `vocabulary-rules.md` names flags as examples rather than
   counting them. Confirm each rule still holds across `flaginfo.json` before
   proposing anything, for example that every `bird` flag carries `animal`, and that
   no `crown` flag carries `hat`.
2. **Look at every flag.** `scripts/tag-audit-look.mjs` downloads the images, writes
   contact sheets of eight, and prints how much of each flag is each filter colour:

   ```
   node scripts/tag-audit-look.mjs --out /tmp/tranche $(jq -r '.[].shortname' flaginfo.json | sort | awk 'NR%8==6')
   node scripts/tag-audit-look.mjs --out /tmp/tranche-zoom --size w1280 bo mt
   ```

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
4. **Test every alias in a browser.** The search turns a filter word into the filter
   and matches the rest as a substring, so reason less and measure:

   ```
   rsync -a --exclude node_modules --exclude .git ./ /tmp/copy/
   (cd /tmp/copy && node scripts/apply-tag-audit.mjs)
   node scripts/tag-audit-search.mjs --root /tmp/copy "southern cross" "dolphins"
   ```

   Each alias should find exactly the flag it was added for.
5. **Write the batch.** Put the same rows in `proposals.original.tsv` and
   `proposals.tsv`, under the header the previous batch used, then
   `node scripts/apply-tag-audit.mjs --dry-run`. It must apply every row without a
   `FAIL`.
6. **Open the pull request**, titled *Propose tranche N of the tag audit*.
   `node scripts/tag-audit-table.mjs` prints the rows as tables with each flag's image
   and a flagfilter.com link. Put the medium-confidence rows, the ones most worth
   disagreeing with, in the description, and do not apply anything.

## After review

The owner deletes rows in `proposals.tsv`, often in the GitHub editor, and says so.
Then, on the same branch:

1. Rebase onto `master` if it has moved.
2. `node scripts/apply-tag-audit.mjs`, then run it again: the second run must change
   nothing.
3. Update `vocabulary-rules.md` to match what survived: drop *proposed* from kept
   aliases, remove rejected ones from the motif list, and write down any rule the
   owner's decisions implied.
4. Run the validators and the Playwright suite, push, comment the apply output on the
   PR, and squash-merge once CI and review are green.

When enough removal candidates have gathered, run them as their own batch
(`remove` rows), reviewed the same way.
