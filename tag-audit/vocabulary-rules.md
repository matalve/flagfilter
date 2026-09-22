# What the tags mean

`rejected.tsv` remembers that one proposal was declined for one flag. It does not
stop the same misreading arriving next week attached to a different flag. This file
is for that: the reasoning behind a rejection, written down once so the audit stops
making the same class of mistake.

Read this before proposing anything. See #174.

`tags` holds filter terms only, and `validate-flaginfo.mjs` rejects anything else.
A word that describes the flag but has no button — `carpet` on Turkmenistan,
`sphere` on Portugal — is a search keyword, not a tag, and lives in the flag's
`aliases` array alongside the alternative names (`burma`, `usa`). Do not propose
one as a tag, and do not propose removing one from `aliases`. See #184 and #203.

## Rules

**`vertical` and `horizontal` describe the design, not any band in it.** The flag
needs at least two parallel bands in that orientation to earn the tag. A single band
at the hoist crossing horizontal stripes does not make the flag vertical: Benin,
the Central African Republic and Guinea-Bissau are `horizontal` and nothing else.
The United Arab Emirates and Madagascar are the same case.

**A ring of text is not a `circle`.** Nicaragua's emblem sits inside a lettered ring;
that is lettering arranged in a curve, not a circle in the flag's design.

**A flag in a canton is not `flag`.** The Union Jack on Pitcairn, and on every other
British ensign, is a canton — that is what an ensign is. `flag` is for a flag
depicted as an object in the design, the way standards flank the arms on Ecuador's.

**An object that is two things gets both tags.** An axe is a `tool` and a `weapon`,
not whichever is closer. Belize already carries both, so this is existing practice.

**A motto scroll is not a `ribbon`.** `ribbon` is for a ribbon as an object — the
tricolour band tying the wreath on Mexico, the ribbons wound round the pillars on
Spain. The lettered banderole under Andorra's shield and the scroll under Egypt's
eagle are not that, whatever they are made of.

**`waves` is about how water is drawn, not whether water is there.** Bands of wavy
lines are waves: the blue and white ones at the foot of each of Spain's pillars.
Lake Texcoco at the base of Mexico's emblem is water too — drawn in the Aztec
convention as turquoise curls — and is not waves.

## When one tag implies another

Some terms sit inside others. Where they do, the narrow tag is never enough on its
own — a flag with a bird is a flag with an animal, and leaving `animal` off hides it
from a filter it belongs in. Where they do not, adding the broad tag is wrong, not
generous. The vocabulary gives no hint which is which, so each pair is decided here
rather than re-derived per flag.

**These imply the broader tag. Always propose both.**

- `bird` implies `animal`. All 21 bird flags carry both today.
- `motto` implies `text`, and so does `name`. All 19 and all 10 carry both.

**These do not imply anything, and the broader tag is a separate finding.**

- `crown` is not a `hat`. A crown is regalia, not headwear; all 10 crown flags leave
  `hat` off. Whether a bishop's mitre is a `hat` is still open, in
  `needs-a-human.tsv`.
- `hand` is not `human`, and neither is `face` or `hat`. A body part or a garment
  standing alone is not a person: Brunei's hands, the Red Hand of Ulster, the Sun of
  May's face on Argentina and Uruguay, the four hat flags. `human` is for a figure
  depicted as a figure, which is why only Belize, Montserrat and the British Virgin
  Islands carry it. Belize is the one flag with both `face` and `human`, and it earns
  both: the faces belong to the two figures.
- `shield` is not `weapon`. Arms are on a shield on 11 flags; only 3 carry both, and
  those have a weapon elsewhere in the design.
- `moon` is not `circle`. A crescent is not a circle, and the 2 flags of 20 carrying
  both earn it elsewhere: Palau's disc is the full moon drawn as a disc, and Cocos
  has a circular palm-tree badge beside its crescent. So `circle` goes on a disc, not
  on the idea of a moon.
- `fleur-de-lis` is not `vegetation`. It is a stylised lily, but it is carried as a
  heraldic charge, and none of the 4 flags derives `vegetation` from it. Spain has
  both because its arms depict a pomegranate for Granada, which is a plant in its own
  right.

**An object that is two things still gets both tags** — see the axe rule above. That
is co-classification, not hierarchy: neither `tool` nor `weapon` contains the other,
and the object earns both on its own merits.

## `sun` and `circle`: the drawing decides, not the word

A sun earns `circle` when the design holds a closed round disc, and not otherwise.
Same reading as the `moon` rule above: `circle` goes on a shape, not on an idea. The
counts looked like a coin flip — 10 flags carried both and 9 carried only `sun` — but
that split is mostly the rule already working, not drift.

**A disc is there.** All 10 that carry both earn it: Japan's plain disc, the solid sun
bodies on Kazakhstan, North Macedonia, Namibia, New Caledonia, Rwanda and Taiwan, the
faced disc on the Philippines, the ring around Kyrgyzstan's tunduk, and Palau's disc.

**No disc.** A sun rising at the horizon is a semicircle: Antigua and Barbuda,
Kiribati, Malawi. A starburst whose points meet with no body behind them is not a
disc either: the Marshall Islands, and Nepal's twelve-pointed sun. All 5 correctly
leave `circle` off.

**Three are missing it**, and are recorded below rather than edited in by hand. The
Sun of May on Argentina and Uruguay carries its face on an unmistakable round disc,
and Guadeloupe's sun is a large round body with the rays worked into its edge.

Ecuador is the one real question and is in `needs-a-human.tsv`: its sun is a small
faced disc high on an oval shield, round but barely a design element in its own right.

## Motifs the vocabulary does not cover

`tags` holds filter terms only, so an audit that sees a recurring motif with no term
has nowhere to put it and would otherwise drop the observation. Note it here instead,
with the flags it was seen on. Enough entries pointing the same way is the argument
for a new filter button, which is its own issue and its own PR — see #184. Do not
add the term to `js/filter-config.js` as part of an audit batch.

Nothing recorded yet.

## Candidates for the removal pass

Found while auditing, not acted on. Removals are their own round with their own
review:

- `mx` carries `flag`, and there is no flag depicted in the design.
- `pw` carries both `sun` and `moon` for a single yellow disc, and the flag's own
  `symbolism` says the disc is the full moon. There is nothing else on the flag.

## Additions found while settling the rules

The same as above, the other way round. Propose these in a batch rather than editing
by hand:

- `gp` depicts sugar cane — its `symbolism` says so — and carries no `vegetation`.
- `ar` and `uy` carry `sun` without `circle`, and the Sun of May's face sits on a
  closed round disc.
- `gp` carries `sun` without `circle`; the sun's body is a large round disc.
