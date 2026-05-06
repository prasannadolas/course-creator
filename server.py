import asyncio
import json
import traceback
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from types import SimpleNamespace

# Import errors for Exception Handling
from google.genai import errors

# ADK imports
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

# Your agents
from course_agents.curriculum_agent import curriculum_agent
from course_agents.content_agent import content_agent
from course_agents.review_agent import review_agent
from course_agents.quiz_agent import quiz_agent

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── Helper: wrap plain text as ADK message ──────────────────────────────────
def wrap_message(text: str):
    return SimpleNamespace(role="user", parts=[SimpleNamespace(text=text)])

def extract_text(event):
    try:
        if event.content and event.content.parts:
            return event.content.parts[0].text
    except AttributeError:
        pass
    return None

# ── SSE helper: FIXED FORMATTING ───────────────────────────────
def sse_event(event_type: str, data: dict) -> dict:
    # MUST return a dict so sse_starlette formats the stream correctly!
    return {
        "event": event_type, 
        "data": json.dumps(data)
    }

# ── Main generation pipeline (async generator) ─────────────────────────────
async def run_pipeline_stream(topic: str, audience: str):
    try:
        session_svc = InMemorySessionService()
        session_id  = "web_session"
        user_id     = "web_user"
        await session_svc.create_session(
            session_id=session_id, user_id=user_id, app_name="course_creator"
        )

        full_content = f"# {topic}\n**Audience:** {audience}\n\n"

        # ── PHASE 1: CURRICULUM AGENT ──────────────────────────────────────────
        yield sse_event("stage", {"stage": 0, "status": "active", "label": "Curriculum Architect: researching..."})
        yield sse_event("progress", {"pct": 5, "label": "Researching topic..."})

        syllabus_text = ""
        runner = Runner(agent=curriculum_agent, session_service=session_svc, app_name="course_creator")
        msg = wrap_message(
            f"Create a syllabus for '{topic}' for {audience}. "
            f"List exactly 5 modules. Format as 'Module X: Title - one sentence summary'."
        )
        async for event in runner.run_async(session_id=session_id, user_id=user_id, new_message=msg):
            if event.is_final_response():
                syllabus_text = extract_text(event) or ""

        yield sse_event("stage",    {"stage": 0, "status": "done"})
        yield sse_event("syllabus", {"text": syllabus_text})
        yield sse_event("progress", {"pct": 20, "label": "Syllabus ready. Starting lessons..."})

        full_content += f"## Syllabus\n{syllabus_text}\n\n"

        # Parse module titles from syllabus
        modules = _parse_modules(syllabus_text)

        # ── PHASE 2: PROFESSOR + DEAN + QUIZ AGENT (per module) ───────────────
        yield sse_event("stage", {"stage": 1, "status": "active", "label": "Professor: writing lessons..."})

        for i, module_title in enumerate(modules):
            base_pct = 20 + int((i / len(modules)) * 65)

            yield sse_event("module_start", {"index": i, "title": module_title})
            yield sse_event("progress",     {"pct": base_pct, "label": f"Professor: writing {module_title}..."})

            # ── Professor ──────────────────────────────────────────────────────
            runner_draft = Runner(agent=content_agent, session_service=session_svc, app_name="course_creator")
            draft_prompt = (
                f"Write the FULL DETAILED LESSON for '{module_title}'. "
                f"Include practical code examples. Every code block MUST have an explanation. "
                f"Write at least 500 words."
            )
            async for event in runner_draft.run_async(session_id=session_id, user_id=user_id, new_message=wrap_message(draft_prompt)):
                pass  # Draft stays internal (Dean will polish it)

            yield sse_event("lesson_status", {"index": i, "status": "reviewing"})
            yield sse_event("progress",      {"pct": base_pct + 5, "label": f"Dean: reviewing {module_title}..."})

            await asyncio.sleep(5) # small cool-down to help prevent rate limits

            # ── Dean (Reviewer) ────────────────────────────────────────────────
            yield sse_event("stage", {"stage": 2, "status": "active"})

            final_lesson = ""
            runner_rev = Runner(agent=review_agent, session_service=session_svc, app_name="course_creator")
            rev_prompt = (
                "Review the lesson. Improve structure, bold key terms, "
                "ensure code blocks are formatted correctly. Return only the polished lesson."
            )
            async for event in runner_rev.run_async(session_id=session_id, user_id=user_id, new_message=wrap_message(rev_prompt)):
                if event.is_final_response():
                    final_lesson = extract_text(event) or ""

            yield sse_event("lesson_done", {"index": i, "title": module_title, "content": final_lesson})
            full_content += f"\n# {module_title}\n\n{final_lesson}\n\n"

            await asyncio.sleep(2)

            # ── Quiz Agent ─────────────────────────────────────────────────────
            yield sse_event("stage",    {"stage": 3, "status": "active"})
            yield sse_event("progress", {"pct": base_pct + 10, "label": f"Exam Setter: writing quiz for {module_title}..."})

            quiz_text = ""
            runner_quiz = Runner(agent=quiz_agent, session_service=session_svc, app_name="course_creator")
            q_prompt = f"Create a short 3-question quiz for '{module_title}' based on the lesson above."
            async for event in runner_quiz.run_async(session_id=session_id, user_id=user_id, new_message=wrap_message(q_prompt)):
                if event.is_final_response():
                    quiz_text = extract_text(event) or ""

            yield sse_event("quiz_done", {"index": i, "title": module_title, "content": quiz_text})
            full_content += f"\n### Quiz: {module_title}\n{quiz_text}\n\n"

            if i < len(modules) - 1:
                yield sse_event("progress", {"pct": base_pct + 12, "label": "Cooling down API limits..."})
                await asyncio.sleep(15)  # Extended 15-second cool down between modules

        # ── DONE ──────────────────────────────────────────────────────────────
        for s in range(4):
            yield sse_event("stage", {"stage": s, "status": "done"})

        yield sse_event("progress", {"pct": 100, "label": "Course complete!"})
        yield sse_event("done",     {"full_content": full_content})

    # ── ERROR HANDLING ────────────────────────────────────────────────────────
    except errors.ServerError as e:
        # Catches the 503 Server Overloaded error
        print(f"Caught 503 Error: {e}")
        yield sse_event("progress", {"pct": 0, "label": "❌ Google's servers are overloaded. Please try again in a minute."})
        
    except errors.ClientError as e:
        # Catches the 429 Rate Limit error
        print(f"Caught 429 Error: {e}")
        yield sse_event("progress", {"pct": 0, "label": "❌ API rate limit reached. Please wait 30 seconds."})

    except Exception as e:
        # Catches any other random crashes
        error_details = traceback.format_exc()
        print(f"\n❌ PIPELINE CRASHED:\n{error_details}")
        yield sse_event("progress", {"pct": 0, "label": f"❌ Server Error: {str(e)}"})


def _parse_modules(syllabus_text: str) -> list[str]:
    import re
    modules = []
    for line in syllabus_text.split('\n'):
        clean = line.strip().replace('*', '').replace('#', '').strip()
        if re.match(r'^(?:Module\s*\d+|Unit\s*\d+|\d+[\.\)])\s*[:\-\s]', clean, re.IGNORECASE):
            modules.append(clean)
    return modules[:5] if modules else [
        "Module 1: Fundamentals", "Module 2: Core Concepts",
        "Module 3: Application",  "Module 4: Advanced Topics",
        "Module 5: Conclusion"
    ]


# ── ROUTES ─────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    with open("static/ai_course_creator.html", encoding="utf-8") as f:
        return f.read()
    
@app.get("/generate")
async def generate(topic: str, audience: str = "Beginners"):
    return EventSourceResponse(run_pipeline_stream(topic, audience))