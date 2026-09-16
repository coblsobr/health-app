# Scan fixtures

Exported scans from the phone, used to fix the ingredients/directions split in
`lib/ocr.ts`. Drop the exported text in here as `.json` files — any filename.

## Why there are no photos here

The parser never sees a photo. It sees what ML Kit returned, which is what an
export contains: every line, and where that line sat on the page. Tuning
against a photo read by eye would fix problems the phone does not have.

The geometry also makes the photo mostly redundant — a page can be redrawn as a
wireframe from the coordinates, which is enough to see the column structure and
tell a heading from a body line.

A photo is worth asking for only when the OCR text itself looks wrong and the
question is whether the camera or the parser is at fault.

## Shape

One file holds a JSON array of scans:

```jsonc
[
  {
    "kind": "health-app-scan",
    "at": "2026-09-15T18:04:11.000Z",
    "pages": [
      {
        "w": 3000, "h": 4000,          // pixel size of the photo
        "lines": [
          { "t": "INGREDIENTS", "x": 210, "y": 880, "w": 460, "h": 52 }
          // t = text, x/y = top-left, w/h = size, all in image pixels
        ]
      }
    ],
    "parsed": {                         // what the parser made of it, i.e. what
      "name": null,                     // has to get better
      "servings": 4,
      "prepMin": 15,
      "cookMin": 40,
      "ingredients": ["2 tbsp olive oil"],
      "steps": ["Heat the oil."]
    }
  }
]
```

Lines arrive in ML Kit's block order, **not** reading order — that ordering is
part of what has to be handled, so it is preserved exactly as returned.
