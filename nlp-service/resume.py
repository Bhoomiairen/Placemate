"""
Resume parsing and ATS health check.

parse_resume(pdf_bytes) -> text, links, skills and a list of ATS issues with a 0-100 score.
The checks are simple, explainable rules - the kind of things an ATS or a recruiter
skimming for 10 seconds actually notices.
"""

import io
import re

import pdfplumber

from matcher import extract_skills, group_by_category

ACTION_VERBS = {
    "achieved", "analyzed", "analysed", "architected", "automated", "built", "collaborated", "conducted",
    "configured", "coordinated", "created", "debugged", "delivered", "deployed", "designed", "developed",
    "drove", "enhanced", "engineered", "established", "evaluated", "executed", "gained", "generated",
    "handled", "identified", "implemented", "improved", "increased", "integrated", "introduced", "launched",
    "led", "learned", "maintained", "managed", "mentored", "migrated", "modeled", "monitored", "optimized",
    "optimised", "organized", "orchestrated", "owned", "participated", "performed", "planned", "processed",
    "produced", "programmed", "prototyped", "published", "reduced", "refactored", "researched", "resolved",
    "scaled", "secured", "simplified", "solved", "spearheaded", "streamlined", "supported", "tested",
    "trained", "transformed", "visualized", "wrote", "won",
}
WEAK_VERBS = {"participated", "learned", "gained", "supported", "handled", "helped", "worked", "assisted"}

SECTIONS = {
    "education": r"^\s*(?:education|academic (?:details|background|qualifications?)|qualifications?)\b",
    "experience": r"^\s*(?:(?:work |professional )?experience|internships?|employment)\b",
    "projects": r"^\s*(?:(?:academic |personal |key )?projects)\b",
    "skills": r"^\s*(?:(?:technical |core |key )?skills|technologies|tech stack)\b",
}

BULLET_GLYPHS = "•●▪◦‣∙·-*–•"


class ResumeParseError(ValueError):
    pass


def pdf_to_text(data: bytes) -> tuple[str, list[str], int]:
    """Extract text and hyperlink URLs from a PDF."""
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = len(pdf.pages)
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
            links = []
            for page in pdf.pages:
                for link in page.hyperlinks or []:
                    uri = link.get("uri")
                    if uri:
                        links.append(uri)
    except Exception as exc:  # pdfplumber raises many different types for broken files
        raise ResumeParseError("Could not read this PDF. Please upload a text-based PDF (exported from Word/Docs/LaTeX).") from exc
    if len(text.strip()) < 100:
        raise ResumeParseError("No readable text found. The PDF is probably a scanned image - ATS software can't read those either. Export it as a text PDF.")
    return text, links, pages


def _bullets(lines: list[str]) -> list[str]:
    """Rebuild bullet points. PDF extraction splits long bullets across lines and
    often drops the bullet glyph, so a bullet = a line starting with a glyph or an
    action verb, plus any following lines that start in lowercase (continuations)."""
    bullets = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        first = line.lstrip(BULLET_GLYPHS + " ").split(" ")[0].lower().strip(",.:")
        starts_bullet = line[0] in BULLET_GLYPHS or first in ACTION_VERBS or first in WEAK_VERBS
        if starts_bullet:
            bullets.append(line.lstrip(BULLET_GLYPHS + " "))
        elif bullets and (line[0].islower() or bullets[-1].rstrip().endswith((",", "and", "the", "of", "to", "for", "with"))):
            bullets[-1] += " " + line
    return [b for b in bullets if len(b.split()) >= 6]


def has_metric(bullet: str) -> bool:
    """True if a bullet contains a real number (not a year, not a name like S3 / Python3 / EC2)."""
    s = re.sub(r"\b(?:19|20)\d{2}\b", " ", bullet)
    s = re.sub(r"\b[A-Za-z]+\d+[A-Za-z\d]*\b", " ", s)
    return bool(re.search(r"(?<![A-Za-z])\d+(?:[.,]\d+)?", s))


def ats_check(text: str, links: list[str], pages: int) -> dict:
    lines = text.split("\n")
    low = text.lower()
    all_links = " ".join(links).lower()

    contact = {
        "email": bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)) or "mailto:" in all_links,
        "phone": bool(re.search(r"(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b", text)),
        "linkedin": "linkedin" in low or "linkedin.com" in all_links,
        "github": "github" in low or "github.com" in all_links,
    }
    sections = {name: any(re.match(rx, line, re.I) for line in lines) for name, rx in SECTIONS.items()}

    bullets = _bullets(lines)
    with_numbers = [b for b in bullets if has_metric(b)]
    first_words = [b.split(" ")[0].lower().strip(",.:") for b in bullets]
    action = sum(1 for w in first_words if w in ACTION_VERBS and w not in WEAK_VERBS)
    weak = sorted({w.capitalize() for w in first_words if w in WEAK_VERBS})
    word_count = len(re.findall(r"\w+", text))

    issues = []

    def issue(severity, message, fix):
        issues.append({"severity": severity, "message": message, "fix": fix})

    for key, label in (("email", "email address"), ("phone", "phone number"), ("linkedin", "LinkedIn link"), ("github", "GitHub link")):
        if not contact[key]:
            issue("high" if key in ("email", "phone") else "medium", f"No {label} found.", f"Add your {label} in the header.")
    for key, label in (("education", "Education"), ("projects", "Projects"), ("skills", "Skills"), ("experience", "Experience / Internships")):
        if not sections[key]:
            issue("medium" if key != "experience" else "low", f"No clear '{label}' section heading.", f"Use a standard heading called '{label}' so ATS software can find it.")
    if bullets:
        share = len(with_numbers) / len(bullets)
        if share < 0.4:
            issue("high", f"Only {len(with_numbers)} of {len(bullets)} bullet points contain a number or metric.",
                  "Add measurable results: users, records processed, accuracy, % faster, number of services.")
        if action / len(bullets) < 0.6:
            issue("medium", f"Only {action} of {len(bullets)} bullets start with a strong action verb.", "Start bullets with verbs like Built, Designed, Implemented, Reduced, Automated.")
    else:
        issue("high", "Could not find bullet points describing your work.", "Describe projects and experience as 2-4 bullet points each.")
    if weak:
        issue("low", f"Weak opening verbs used: {', '.join(weak)}.", "Replace them with verbs that show ownership (Built, Led, Designed).")
    if pages > 1:
        issue("medium", f"Resume is {pages} pages long.", "Freshers should keep the resume to one page.")
    if word_count < 250:
        issue("medium", f"Resume is short ({word_count} words).", "Add more detail to projects and experience.")
    elif word_count > 900:
        issue("low", f"Resume is long ({word_count} words).", "Trim to the most relevant points; aim for 400-700 words.")
    if re.search(r"date of birth|\bdob\b|marital status|father'?s name|religion", low):
        issue("low", "Contains personal details (date of birth / family details).", "Remove them - they are not needed and take up space.")

    penalty = {"high": 12, "medium": 6, "low": 3}
    score = max(0, 100 - sum(penalty[i["severity"]] for i in issues))
    order = {"high": 0, "medium": 1, "low": 2}
    issues.sort(key=lambda i: order[i["severity"]])

    return {
        "score": score,
        "contact": contact,
        "sections": sections,
        "bullets": {
            "total": len(bullets),
            "withNumbers": len(with_numbers),
            "startWithActionVerb": action,
            "examplesWithoutNumbers": [b[:140] for b in bullets if b not in with_numbers][:3],
        },
        "pages": pages,
        "wordCount": word_count,
        "issues": issues,
    }


def parse_resume(data: bytes) -> dict:
    text, links, pages = pdf_to_text(data)
    skills = extract_skills(text, apply_implications=True)
    stated = extract_skills(text)
    return {
        "text": text,
        "links": links,
        "skills": skills,
        "skillsStated": stated,
        "skillsByCategory": group_by_category(skills),
        "ats": ats_check(text, links, pages),
    }
