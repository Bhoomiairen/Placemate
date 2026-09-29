"""Unit tests for the NLP service.  Run:  python -m pytest -q"""

import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app  # noqa: E402
from extractor import IST, extract_backlogs, extract_branches, extract_cgpa, extract_notice, extract_percentages, parse_date  # noqa: E402
from matcher import extract_skills, match  # noqa: E402
from resume import has_metric  # noqa: E402

TODAY = datetime(2026, 9, 25, tzinfo=IST)


# ---------------- skills ----------------

def test_skills_basic_and_aliases():
    skills = extract_skills("Worked with ReactJS, node.js, Spring Boot, ML and MySQL")
    assert {"React", "Node.js", "Spring Boot", "Machine Learning", "MySQL"} <= set(skills)


def test_skills_ignore_english_words():
    text = "Get the rest of the details. Go through the link. Express your interest. R&D team."
    assert extract_skills(text) == []


def test_skills_short_names_in_lists():
    assert {"C", "C++", "Go", "R"} <= set(extract_skills("Languages: C, C++, Go, R"))


def test_java_is_not_javascript():
    assert extract_skills("JavaScript developer") == ["JavaScript"]


def test_implications_only_when_asked():
    assert "Java" not in extract_skills("Spring Boot")
    assert "Java" in extract_skills("Spring Boot", apply_implications=True)


# ---------------- matching ----------------

def test_match_scores_and_missing():
    result = match("Built REST APIs with Java and Spring Boot. Used MySQL.", "Need Java, Spring Boot, Docker, SQL")
    assert set(result["matchedSkills"]) == {"Java", "Spring Boot", "SQL"}
    assert result["missingSkills"] == ["Docker"]
    assert result["score"] == result["skillScore"] == 75
    assert 0 <= result["textScore"] <= 100


def test_no_skills_in_notice_gives_no_score():
    assert match("Python developer", "CGPA 7, no backlogs, 2027 batch")["score"] is None


def test_soft_skills_not_scored():
    result = match("Python developer", "Python. Good communication skills.")
    assert result["missingSkills"] == []
    assert result["softSkillsMentioned"] == ["Communication"]


# ---------------- notice extraction ----------------

def test_cgpa_variants():
    assert extract_cgpa(["CGPA >= 7"])[:2] == (7.0, 10)
    assert extract_cgpa(["7.5 CGPA and above"])[:2] == (7.5, 10)
    assert extract_cgpa(["Minimum CGPA of 6.5"])[:2] == (6.5, 10)
    assert extract_cgpa(["CGPA 3.0/4"])[:2] == (3.0, 4)
    assert extract_cgpa(["No CGPA criteria"])[:2] == (None, None)


def test_percentage_variants():
    assert extract_percentages(["10th & 12th >= 60%"])[0] == {"10th": 60, "12th": 60}
    assert extract_percentages(["65% in 10th and 60% in 12th"])[0] == {"10th": 65, "12th": 60}
    assert extract_percentages(["Class X: 70%, Class XII: 65%"])[0] == {"10th": 70, "12th": 65}
    assert extract_percentages(["60% throughout academics"])[0] == {"10th": 60, "12th": 60, "grad": 60}
    assert extract_percentages(["Minimum 60 percent marks in SSC and HSC"])[0] == {"10th": 60, "12th": 60}
    assert extract_percentages(["Variable pay: 20% of CTC"])[0] == {}


def test_branches():
    assert extract_branches(["Eligible branches: CS, IT, EXTC"])[0] == ["CSE", "ECE", "IT"]
    assert extract_branches(["Open to all branches"])[0] == ["ALL"]
    assert extract_branches(["Eligible: Electronics and Computer Science"])[0] == ["ECS"]


def test_backlogs():
    assert extract_backlogs(["No active backlogs"])[:2] == (0, None)
    assert extract_backlogs(["Maximum 1 active backlog allowed"])[:2] == (1, None)
    assert extract_backlogs(["No history of backlogs"])[:2] == (0, False)
    assert extract_backlogs(["No active ATKT. Cleared backlogs are acceptable"])[:2] == (0, True)


def test_dates():
    assert parse_date("Last date: 5th October 2026, 11:59 PM", TODAY).isoformat() == "2026-10-05T23:59:00+05:30"
    assert parse_date("Deadline: 30/09/2026", TODAY).date().isoformat() == "2026-09-30"
    assert parse_date("Apply by Oct 3", TODAY).date().isoformat() == "2026-10-03"


def test_full_notice():
    notice = """Campus Drive: Acme Software
    Role: SDE
    CTC: 9 LPA
    Eligibility: B.Tech CSE/IT, 2027 batch, CGPA 7+, 60% in 10th and 12th, no active backlogs
    Skills: Java, SQL
    Last date to apply: 3rd October 2026"""
    r = extract_notice(notice, today=TODAY)
    assert r["company"] == "Acme Software"
    assert r["ctcLpa"] == 9
    c = r["criteria"]
    assert (c["minCgpa"], c["min10th"], c["min12th"], c["maxActiveBacklogs"]) == (7, 60, 60, 0)
    assert c["branches"] == ["CSE", "IT"] and c["graduationYears"] == [2027]
    assert r["deadline"].startswith("2026-10-03")
    assert set(r["skills"]) == {"Java", "SQL"}
    assert "minCgpa" in r["evidence"]


# ---------------- resume ----------------

def test_has_metric():
    assert has_metric("Reduced load time by 40% for 2,000 users")
    assert not has_metric("Built an app in 2025 using AWS S3 and Python3")


# ---------------- API ----------------

def test_api_notice_and_match():
    client = app.test_client()
    assert client.get("/health").json["status"] == "ok"
    r = client.post("/notice/parse", json={"text": "Company: Foo Labs\nCGPA >= 7\nSkills: Python, Docker"})
    assert r.status_code == 200 and r.json["criteria"]["minCgpa"] == 7
    r = client.post("/match/batch", json={"resumeText": "Python developer using Flask", "items": [{"id": "a", "text": "Python and Docker"}]})
    assert r.json["results"]["a"]["missingSkills"] == ["Docker"]
    assert client.post("/notice/parse", json={"text": "hi"}).status_code == 400


def test_other_notice_styles():
    r = extract_notice("""Greetings from T&P Cell!
Aurora Payments is conducting recruitment for SDE-1 (2027 passouts).
Package - 11.5 LPA (Fixed) + ESOPs
Criteria: 7.5 CPI & above, no current ATKT, Computer/IT/AIDS students only.
SSC/HSC >= 65 percent""", today=TODAY)
    c = r["criteria"]
    assert r["company"] == "Aurora Payments" and r["ctcLpa"] == 11.5
    assert (c["minCgpa"], c["min10th"], c["min12th"], c["maxActiveBacklogs"]) == (7.5, 65, 65, 0)
    assert c["branches"] == ["AI-ML", "CSE", "IT"]

    r = extract_notice("""Crest Insights - Analyst Hiring
Who can apply: Any branch | 2026 & 2027 batch
Academics: 70% or 7 CGPA in current degree, 12th: 65%""", today=TODAY)
    c = r["criteria"]
    assert (r["company"], r["role"]) == ("Crest Insights", "Analyst")
    assert (c["minGradPercent"], c["min12th"], c["minCgpa"]) == (70, 65, 7)
    assert c["branches"] == ["ALL"] and c["graduationYears"] == [2026, 2027]
