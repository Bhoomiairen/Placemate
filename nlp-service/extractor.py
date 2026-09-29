"""
Rule-based extraction of eligibility criteria from campus placement drive notices.

Placement notices arrive as PDFs, emails and WhatsApp forwards, and every company
writes them differently:

    "CGPA >= 7, 10th & 12th >= 60%, no active backlogs"
    "Minimum 60% in X and XII. 7.0 CGPA and above in B.Tech."
    "Class X: 65%, Class XII/Diploma: 60%, Graduation: 6.5 CGPA (out of 10)"

This module turns that free text into structured fields. Every field also keeps
the line it came from ("evidence") so the user can check the extraction in the UI
before saving it.

Main entry point: extract_notice(text) -> dict
"""

import re
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

# --------------------------------------------------------------------------
# Text helpers
# --------------------------------------------------------------------------

_REPLACEMENTS = {
    "≥": ">=", "⩾": ">=", "≤": "<=", "–": "-", "—": "-", "−": "-",
    "\u00a0": " ", "’": "'", "“": '"', "”": '"', "&amp;": "&", "\t": " ",
}


def normalize(text: str) -> str:
    for a, b in _REPLACEMENTS.items():
        text = text.replace(a, b)
    text = re.sub(r"[ ]{2,}", " ", text)
    return text.strip()


def _lines(text: str) -> list[str]:
    """Split into lines; also break very long lines on ';' and '•' so rules see one clause at a time."""
    out = []
    for line in text.split("\n"):
        for part in re.split(r"\s*[;•●▪]\s*", line):
            part = part.strip(" -*\u2022")
            if part:
                out.append(part)
    return out


def _snippet(line: str) -> str:
    line = line.strip()
    return line if len(line) <= 160 else line[:157] + "..."


def _num(s: str) -> float:
    return float(s.replace(",", ""))


# --------------------------------------------------------------------------
# Company, role, location, CTC
# --------------------------------------------------------------------------

_LABEL_SEP = r"\s*(?:[:\-|]|=)\s*"


def _clean_name(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip(" .,:-|*\"'")
    s = re.sub(r"^(?:subject|sub|re|fwd?|fw)\s*:\s*", "", s, flags=re.I)
    s = re.sub(r"\s*[-|(]?\s*(?:20\d\d\s*batch|campus (?:recruitment|placement|drive)|recruitment drive|placement drive|hiring drive|on[- ]campus|off[- ]campus|pool campus|drive)\)?\s*$", "", s, flags=re.I)
    return s.strip(" .,:-|*\"'")[:80]


def extract_company(lines):
    label = re.compile(r"^(?:company|company name|organi[sz]ation|employer|recruiter|name of (?:the )?company)" + _LABEL_SEP + r"(.+)$", re.I)
    for line in lines:
        m = label.match(line)
        if m and _clean_name(m.group(1)):
            return _clean_name(m.group(1)), line

    words = r"(?:(?:on[- ]|off[- ])?campus|placement|recruitment|hiring|pool|internship)"
    patterns = [
        # "Campus Recruitment Drive - Infosys" / "Placement Notice: TCS Digital"
        (re.compile(r"^(?:subject\s*:\s*)?(?:" + words + r"\s+)*(?:drive|notice|announcement|update|opportunity)" + _LABEL_SEP + r"(.+)$", re.I), 15),
        # "... drive of Wipro" / "recruitment drive by Capgemini"
        (re.compile(r"(?:drive|recruitment|hiring)\s+(?:by|of|from)\s+([A-Z][\w&.'\-]*(?:\s+[A-Z][\w&.'\-]*){0,4})"), 15),
        # "Deloitte is hiring..." / "Accenture is visiting our campus"
        (re.compile(r"^([A-Z][\w&.'\- ]{1,50}?)\s+(?:is|are|will be)\s+(?:hiring|visiting|conducting|coming|recruiting)", re.I), 15),
        # "Infosys Campus Recruitment Drive 2027" / "Subject: Harbor Logistics Recruitment Drive"
        (re.compile(r"^(?:subject\s*:\s*)?(.+?)\s+(?:" + words + r"\s+)*(?:recruitment|placement|hiring|campus)\s+(?:drive|process|notice)", re.I), 15),
        # "Please find below details for Tidewater Engineering."
        (re.compile(r"details (?:for|of|regarding)\s+(?:the\s+)?([A-Z][\w&.'\-]*(?:\s+[A-Z][\w&.'\-]*){0,4})"), 15),
        # First lines only: "Quanta Semiconductors - Hiring", "Crest Insights - Analyst Hiring", "Lumen Fintech Internship + PPO"
        (re.compile(r"^(.+?)\s*[-|:]\s*(?:[A-Za-z/&]+\s+){0,3}(?:hiring|recruitment|drive)\b", re.I), 3),
        (re.compile(r"^(.+?)\s*[-|:]\s*(?:" + words + r"|drive)\b", re.I), 3),
        (re.compile(r"^([A-Z][\w&.' ]{1,40}?)\s+(?i:internship|hiring|recruitment)\b"), 3),
    ]
    generic = re.compile(r"^(?:dear|hello|hi|greetings|all|students|the|we|our|this|campus|placement|recruitment|hiring|pool|notice|drive|on[- ]campus|off[- ]campus)\b", re.I)
    for p, max_line in patterns:
        for line in lines[:max_line]:
            m = p.search(line)
            if m:
                name = _clean_name(m.group(1))
                if name and not generic.match(name) and len(name.split()) <= 6:
                    return name, line
    return None, None


def extract_role(lines):
    label = re.compile(r"^(?:job\s+)?(?:role|roles|profile|designation|position|job title|post|job role)(?:\s+offered)?" + _LABEL_SEP + r"(.+)$", re.I)
    for line in lines:
        m = label.match(line)
        if m:
            return m.group(1).strip(" .")[:80], line
    inline = [
        re.compile(r"for the (?:role|position|post|profile) of\s+(?:an?\s+)?([A-Za-z][\w/&().\- ]{2,60}?)(?=[.,;\n]| at | in | with |$)", re.I),
        # "visiting for Technology Analyst roles", "pool campus drive for Associate Consultant."
        re.compile(r"(?:drive|visiting|recruiting|recruitment|hiring|conducting)\s+for\s+(?:the\s+)?([A-Z][\w/&\- ]{2,50}?)(?:\s+(?:roles?|positions?|posts?|profiles?))?(?=\s*[.!,;(]|\s+(?:at|in|from|with)\b|$)"),
        # "Crest Insights - Analyst Hiring"
        re.compile(r"^[^\n]{2,60}?\s-\s([A-Z][\w/&\- ]{2,40}?)\s+(?:Hiring|Recruitment|Drive)\b"),
        # "is hiring ML Engineers!"
        re.compile(r"(?:is|are)\s+hiring\s+([A-Z][\w/&\- ]{2,50}?)(?=\s*[.!,;(]|\s+(?:from|for|in|at|with)\b|$)"),
    ]
    for rx in inline:
        for line in lines:
            m = rx.search(line)
            if m:
                return m.group(1).strip(), line
    return None, None


def extract_location(lines):
    label = re.compile(r"^(?:job |work |posting |joining )?locations?" + _LABEL_SEP + r"(.+)$", re.I)
    for line in lines:
        m = label.match(line)
        if m:
            return m.group(1).strip(" .")[:80], line
    return None, None


_LPA_UNIT = r"(?:lpa|l\.p\.a\.?|lakhs?|lacs?|lakh per annum|lpa\b)"


def extract_ctc(lines):
    """Returns (ctc_min_lpa, ctc_max_lpa, stipend_per_month, evidence_line)."""
    ctc_min = ctc_max = stipend = None
    evidence = None
    money_line = re.compile(r"ctc|package|salary|compensation|lpa|lakh|lac|stipend|remuneration|pay|inr|rs\.?|₹", re.I)
    for line in lines:
        if not money_line.search(line):
            continue
        low = line.lower()
        is_monthly = bool(re.search(r"per month|/\s*month|p\.?m\.?\b|monthly|/-\s*pm", low))
        is_stipend = "stipend" in low or (is_monthly and "ctc" not in low)

        # Range in LPA: "6 - 8 LPA", "6 to 8 lakhs"
        m = re.search(r"(\d{1,2}(?:\.\d{1,2})?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d{1,2})?)\s*" + _LPA_UNIT, low)
        if m and not is_stipend and ctc_min is None:
            ctc_min, ctc_max, evidence = _num(m.group(1)), _num(m.group(2)), line
            continue
        # Single LPA value: "CTC: 7.5 LPA"
        m = re.search(r"(\d{1,3}(?:\.\d{1,2})?)\s*" + _LPA_UNIT, low)
        if m and ctc_min is None and (not is_stipend or "ctc" in low):
            ctc_min, evidence = _num(m.group(1)), line
            if not is_stipend:
                continue  # a stipend line can hold both ("Stipend Rs 20,000 p.m., CTC 5 LPA")
        # Full rupee amount: "INR 7,00,000 per annum", "Rs. 25,000/- per month"
        m = re.search(r"(?:inr|rs\.?|₹)\s*([\d,]{4,}(?:\.\d+)?)", low) or re.search(r"([\d,]{5,})\s*(?:/-|inr|rupees)", low)
        if m:
            amount = _num(m.group(1))
            if is_stipend or is_monthly:
                if stipend is None:
                    stipend = amount
                    evidence = evidence or line
            elif ctc_min is None and amount >= 100000:
                ctc_min, evidence = round(amount / 100000, 2), line
    return ctc_min, ctc_max, stipend, evidence


# --------------------------------------------------------------------------
# CGPA
# --------------------------------------------------------------------------

_CG = r"(?:cgpa|cpi|cgpi|gpa|pointer|c\.g\.p\.a\.?)"
_NUM = r"(\d{1,2}(?:\.\d{1,2})?)"


def extract_cgpa(lines):
    """Returns (min_cgpa, scale, evidence). Scale is 10 or 4."""
    no_bar = re.compile(_CG + r"[^\n]{0,20}\b(?:no bar|no criteria|no cut-?off|not applicable|n/a|none)|no\s+" + _CG + r"\s+(?:criteria|cut-?off|bar|requirement)", re.I)
    after = re.compile(_CG + r"(?:\s*\(\s*out of (10|4)\s*\))?[^\d\n%]{0,45}?" + _NUM + r"(?:\s*/\s*(10|4)(?:\.0)?\b)?", re.I)
    before = re.compile(_NUM + r"(?:\s*/\s*(10|4)(?:\.0)?)?\s*\+?\s*(?:and above\s+|or above\s+|& above\s+)?" + _CG, re.I)
    for line in lines:
        low = line.lower()
        if not re.search(_CG, low):
            continue
        if no_bar.search(low):
            return None, None, line
        # Try "7 CGPA" first (number directly before), then "CGPA ... 7"
        for m, value_group, scale_groups in ((before.search(low), 1, (2,)), (after.search(low), 2, (1, 3))):
            if not m:
                continue
            value = _num(m.group(value_group))
            scale = next((int(m.group(g)) for g in scale_groups if m.group(g)), None)
            if re.search(r"out of 4|/\s*4\b|4[- ]point", low):
                scale = scale or 4
            if scale is None:
                scale = 4 if value <= 4 else 10
            if (scale == 10 and 4 <= value <= 10) or (scale == 4 and 1.5 <= value <= 4):
                return value, scale, line
    return None, None, None


# --------------------------------------------------------------------------
# Percentages: 10th / 12th / Diploma / Graduation
# --------------------------------------------------------------------------

_LEVELS = {
    "10th": r"10\s*th|tenth|\bssc\b|\bsslc\b|\bmatric(?:ulation)?\b|(?:class|std\.?|standard|grade)\s*(?:x|10)\b|\bxth\b|\bx\b(?=\s*(?:&|and|,|/)\s*(?:xii|12))",
    "12th": r"12\s*th|twelfth|\bhsc\b|\bhssc\b|(?:class|std\.?|standard|grade)\s*(?:xii|12)\b|\bxiith\b|\bxii\b|higher secondary|\bintermediate\b|\bpuc\b",
    "diploma": r"diploma",
    "grad": r"graduation|\bug\b|b\.?\s?tech|\bb\.?\s?e\.?\b|\bbe\b|degree|engineering|aggregate|\bcurrent course\b",
}
_LEVEL_RES = {k: re.compile(v, re.I) for k, v in _LEVELS.items()}
_PERCENT = re.compile(r"(\d{2}(?:\.\d{1,2})?)\s*(?:%|percent\b|percentage\b)", re.I)
_THROUGHOUT = re.compile(r"throughout|all (?:academics|semesters|examinations|exams)|across (?:all|academics)|consistently", re.I)
_JOINER = re.compile(r"^\s*(?:,|&|and|/|or|\s)*\s*$", re.I)
_P_THEN_M = re.compile(r"^\s*(?:and above|or above|or more|marks)?\s*(?:in|for|at)\s", re.I)
_MONEY_WORDS = re.compile(r"ctc|salary|package|variable|bonus|stipend|hike|lpa|lakh|increment|discount|fee|attendance", re.I)
_TIGHT_GAP = re.compile(r"^\s*(?:\)|of|with|min(?:imum)?\.?|at ?least|marks?|score|percentage|aggregate|and above|>=|>|=|:|-|\(|\s)*\s*$", re.I)


def extract_percentages(lines):
    """Returns ({"10th": 60.0, "12th": 60.0, ...}, {level: evidence_line})."""
    result, evidence = {}, {}

    def assign(level, value, line):
        if level not in result and 35 <= value <= 100:
            result[level] = value
            evidence[level] = line

    for line in lines:
        if _MONEY_WORDS.search(line):
            continue
        percents = [(m.start(), m.end(), _num(m.group(1))) for m in _PERCENT.finditer(line)]
        if not percents:
            continue
        mentions = []
        for level, rx in _LEVEL_RES.items():
            for m in rx.finditer(line):
                mentions.append((m.start(), m.end(), level))
        mentions.sort()

        if not mentions:
            if _THROUGHOUT.search(line):
                for level in ("10th", "12th", "grad"):
                    assign(level, percents[0][2], line)
            continue

        tokens = sorted([(s, e, "M", lvl) for s, e, lvl in mentions] + [(s, e, "P", v) for s, e, v in percents])

        # Pass 1: "Class X: 65%" style tight pairs (mention immediately followed by a percent)
        used = set()
        for i in range(len(tokens) - 1):
            a, b = tokens[i], tokens[i + 1]
            follows = tokens[i + 2] if i + 2 < len(tokens) else None
            # "aggregate of 60% in 10th, 12th" -> the percent belongs to the mentions after it
            if follows and follows[2] == "M" and _P_THEN_M.match(line[b[1]:follows[0]]):
                continue
            if a[2] == "M" and b[2] == "P" and _TIGHT_GAP.match(line[a[1]:b[0]]):
                # a run of mentions right before this percent all share it ("10th & 12th: 60%")
                j = i
                while j >= 0 and tokens[j][2] == "M" and j not in used:
                    assign(tokens[j][3], b[3], line)
                    used.add(j)
                    sep = line[tokens[j - 1][1]:tokens[j][0]] if j else ""
                    earlier_percent = any(t[2] == "P" for t in tokens[:j])
                    if j == 0 or not re.fullmatch(r"\s*(?:&|and|/|or)\s*" if earlier_percent else r"\s*(?:&|and|,|/|or)\s*", sep):
                        break
                    j -= 1
                used.add(i + 1)

        # Pass 2: everything else ("60% in 10th and 12th", "10th and 12th - above 60%")
        pending, last_p, prev_end = [], None, 0
        for idx, (s, e, kind, val) in enumerate(tokens):
            gap = line[prev_end:s]
            prev_end = e
            if idx in used:
                if kind == "P":
                    pending, last_p = [], None
                continue
            if kind == "M":
                # "60% in 10th and 12th": the percent carries over only through joiners like "and", ","
                prev_kind = tokens[idx - 1][2] if idx else None
                if last_p is not None and ((prev_kind == "P" and re.fullmatch(r"(?:(?!\.\s|[:;]).){0,25}", gap)) or (prev_kind == "M" and _JOINER.match(gap))):
                    assign(val, last_p, line)
                else:
                    last_p = None
                    pending.append(val)
            else:
                nxt = tokens[idx + 1] if idx + 1 < len(tokens) else None
                carries_forward = nxt is not None and nxt[2] == "M" and _P_THEN_M.match(line[e:nxt[0]])
                if pending:
                    for lvl in pending:
                        assign(lvl, val, line)
                    pending = []
                    last_p = val if carries_forward else None
                else:
                    last_p = val

        if _THROUGHOUT.search(line) and percents:
            for level in ("10th", "12th", "grad"):
                assign(level, percents[0][2], line)
    return result, evidence


# --------------------------------------------------------------------------
# Branches
# --------------------------------------------------------------------------

BRANCHES = {
    "CSE": [r"(?<!electronics and )(?<!electronics & )computer science(?! (?:and|&) business)(?: (?:and|&) engineering)?", r"computer engineering", r"\bcse\b", r"\bcomps?\b", r"\bcomputers?\b(?! (?:science|engineering))", r"(?-i:\bCS\b)", r"\bcs(?:e)?\s*/"],
    "IT": [r"information technology", r"(?-i:\bIT\b)", r"\bi\.t\.?\b"],
    "ECE": [r"electronics (?:and|&) tele-?communications?", r"electronics (?:and|&) communications?", r"\bextc\b", r"\bentc\b", r"\be ?& ?tc\b", r"\bece\b", r"\betc\b(?=\s*(?:,|/|and|&|\)))", r"\belectronics\b(?! (?:and|&) (?:electrical|computer))"],
    "EEE": [r"electrical(?: (?:and|&) electronics)?(?: engineering)?", r"\beee\b", r"(?-i:\bEE\b)"],
    "MECH": [r"mechanical", r"\bmech\b"],
    "CIVIL": [r"\bcivil\b"],
    "CHEM": [r"chemical"],
    "AI-ML": [r"artificial intelligence(?: (?:and|&) (?:machine learning|data science))?", r"\bai ?(?:&|and|/|-)? ?ml\b", r"\baiml\b", r"\bai ?(?:&|and|/|-)? ?ds\b", r"\baids\b"],
    "DATA-SCIENCE": [r"data science", r"\bds\b(?=\s*(?:,|/|and|&|\)))"],
    "ECS": [r"electronics (?:and|&) computer science", r"\becs\b"],
    "CSBS": [r"\bcsbs\b", r"computer science (?:and|&) business systems"],
    "MBA-TECH": [r"mba\s*\(?tech\)?", r"\bmbatech\b"],
}
_BRANCH_RES = {code: [re.compile(p, re.I) for p in pats] for code, pats in BRANCHES.items()}
_ALL_BRANCHES = re.compile(r"all (?:the )?(?:engineering )?(?:branches|streams|disciplines|departments|specializations)|any (?:branch|stream|discipline)|open (?:to|for) all|no branch (?:bar|restriction)|all b\.?\s?tech|all b\.?\s?e\b", re.I)
_CIRCUIT = re.compile(r"circuit (?:branches|streams)|circuital", re.I)
_ALLIED = re.compile(r"allied|related (?:branches|streams|disciplines)", re.I)
_BRANCH_CONTEXT = re.compile(r"branch|stream|discipline|department|eligib|criteria|students only|only\b|b\.?\s?tech|\bb\.?\s?e\b|degree|courses?|specialization|qualification|who can apply|open (?:to|for)", re.I)


def extract_branches(lines):
    """Returns (list_of_branch_codes | ["ALL"] | [], evidence)."""
    for i, line in enumerate(lines):
        if not _BRANCH_CONTEXT.search(line):
            continue
        # A heading like "Eligible Branches:" often has the list on the next lines.
        window = [line] + (lines[i + 1:i + 4] if len(line) < 40 or line.rstrip().endswith(":") else [])
        text = " ".join(window)
        if _ALL_BRANCHES.search(text):
            return ["ALL"], line
        found = [code for code, patterns in _BRANCH_RES.items() if any(p.search(text) for p in patterns)]
        # "Circuit branches" with no explicit list -> the usual circuit set
        if _CIRCUIT.search(text) and not found:
            found = ["CSE", "IT", "ECE", "EEE", "AI-ML", "DATA-SCIENCE"]
        if _ALLIED.search(text) and ("CSE" in found or "IT" in found):
            found += ["AI-ML", "DATA-SCIENCE", "CSBS"]
        if found:
            matched = [w for w in window if any(p.search(w) for ps in _BRANCH_RES.values() for p in ps)]
            return sorted(set(found)), " / ".join(_snippet(w) for w in matched) or line
    return [], None


# --------------------------------------------------------------------------
# Backlogs, gap years, batch
# --------------------------------------------------------------------------

_BL = r"(?:backlogs?|arrears?|atkts?|\bkts?\b|re-?attempts?)"


def extract_backlogs(lines):
    """Returns (max_active_backlogs, allow_backlog_history, evidence)."""
    max_active, allow_history, evidence = None, None, None
    for line in lines:
        low = line.lower()
        if not re.search(_BL, low):
            continue
        # History rules
        if re.search(r"no (?:history of|past|previous|dead) " + _BL + r"|no " + _BL + r" (?:history|ever|at any (?:point|time|stage))|" + _BL + r" history (?:is )?not (?:allowed|accepted|acceptable)|never had any " + _BL + r"|should not have had any " + _BL, low):
            allow_history, evidence = False, evidence or line
        elif re.search(r"(?:history of|past|previous|cleared|dead) " + _BL + r"[^.]{0,30}(?:allowed|accepted|acceptable|permitted|ok|fine|can apply)|" + _BL + r" history (?:is )?(?:allowed|accepted|acceptable|permitted)", low):
            allow_history, evidence = True, evidence or line

        # Active backlog limits
        m = re.search(r"(?:max(?:imum)?\.?|up ?to|not more than|at most|<=)\s*(\d)\s*(?:dead |cleared |past )" + _BL, low)
        if m:
            allow_history, evidence = True, evidence or line  # a limit on past backlogs means history is allowed
        m = re.search(r"(?:max(?:imum)?\.?|up ?to|not more than|at most|<=)\s*(\d)\s*(?:active |live |current |pending |ongoing )?" + _BL, low) \
            or re.search(r"(\d)\s*(?:active |live |current |pending )?" + _BL + r"\s*(?:is |are )?(?:allowed|permitted|acceptable)", low) \
            or re.search(r"(?:active |live |current )?" + _BL + r"\s*(?:allowed)?\s*[:\-=]\s*(\d)\b", low)
        if m and max_active is None:
            max_active, evidence = int(m.group(1)), evidence or line
            continue
        if max_active is None and re.search(
            r"no (?:active |live |current |pending |outstanding |ongoing |standing )?" + _BL
            + r"|(?:zero|nil|0) (?:active |live |current )?" + _BL
            + r"|should not have (?:any )?(?:active |live |current |pending )?" + _BL
            + r"|without (?:any )?(?:active |live )?" + _BL
            + r"|all (?:subjects|exams|semesters) cleared"
            + r"|" + _BL + r"\s*(?:are |is )?not (?:allowed|permitted|accepted)"
            + r"|" + _BL + r"\s*[:\-]\s*(?:nil|none|not allowed|no)\b", low):
            # "no backlog history" is about history, not active ones - but it implies no active ones too
            max_active, evidence = 0, evidence or line
    if allow_history is False and max_active is None:
        max_active = 0  # never had a backlog -> certainly none active
    return max_active, allow_history, evidence


def extract_gap(lines):
    for line in lines:
        low = line.lower()
        if "gap" not in low:
            continue
        m = re.search(r"(?:max(?:imum)?\.?|up ?to|not more than|at most)\s*(\d)\s*(?:years?|yrs?)", low) or re.search(r"gap of (?:up ?to |max(?:imum)? )?(\d)\s*(?:years?|yrs?)", low) or re.search(r"(\d)\s*(?:years?|yrs?)\s*(?:of )?(?:education(?:al)? )?gap", low)
        if m:
            return int(m.group(1)), line
        if re.search(r"no (?:education(?:al)? |academic |year )?gaps?|gaps? (?:in (?:education|studies|academics) )?(?:are |is )?not (?:allowed|acceptable|permitted)|without (?:any )?gap|continuous education", low):
            return 0, line
    return None, None


def extract_batch(lines):
    years, evidence = set(), None
    rx = re.compile(r"(?:batch|pass(?:ing)?[\s-]*outs?|year of (?:passing|graduation)|\byop\b|graduating(?: in| year)?|graduates|class of)", re.I)
    for line in lines:
        if not rx.search(line):
            continue
        found = re.findall(r"\b(20[2-3]\d)\b", line)
        if found:
            years.update(int(y) for y in found)
            evidence = evidence or line
    return sorted(years), evidence


# --------------------------------------------------------------------------
# Dates
# --------------------------------------------------------------------------

_MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_MON = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"


def parse_date(text: str, today: datetime):
    """Find the first date in a string. Day-first (Indian format). Returns a datetime in IST or None."""
    low = text.lower()
    day = month = year = None
    for rx, order in (
        (re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?[\s\-/.,]*(?:of\s+)?" + _MON + r"[\s,\-/.']*(\d{4}|\d{2}(?!\d|\s*(?:am|pm|:)))?"), "dmy"),
        (re.compile(_MON + r"\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)(?:,?\s*(\d{4}))?"), "mdy"),
        (re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b"), "num"),
    ):
        m = rx.search(low)
        if not m:
            continue
        try:
            if order == "dmy":
                day, month, year = int(m.group(1)), _MONTHS[m.group(2)[:3]], m.group(3)
            elif order == "mdy":
                month, day, year = _MONTHS[m.group(1)[:3]], int(m.group(2)), m.group(3)
            else:
                day, month, year = int(m.group(1)), int(m.group(2)), m.group(3)
        except (KeyError, ValueError):
            continue
        break
    if day is None:
        return None
    if year:
        year = int(year)
        year = year + 2000 if year < 100 else year
    hour, minute = 23, 59
    t = re.search(r"\b(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)\b", low) or re.search(r"\b(\d{1,2}):(\d{2})\s*(?:hrs|hours)?\b", low)
    if t:
        hour, minute = int(t.group(1)), int(t.group(2) or 0)
        if len(t.groups()) >= 3 and t.group(3):
            if t.group(3) == "pm" and hour < 12:
                hour += 12
            if t.group(3) == "am" and hour == 12:
                hour = 0
    try:
        if year is None:
            candidate = datetime(today.year, month, day, hour, minute, tzinfo=IST)
            if candidate < today - timedelta(days=60):
                candidate = candidate.replace(year=today.year + 1)
            return candidate
        return datetime(year, month, day, min(hour, 23), min(minute, 59), tzinfo=IST)
    except ValueError:
        return None


def extract_dates(lines, today):
    deadline = drive_date = None
    ev_deadline = ev_drive = None
    deadline_rx = re.compile(r"last date|deadline|apply (?:by|before|latest by)|register(?:ation)? (?:by|before|closes|deadline|ends)|on or before|due date|closes on|last day|latest by|registration link (?:will )?(?:close|expire)|before", re.I)
    drive_rx = re.compile(r"date of (?:the )?(?:drive|test|assessment|interview|visit|exam|online test|process)|(?:drive|test|assessment|interview|exam|process) date|(?:drive|test) (?:will be )?(?:held|conducted|scheduled) on|scheduled (?:on|for)", re.I)
    for line in lines:
        if deadline is None and deadline_rx.search(line):
            d = parse_date(line, today)
            if d:
                deadline, ev_deadline = d, line
                continue
        if drive_date is None and drive_rx.search(line):
            d = parse_date(line, today)
            if d:
                drive_date, ev_drive = d, line
    return deadline, ev_deadline, drive_date, ev_drive


def extract_bond(lines):
    for line in lines:
        low = line.lower()
        if re.search(r"bond|service agreement|service commitment", low):
            if re.search(r"no bond|bond\s*[:\-]\s*(?:no|nil|none|na)\b", low):
                return "No bond", line
            m = re.search(r"(\d+(?:\.\d+)?)\s*(years?|yrs?|months?)", low)
            if m:
                unit = "year" if m.group(2).startswith("y") else "month"
                n = m.group(1)
                return f"{n} {unit}{'' if n in ('1', '1.0') else 's'}", line
    return None, None


# --------------------------------------------------------------------------
# Main entry point
# --------------------------------------------------------------------------

def extract_notice(text: str, today: datetime | None = None) -> dict:
    from matcher import extract_skills  # local import avoids a circular import in tests

    today = today or datetime.now(IST)
    text = normalize(text or "")
    lines = _lines(text)
    evidence = {}

    def keep(field, value, line):
        if line and value not in (None, [], ""):
            evidence[field] = _snippet(line)
        return value

    company, ev = extract_company(lines)
    company = keep("company", company, ev)
    role, ev = extract_role(lines)
    role = keep("role", role, ev)
    location, ev = extract_location(lines)
    location = keep("location", location, ev)
    ctc_min, ctc_max, stipend, ev = extract_ctc(lines)
    if ev:
        evidence["ctc"] = _snippet(ev)

    min_cgpa, cgpa_scale, ev = extract_cgpa(lines)
    min_cgpa = keep("minCgpa", min_cgpa, ev)

    percents, pev = extract_percentages(lines)
    for level, field in (("10th", "min10th"), ("12th", "min12th"), ("diploma", "minDiploma"), ("grad", "minGradPercent")):
        if level in percents:
            evidence[field] = _snippet(pev[level])
    # "12th/Diploma: 60%" -> both. If only 12th is given, diploma holders are usually held to the same bar.
    if "12th" in percents and "diploma" not in percents:
        percents["diploma"] = percents["12th"]

    branches, ev = extract_branches(lines)
    branches = keep("branches", branches, ev)
    max_active, allow_history, ev = extract_backlogs(lines)
    if ev:
        evidence["backlogs"] = _snippet(ev)
    gap, ev = extract_gap(lines)
    gap = keep("maxGapYears", gap, ev)
    years, ev = extract_batch(lines)
    years = keep("graduationYears", years, ev)
    deadline, ev_dl, drive_date, ev_dd = extract_dates(lines, today)
    keep("deadline", deadline, ev_dl)
    keep("driveDate", drive_date, ev_dd)
    bond, ev = extract_bond(lines)
    bond = keep("bond", bond, ev)

    criteria = {
        "minCgpa": min_cgpa,
        "cgpaScale": cgpa_scale,
        "min10th": percents.get("10th"),
        "min12th": percents.get("12th"),
        "minDiploma": percents.get("diploma"),
        "minGradPercent": percents.get("grad"),
        "branches": branches,
        "maxActiveBacklogs": max_active,
        "allowBacklogHistory": allow_history,
        "graduationYears": years,
        "maxGapYears": gap,
    }
    found = sum(1 for k, v in criteria.items() if v not in (None, []) and k not in ("cgpaScale", "minDiploma"))

    return {
        "company": company,
        "role": role,
        "location": location,
        "ctcLpa": ctc_min,
        "ctcMaxLpa": ctc_max,
        "stipendPerMonth": stipend,
        "bond": bond,
        "deadline": deadline.isoformat() if deadline else None,
        "driveDate": drive_date.isoformat() if drive_date else None,
        "criteria": criteria,
        "skills": extract_skills(text),
        "evidence": evidence,
        "criteriaFound": found,
    }
