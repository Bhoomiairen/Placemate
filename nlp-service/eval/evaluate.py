"""
Measure how accurately the rule-based extractor reads placement notices.

    python eval/evaluate.py            # summary
    python eval/evaluate.py -v         # also print every wrong field

Add your own real notices to eval/notices/ and their correct values to
eval/labels.json. The accuracy printed here is the number you can honestly
put on your resume ("X% field-level accuracy on N real notices").
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from extractor import IST, extract_notice  # noqa: E402

HERE = Path(__file__).resolve().parent
TODAY = datetime(2026, 9, 25, tzinfo=IST)  # fixed "today" so results are reproducible

FIELDS = ["company", "role", "ctcLpa", "minCgpa", "cgpaScale", "min10th", "min12th", "minGradPercent",
          "branches", "maxActiveBacklogs", "allowBacklogHistory", "graduationYears", "maxGapYears", "deadline"]


def flatten(result):
    flat = {**result, **result["criteria"]}
    flat["deadline"] = result["deadline"][:10] if result["deadline"] else None
    return flat


def correct(field, expected, got):
    if field in ("company", "role"):
        if expected is None:
            return got is None
        return got is not None and any(e.lower() in got.lower() for e in expected)
    if field in ("branches", "graduationYears"):
        return sorted(expected or []) == sorted(got or [])
    if isinstance(expected, (int, float)) and not isinstance(expected, bool) and got is not None and not isinstance(got, bool):
        return abs(float(expected) - float(got)) < 1e-6
    return expected == got


def main():
    verbose = "-v" in sys.argv
    labels = json.loads((HERE / "labels.json").read_text())
    per_field = {f: [0, 0] for f in FIELDS}
    total_ok = total = 0
    for name, expected in labels.items():
        if name.startswith("_"):
            continue
        result = flatten(extract_notice((HERE / "notices" / name).read_text(), today=TODAY))
        wrong = []
        for f in FIELDS:
            ok = correct(f, expected.get(f), result.get(f))
            per_field[f][0] += ok
            per_field[f][1] += 1
            total_ok += ok
            total += 1
            if not ok:
                wrong.append(f"    {f}: expected {expected.get(f)!r}, got {result.get(f)!r}")
        if verbose and wrong:
            print(name)
            print("\n".join(wrong))
    print(f"\n{'Field':<22}Accuracy")
    for f, (ok, n) in per_field.items():
        print(f"{f:<22}{ok}/{n}  ({ok / n:.0%})")
    notices = sum(1 for k in labels if not k.startswith("_"))
    print(f"\nOverall field-level accuracy: {total_ok}/{total} = {total_ok / total:.1%} on {notices} notices")


if __name__ == "__main__":
    main()
