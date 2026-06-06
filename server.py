from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
import bcrypt
from database import get_db, User, Course
import jwt
import asyncio
import json
import traceback
import inspect


from config import JWT_SECRET_KEY
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from types import SimpleNamespace

# Import errors for Exception Handling
from google.genai.errors import ClientError, ServerError

# ADK imports
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

# Your agents
from course_agents.curriculum_agent import curriculum_agent
from course_agents.content_agent import content_agent
from course_agents.review_agent import review_agent
from course_agents.quiz_agent import quiz_agent

# Password hashing setup
SECRET_KEY = JWT_SECRET_KEY

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
        
        session_result = session_svc.create_session(
            session_id=session_id, user_id=user_id, app_name="course_creator"
        )
        
        if inspect.isawaitable(session_result):
            await session_result
        # ------------------------------------

        full_content = f"# {topic}\n**Audience:** {audience}\n\n"

        # ── PHASE 1: CURRICULUM AGENT ──────────────────────────────────────────
        yield sse_event("stage", {"stage": 0, "status": "active", "label": "Curriculum Architect: researching..."})
        yield sse_event("progress", {"pct": 5, "label": "Researching topic..."})

        syllabus_text = ""
        runner = Runner(agent=curriculum_agent, session_service=session_svc, app_name="course_creator")
        msg = wrap_message(
            f"Create a syllabus for '{topic}' for {audience}. "
            f"List exactly 3 modules. Format as 'Module X: Title - one sentence summary'." 
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
        yield sse_event("stage", {"stage": 1, "status": "active", "label": "Professor: Writing lessons..."})

        for i, module_title in enumerate(modules):
            base_pct = 20 + int((i / len(modules)) * 65)

            yield sse_event("module_start", {"index": i, "title": module_title})
            yield sse_event("progress",     {"pct": base_pct, "label": f"CONENT AGENT: Writing {module_title}..."})

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
            yield sse_event("progress",      {"pct": base_pct + 5, "label": f"REVIEW AGENT: Reviewing {module_title}..."})

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
            yield sse_event("progress", {"pct": base_pct + 10, "label": f"QUIZ AGENT: Writing quiz for {module_title}..."})

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
    except ServerError as e:
        # Catches the 503 Server Overloaded error
        print(f"Caught 503 Error: {e}")
        yield sse_event("progress", {"pct": 0, "label": "❌ Google's servers are overloaded. Please try again in a minute."})
        
    except ClientError as e:
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
    return modules[:3] if modules else [  # <-- Change slice to :3
        "Module 1: Fundamentals", 
        "Module 2: Core Concepts",
        "Module 3: Application"
    ]

# ── AUTHENTICATION ROUTES ──────────────────────────────────────────────────
# ── DATA MODELS (This tells FastAPI exactly what JSON to expect) ────────────
class RegisterUser(BaseModel):
    full_name: str
    email: str
    password: str

class LoginUser(BaseModel):
    email: str
    password: str

# ── AUTHENTICATION ROUTES ──────────────────────────────────────────────────
@app.post("/auth/register")
def register(user_data: RegisterUser, db: Session = Depends(get_db)):
    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        return {"ok": False, "error": "Email already registered"}
    
    # Securely hash the password using modern bcrypt directly
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), salt).decode('utf-8')
    
    new_user = User(full_name=user_data.full_name, email=user_data.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    return {"ok": True}

@app.post("/auth/login")
def login(user_data: LoginUser, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    
    # Verify the user exists AND the password is correct
    if not user or not bcrypt.checkpw(user_data.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return {"ok": False, "error": "Invalid email or password"}
    
    # Create a secure token
    token = jwt.encode({"sub": user.email, "id": user.id}, SECRET_KEY, algorithm="HS256")
    
    return {
        "ok": True, 
        "token": token, 
        "user": {"full_name": user.full_name, "email": user.email}
    }

# ── ROUTING FOR AUTH PAGES ──────────────────────────────────────────────────
@app.get("/login", response_class=HTMLResponse)
async def serve_login():
    with open("static/login.html", encoding="utf-8") as f:
        return f.read()

@app.get("/register", response_class=HTMLResponse)
async def serve_register():
    with open("static/register.html", encoding="utf-8") as f:
        return f.read()

# ── ROUTES ─────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    with open("static/ai_course_creator.html", encoding="utf-8") as f:
        return f.read()
    
@app.get("/generate")
async def generate(topic: str, audience: str = "Beginners"):
    return EventSourceResponse(run_pipeline_stream(topic, audience))

# ── SECURITY HELPER: VERIFY USER TOKEN ──────────────────────────────────────
def get_current_user(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    try:
        # Decode the token using your secret key
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("id")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
@app.get("/api/history")
def get_user_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetches all saved courses for the currently logged-in user."""
    # Query the database for this user's courses, newest first
    courses = db.query(Course).filter(Course.user_id == current_user.id).order_by(Course.created_at.desc()).all()
    
    # Format the data to send back to javascript
    history_data = []
    for c in courses:
        history_data.append({
            "id": c.id, 
            "topic": c.topic, 
            "audience": c.audience, 
            "content": c.full_content, 
            "date": c.created_at.strftime("%b %d, %Y")
        })
        
    return {"ok": True, "courses": history_data}