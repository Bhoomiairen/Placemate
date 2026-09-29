"""
PlaceMate NLP service (Flask).

Endpoints (all JSON):
  GET  /health
  POST /resume/parse        multipart file=<pdf>             -> text, skills, ATS report
  POST /notice/parse        {"text": "..."} or file=<pdf>    -> structured eligibility criteria
  POST /skills/extract      {"text": "..."}                  -> skills
  POST /match               {"resumeText", "resumeSkills", "jdText", "jdSkills"}
  POST /match/batch         {"resumeText", "resumeSkills", "items": [{"id", "text", "skills"}]}

Only the Node.js API talks to this service; it is not exposed to the browser.
"""

import os

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from extractor import extract_notice
from matcher import extract_skills, group_by_category, match
from resume import ResumeParseError, parse_resume, pdf_to_text

MAX_UPLOAD_MB = 5

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024


def _error(message, status=400):
    return jsonify({"error": message}), status


def _uploaded_pdf():
    file = request.files.get("file")
    if not file or not file.filename:
        return None
    data = file.read()
    if not data.startswith(b"%PDF"):
        raise ResumeParseError("Only PDF files are supported.")
    return data


@app.errorhandler(ResumeParseError)
def handle_parse_error(exc):
    return _error(str(exc), 422)


@app.errorhandler(HTTPException)
def handle_http_error(exc):
    if exc.code == 413:
        return _error(f"File too large (max {MAX_UPLOAD_MB} MB).", 413)
    return _error(exc.description, exc.code)


@app.get("/health")
def health():
    return {"status": "ok", "service": "placemate-nlp"}


@app.post("/resume/parse")
def resume_parse():
    data = _uploaded_pdf()
    if data is None:
        return _error("Upload a PDF in the 'file' field.")
    return jsonify(parse_resume(data))


@app.post("/notice/parse")
def notice_parse():
    data = _uploaded_pdf()
    if data is not None:
        text, _, _ = pdf_to_text(data)
    else:
        text = (request.get_json(silent=True) or {}).get("text", "")
    if len(text.strip()) < 20:
        return _error("Paste the full drive notice (at least a few lines).")
    result = extract_notice(text)
    result["rawText"] = text
    return jsonify(result)


@app.post("/skills/extract")
def skills_extract():
    body = request.get_json(silent=True) or {}
    skills = extract_skills(body.get("text", ""), apply_implications=bool(body.get("implications")))
    return jsonify({"skills": skills, "byCategory": group_by_category(skills)})


@app.post("/match")
def match_one():
    body = request.get_json(silent=True) or {}
    if not body.get("resumeText") or not body.get("jdText"):
        return _error("resumeText and jdText are required.")
    return jsonify(match(body["resumeText"], body["jdText"], body.get("resumeSkills"), body.get("jdSkills")))


@app.post("/match/batch")
def match_batch():
    """Score one resume against many drives in a single call (used by the drives list and dashboard)."""
    body = request.get_json(silent=True) or {}
    resume_text = body.get("resumeText")
    items = body.get("items") or []
    if not resume_text:
        return _error("resumeText is required.")
    if len(items) > 500:
        return _error("Too many items (max 500).")
    resume_skills = body.get("resumeSkills") or extract_skills(resume_text, apply_implications=True)
    results = {}
    for item in items:
        if item.get("id") and item.get("text"):
            results[str(item["id"])] = match(resume_text, item["text"], resume_skills, item.get("skills"))
    return jsonify({"results": results})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)), debug=os.environ.get("FLASK_DEBUG") == "1")
