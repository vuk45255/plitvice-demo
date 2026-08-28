# The back bar

The logos that drift through the drinks band on the home page and, later, sit
beside their categories in the price list. The list itself — which brands, and
in what order — is `lib/drinks.ts`; this folder is only where the artwork goes.

Drop a file in here, then add `logo`, `width` and `height` to that brand:

```ts
{ name: "Belvedere", logo: "/pice/belvedere.svg", width: 420, height: 96 },
```

Until a brand has all three it is set as a wordmark in the house serif, which
is what the band is drawn around — a name engraved in the dark. A half-filled
entry (a `logo` with no size) falls back to the wordmark too, so a missing
number can never break the row.

| what        | how                                                              |
| ----------- | ---------------------------------------------------------------- |
| format      | transparent SVG, or transparent PNG at 2× the height it is shown |
| colour      | white or pale gold on nothing — the band dims it to about a third |
| trim        | crop the transparent margin off; the band sets its own spacing    |
| height used | roughly 26px on a phone, 36px on a wide screen                    |

Use the brand's own official mark. Nothing here is generated, traced or
downloaded from an image search.
