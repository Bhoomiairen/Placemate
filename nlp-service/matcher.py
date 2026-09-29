"""
Skill extraction and resume <-> job description matching.

Match score = share of the notice's technical skills that your resume shows
(skill coverage). Soft skills ("communication") are listed but not scored.

Why not blend in TF-IDF text similarity? The first version used
60% skills + 40% TF-IDF cosine. Measured on the sample notices, cosine
similarity was 0.02-0.11 for EVERY resume/notice pair: placement notices are
mostly eligibility boilerplate (CGPA, backlogs, dates), so whole-text overlap
carries almost no signal and only dragged all scores down. Text similarity is
still computed and returned ("textScore") and used as a tie-breaker when
sorting. Upgrade path: sentence embeddings (Sentence-BERT) on the
job-description part of the notice only.
"""

import re
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from skills import SKILLS, SOFT_CATEGORY, category_of


# Characters that may NOT touch a skill name on either side.
_BEFORE = r"(?<![A-Za-z0-9_])"
_AFTER = r"(?![A-Za-z0-9_+#])"
# Single-letter / very short case-sensitive names ("C", "R", "AI") are stricter.
_AFTER_STRICT = r"(?![A-Za-z0-9_+#&.\-'’])"


@lru_cache(maxsize=1)
def _compiled_patterns():
    """Build one regex per canonical skill (compiled once, then cached)."""
    patterns = []
    for name, info in SKILLS.items():
        parts = []
        insensitive = sorted(set(info.get("aliases", [])), key=len, reverse=True)
        if insensitive:
            alts = "|".join(re.escape(a) for a in insensitive)
            parts.append(f"(?i:{_BEFORE}(?:{alts}){_AFTER})")
        for a in info.get("cs", []):
            after = _AFTER_STRICT if len(a) <= 2 else _AFTER
            parts.append(f"{_BEFORE}{re.escape(a)}{after}")
        for a in info.get("list", []):
            w = re.escape(a)
            parts.append(f"{_BEFORE}{w}(?=\\s*[,/|)])")          # "Go, Java"
            parts.append(f"(?<=[,/|(]){w}{_AFTER}")               # "Java,Go"
            parts.append(f"(?<=[,/|(] ){w}{_AFTER}")              # "Java, Go"
        if parts:
            patterns.append((name, re.compile("|".join(parts))))
    return patterns


def extract_skills(text: str, apply_implications: bool = False) -> list[str]:
    """Return canonical skill names found in the text (sorted, unique)."""
    if not text:
        return []
    found = {name for name, pattern in _compiled_patterns() if pattern.search(text)}
    if apply_implications:
        stack = list(found)
        while stack:
            for implied in SKILLS.get(stack.pop(), {}).get("implies", []):
                if implied not in found:
                    found.add(implied)
                    stack.append(implied)
    return sorted(found)


def group_by_category(skills: list[str]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for s in skills:
        groups.setdefault(category_of(s), []).append(s)
    return groups


def _technical(skills):
    return [s for s in skills if category_of(s) != SOFT_CATEGORY]


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"https?://\S+|\S+@\S+", " ", text)
    text = re.sub(r"[^a-z0-9+#./ ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def text_similarity(a: str, b: str) -> float:
    """Cosine similarity (0..1) of term-frequency vectors of two documents.

    IDF is switched off on purpose: fitted on just these two documents, IDF gives
    the words they SHARE the lowest weight - the opposite of what we want."""
    a, b = clean_text(a), clean_text(b)
    if not a or not b:
        return 0.0
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True, use_idf=False)
    try:
        matrix = vectorizer.fit_transform([a, b])
    except ValueError:  # only stop words
        return 0.0
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])


def match(resume_text: str, jd_text: str, resume_skills=None, jd_skills=None) -> dict:
    """Score how well a resume fits one job description / drive notice."""
    r_skills = set(resume_skills) if resume_skills else set(extract_skills(resume_text, apply_implications=True))
    j_skills = set(jd_skills) if jd_skills else set(extract_skills(jd_text))

    jd_tech = set(_technical(j_skills))
    matched = sorted(jd_tech & r_skills)
    missing = sorted(jd_tech - r_skills)

    cosine = text_similarity(resume_text, jd_text)
    # No technical skills in the notice -> nothing meaningful to score.
    skill_score = round(len(matched) / len(jd_tech) * 100) if jd_tech else None

    return {
        "score": skill_score,
        "skillScore": skill_score,
        "textScore": round(cosine * 100),
        "matchedSkills": matched,
        "missingSkills": missing,
        "softSkillsMentioned": sorted(s for s in j_skills if category_of(s) == SOFT_CATEGORY),
        "jdSkillCount": len(jd_tech),
    }
