# Concierge photography

Six photographs, one per category in `lib/local-info.ts`. Drop them in here
with exactly these names and they appear in both the pinned intro and the
grid — there is no code to change.

| file             | category      | what it should show                                   |
| ---------------- | ------------- | ----------------------------------------------------- |
| `smestaj.jpg`    | SMEŠTAJ       | hotel / apartment interior, warm lamps, made bed       |
| `restorani.jpg`  | RESTORANI     | a laid table or a dining room at night                 |
| `nonstop.jpg`    | NON-STOP SHOP | a lit twenty-four-hour shop seen from the street       |
| `prevoz.jpg`     | PREVOZ        | a taxi or an empty street after midnight               |
| `prva-pomoc.jpg` | PRVA POMOĆ    | a discreet clinic entrance or a lit pharmacy cross     |
| `kako-do-nas.jpg`| KAKO DO NAS   | the road into Inđija, headlights, a sign               |

Landscape, 3:2 or wider, 2000px on the long edge is plenty. The intro uses the
whole frame; the cards crop a square out of the middle, so keep the subject
away from the far left and right edges.

Until a file is here the card and the backdrop fall back to a drawn plate —
see `components/local-info/info-photo.tsx`.
