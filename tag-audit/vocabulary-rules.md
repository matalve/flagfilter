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
one as a tag, and do not propose removing one from `aliases`. Adding one is allowed
for plain emblems; see *Aliases for plain emblems* below. See #184 and #203.

## Rules

**`vertical` and `horizontal` describe how the field is cut.** Count the parts the
field is divided into, not the coloured bands. Turkmenistan is green, red and green
from the hoist: three side-by-side parts, so it is `vertical`, even though only one
part is red. What does not count is a band that stripes of the other orientation run
into, wherever it sits: Benin, the Central African Republic and Guinea-Bissau are
`horizontal` and nothing else, and so are the United Arab Emirates and Madagascar.

When a coat of arms is the flag, its partitions count as the flag's if they are
prominent. Saint Barthélemy's shield is cut into three horizontal parts, and that is
most of what you see, so the flag is `horizontal`.

**A figure people read as a star keeps `star`.** Saint Barthélemy's white figure is
heraldically a Maltese cross, but it looks enough like a star that people searching for
one expect to find the flag. An alias cannot do this job: the search reads "star" as
the star filter, so only the tag makes the flag turn up.

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

The rules below name flags as examples and do not count them, because every batch
changes the counts. Before a batch, check that each rule still holds across
`flaginfo.json`. Every one did when tranche 3 was applied.

**These imply the broader tag. Always propose both.**

- `bird` implies `animal`. Every bird flag carries both.
- `motto` implies `text`, and so does `name`. Every motto flag and every name flag
  carries `text` as well.

**These do not imply anything, and the broader tag is a separate finding.**

- `crown` is not a `hat`. A crown is regalia, not headwear, and no crown flag
  carries `hat`. Whether a bishop's mitre is a `hat` is still open, in
  `needs-a-human.tsv`.
- `hand` is not `human`, and neither is `face` or `hat`. A body part or a garment
  standing alone is not a person: Brunei's hands, the Red Hand of Ulster, the Sun of
  May's face on Argentina and Uruguay, the hats on Haiti, Lesotho, Nicaragua and El
  Salvador. `human` is for a figure
  depicted as a figure, which is why only Belize, Montserrat and the British Virgin
  Islands carry it. Belize is the one flag with both `face` and `human`, and it earns
  both: the faces belong to the two figures.
- `shield` is not `weapon`. Most shield flags carry no weapon. The ones that carry
  both, Kenya, Eswatini and the US Virgin Islands, have a weapon elsewhere in the
  design.
- `moon` is not `circle`. A crescent is not a circle, and the flags carrying both
  earn it from a disc. Palau's disc is the full moon drawn as a disc, Cocos has a
  circular palm-tree badge beside its crescent, and Tunisia's crescent sits inside a
  white disc. So `circle` goes on a disc, not on the idea of a moon.
- `fleur-de-lis` is not `vegetation`. It is a stylised lily, but it is carried as a
  heraldic charge, and no flag derives `vegetation` from it. Spain and Guadeloupe
  carry both for plants of their own: the pomegranate of Granada in Spain's arms, and
  Guadeloupe's sugar cane.

**An object that is two things still gets both tags** — see the axe rule above. That
is co-classification, not hierarchy: neither `tool` nor `weapon` contains the other,
and the object earns both on its own merits.

## `sun` and `circle`: the drawing decides, not the word

A sun earns `circle` when the design holds a closed round disc, and not otherwise.
Same reading as the `moon` rule above: `circle` goes on a shape, not on an idea. When
the rule was written the counts looked like a coin flip, 10 flags with both and 9 with
only `sun`, but the split was mostly the rule already working, not drift.

**A disc is there.** Every sun flag with `circle` has a real disc: Japan's plain disc;
the solid sun bodies on Kazakhstan, North Macedonia, Namibia, New Caledonia, Rwanda
and Taiwan; the faced discs of the Sun of May on Argentina and Uruguay and of the
Philippines; the ring around Kyrgyzstan's tunduk; Palau's disc; and the round emblem
of French Polynesia.

**No disc.** A sun rising at the horizon is a semicircle: Antigua and Barbuda,
Kiribati, Malawi, and the sun in Costa Rica's arms. A starburst whose points meet with
no body behind them is not a disc either: the Marshall Islands, and Nepal's
twelve-pointed sun.

**Decided in review.** Guadeloupe's sun is a large round body with the rays worked into
its edge. It was proposed for `circle` and declined, so it stays without one.

Ecuador is the one open question and is in `needs-a-human.tsv`. Its sun is a small
faced disc high on an oval shield, round but barely a design element in its own right.

## Colours: what someone would describe, not every tincture

A colour counts when it is how someone would describe what they saw. That covers
three things:

- **The flag's own fields and bands, and any plain emblem on them.** Barbados's trident
  is black, Venezuela's stars are white, Malaysia's crescent is yellow. Someone
  searching for "black trident" is describing the flag, so `black` belongs on it.
- **A coat of arms that is the flag.** Saint Barthélemy is a white field with its arms
  on it, and the arms are what anyone sees. Their blue, red and yellow are the flag's
  colours.
- **A colour that stands out, even inside a coat of arms.** The shield on Turks and
  Caicos is solid yellow and large enough to be the first thing you notice, so
  `yellow` belongs on the flag.

What does not count is detail. Nobody describes Ecuador by the green of the grass in
its arms. Tagging every tincture in every coat of arms would put arms-bearing flags in
nearly every colour filter, and a filter that returns everything helps nobody.

When unsure, ask whether the colour would appear in a one-line description of the
flag. "Blue, white and red stripes with a coat of arms" does not name the grass.

## Aliases for plain emblems

Propose an alias when a flag carries a plain emblem that people would search for by
name, and no filter term covers it. The trident on Barbados is the model: it is the
whole emblem and the word someone half remembering the flag would type, and with
`black` on the flag, a search for "black trident" finds it.

The row looks like any other, with `alias` as the action and the word in the tag
column:

    Barbados	bb	trident	alias	high	The emblem is a black trident.

- **Plain emblems only**, by the same test as the colour rule: would the word appear
  in a one-line description of the flag? Lebanon's cedar and Canada's maple leaf
  pass. The charges inside a detailed coat of arms do not.
- **Not a filter term.** The search reads a filter term in a query as the filter, so
  an alias like `star` or `bird` could never match. The script refuses one.
- **Lower case**, like the existing aliases. Several words are fine: `maple leaf`.
- **Several of something: both singular and plural.** Mayotte has two seahorses, so it
  gets `seahorse` and `seahorses`. Today the plural alone would match both, because the
  search checks whether the query is part of an alias. Writing both does not depend on
  that, and irregular plurals (`leaf`, `leaves`) need both anyway.
- **What people think they see counts too.** Lebanon's cedar is often taken for a
  pine, so it gets `pine` beside `cedar`. It is the same reasoning that keeps Saint
  Barthélemy's `star`.
- **Add only.** Removing an alias is not the audit's call.
- **A word that fits many flags** is a motif as much as an alias. Propose the aliases,
  and note it in the next section too: enough flags pointing the same way is the
  argument for a filter button instead.

## Motifs the vocabulary does not cover

`tags` holds filter terms only, so an audit that sees a recurring motif with no term
has nowhere to put it and would otherwise drop the observation. Note it here instead,
with the flags it was seen on. Enough entries pointing the same way is the argument
for a new filter button, which is its own issue and its own PR — see #184. Do not
add the term to `js/filter-config.js` as part of an audit batch.

- **eagle**: American Samoa (alias proposed in tranche 3), Serbia (tranche 2, no
  alias). Mexico, Egypt, Albania and others are still to come.
- **lion**: Jersey, Bermuda, and Sri Lanka still to come. So far always inside a
  shield, so not proposed as an alias.
- **flower**: Hong Kong (alias proposed). Macau's lotus is still to come.

## Candidates for the removal pass

Found while auditing, not acted on. Removals are their own round with their own
review:

- `mx` carries `flag`, and there is no flag depicted in the design.
- `pw` carries both `sun` and `moon` for a single yellow disc, and the flag's own
  `symbolism` says the disc is the full moon. There is nothing else on the flag.
- `pf` carries `star` for the five figures on the canoe. They are X-shaped (stylised
  people for the five archipelagos) and do not read as stars, so the rule that keeps
  Saint Barthélemy's `star` does not obviously cover them.
- `sh` carries `brown`, and the only brown is the cliffs inside the shield. By the
  colour rule that is detail.

## Additions found while settling the rules

The same as above, the other way round. Propose these in a batch rather than editing
by hand:

Nothing waiting.
