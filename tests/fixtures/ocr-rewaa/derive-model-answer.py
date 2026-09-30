"""Derive model-answer.json from source.xlsx + correct-output.xlsx.

Run from this directory:  python derive-model-answer.py   (needs openpyxl)

The answer is shaped like what the live model returned in the wrong run
(wrong-output.xlsx): `Arabic | English` on every translated field, the two
size pairs (waffle sticks, Keylah platter) as plain Simple rows with no
option, no SKUs, blank Description. Only the English WORDING is taken from the
contract, because translation is the model's job, not the pipeline's.

One exception: a source name with no Arabic (`v60`) is given as the contract
has it (`V60 | v60`). The pipeline cannot invent that translation, and with
two Latin parts there is no language order for it to fix.
"""
import json, re, sys
import openpyxl

sys.stdout.reconfigure(encoding="utf-8")
ARABIC = re.compile(r"[؀-ۿ]")


def rows(path, sheet):
    it = openpyxl.load_workbook(path)[sheet].iter_rows(values_only=True)
    head = next(it)
    return [dict(zip(head, r)) for r in it]


def as_model(correct, original, allow_suffix=False):
    """`English | original[ X]` in the contract → `original | English`, checked."""
    if not ARABIC.search(original):
        return re.sub(r" [A-Z]\d*$", "", correct) if allow_suffix else correct
    en, rest = correct.split(" | ", 1)
    ok = rest == original or (allow_suffix and re.fullmatch(re.escape(original) + r" [A-Z]\d*", rest))
    if not ok:
        raise SystemExit(f"cannot derive: {correct!r} from {original!r}")
    return f"{original} | {en}"


src = rows("source.xlsx", "Scraped Data")
correct = rows("correct-output.xlsx", "Generic All Data")
out = []
for s, c in zip(src, correct, strict=True):
    has_option = bool(s["Option 1"])
    out.append({
        "Product SKU": "",
        "Product Name": as_model(c["Product Name"], s["Name"], allow_suffix=True),
        "Description": "",
        "Category": as_model(c["Category"], s["Category"]),
        "Retail Price": s["Price"] or "",
        "Type": s["Type"],
        "Enable stock management": "no",
        "Option 1": as_model(c["Option 1 Name"], s["Option 1"]) if has_option else "",
        "Option 1 Value": as_model(c["Option 1 Value"], s["Option 1 Value"]) if has_option else "",
        "Option 2": "", "Option 2 Value": "", "Option 3": "", "Option 3 Value": "",
        "Variant SKU": "",
    })

with open("model-answer.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write("\n")
print(f"{len(out)} rows written")
