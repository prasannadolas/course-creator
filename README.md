# Autonomous AI Course Creator

> **Using Google ADK, FastAPI & Gemini 2.5 Flash**

## Project Overview
![Project Overview](diagram_folder/project_overview.png)

### Problem Statement

In today's rapidly evolving technological landscape, the demand for upskilling and high-quality educational content has never been higher. However, traditional instructional design remains a significant bottleneck. Creating a comprehensive course is a slow, manual, and resource-intensive process, often requiring teams of subject matter experts, writers, and editors weeks or months to plan, draft, review, and finalize content. This inability to scale content production efficiently leaves vast knowledge gaps unfilled in both corporate and academic settings.

### Solution Statement

The **Autonomous AI Course Creator** is designed to solve this content bottleneck by automating the end-to-end instructional design process. It is not merely a text generation tool, but a sophisticated **multi-agent system** that orchestrates a digital workforce of specialized AI agents. By mimicking a human team—with dedicated agents for curriculum planning, technical writing, assessment creation, and quality control critiquing—the system can take a single topic prompt and autonomously generate a high-quality, multi-module course package (including lessons, interactive quizzes, and summaries) in minutes instead of weeks.

-----

## Core Concept & Value

### Why Agents? (Core Innovation)

Traditional LLM approaches often involve a single prompt like "Write a course on Python," which typically results in shallow, hallucinated, or unstructured content. This project leverages a Multi-Agent Architecture because instructional design is a multi-step workflow that requires different "modes of thinking."

  * **Separation of Concerns:** Just as a university has a separate Professor, Dean, and Exam Board, this system assigns distinct roles to different agents. This ensures that the entity creating the lesson is not the same one grading it, reducing bias and improving quality.
  * **Iterative Refinement:** The output of one agent (e.g., the Syllabus) becomes the input for the next (e.g., the Content Writer). This chaining allows for deeper context retention and more coherent long-form content generation.
  * **Scalability:** This architecture allows for "Modular Generation." Instead of hitting token limits by generating a whole book at once, the system loops through modules, generating deep-dive content without losing quality.

### Key Features

  * **Sequential Multi-Agent Workflow:** Implements a linear pipeline where a Curriculum Architect, Content Professor, Reviewer (Dean), and Examiner work in a strict sequence to produce high-quality outputs.
  * **Real-Time SSE Streaming:** Utilizes Server-Sent Events (SSE) via FastAPI to stream agent activities, pipeline status, and generated markdown directly to the frontend in real-time.
  * **Interactive MCQ Quizzes:** A custom frontend parser dynamically transforms raw AI markdown output into fully interactive Multiple Choice Question blocks with instant validation and feedback.
  * **Free-Tier Resiliency:** Built-in error handling and pipeline throttling (`asyncio.sleep`) gracefully catch `429 Rate Limit` and `503 Server Overloaded` errors, ensuring successful execution even on Google's free tier.
  * **Native Google Search Grounding:** The Curriculum Agent is equipped with Google's native search tool, enabling it to fact-check syllabus topics against real-time trends and data.
  * **Dual Interface (Web & CLI):**
      * *FastAPI Web App:* A polished, responsive HTML/CSS/JS interface for end-users to generate and export professional Markdown courses.
      * *Developer CLI:* A robust command-line tool for debugging and observing agent "thought processes."

-----

## Architecture

## Architectural Diagram
![Architecture Diagram](diagram_folder/Architecture.png) 

### Design Philosophy

The architecture of the Autonomous AI Course Creator is built on the principles of Modularity, Orchestration, and Reliability.

  * **Agentic Modularity:** Each agent is a self-contained unit with a specific "persona" and "toolset." 
  * **Centralized Orchestration:** Rather than agents talking chaotically to each other, a central Runner (powered by Google ADK) manages the state and flow in an asynchronous FastAPI backend.
  * **Stateless Execution with State Injection:** While the application uses `InMemorySessionService` for speed during a session, the architecture is designed to be stateless between runs. 

### High-Level Component Breakdown

**1. The Orchestrator (FastAPI Server)**
The "brain" of the operation. It initializes the session, injects the user's prompt, and yields SSE events to the frontend. It manages the Turbo Modular Loop, iterating through the syllabus one module at a time.

**2. The Agent Workforce**
  * **Curriculum Agent:** Uses Google Search Grounding to research the topic and outputs a structured JSON-like list of modules.
  * **Content Agent (Professor):** Takes a specific module title and writes a deep-dive lesson with code examples.
  * **Review Agent (The Dean):** Acts as a quality gate. It rewrites the Professor's draft for clarity, formatting, and tone.
  * **Quiz Agent (Examiner):** Reads the final lesson and generates an assessment.

**3. The Presentation Layer**
  * **Vanilla JS/HTML/CSS Frontend:** A lightweight, lightning-fast client that parses markdown, renders interactive UI elements, and handles file exports without heavy frontend frameworks.

 ![ER Diagram](diagram_folder/Er-diagram.png)

### Project Structure
```text
AI-COURSE-CREATOR/
├── course_agents/          # AI Agent Definitions
│   ├── content_agent.py    # Professor: Writes detailed lessons
│   ├── curriculum_agent.py # Architect: Plans the syllabus structure
│   ├── quiz_agent.py       # Examiner: Generates assessments
│   └── review_agent.py     # Dean: Critiques and polishes content
│
├── static/                 # Frontend Assets
│   └── ai_course_creator.html  # Main interactive web UI
│
├── tools/                  # Helper Tools
│   ├── file_writer_tool.py # Handles file saving operations
│   └── search_tool.py      # External search utility
│
├── utils/                  # Configuration & Utilities
│   ├── gemini_client.py    # Gemini model wrapper (2.5-flash / 2.0-flash)
│   └── logger.py           # System logging setup
│
├── .env                    # API Keys (Excluded from git)
├── .gitignore              # Git ignore rules
├── config.py               # Central config (Model selection)
├── requirements.txt        # Python dependencies
├── cli_runner.py           # CLI entry point (Developer Mode)
└── server.py               # FastAPI Backend & SSE Pipeline Orchestrator
```

-----

## Workflow
![Workflow Diagram](diagram_folder/Workflow.png)

The system follows a structured, automated multi-agent workflow:

1.  **Initialization:** A user submits a topic prompt via the Web UI.
2.  **Planning Phase:** The Curriculum Architect generates a syllabus outline. The frontend renders this structure dynamically.
3.  **Modular Execution Loop:** The FastAPI server orchestrates the processing of each module:
      * *Drafting:* The Content Professor writes a detailed first draft.
      * *Critique & Polish:* The Reviewer takes the draft and produces a "Final Polish" version.
      * *Assessment:* The Examiner reads the final lesson and generates a quiz.
4.  **UI Parsing:** The frontend intercepts the text stream, converting plain text lessons into readable cards and raw quiz text into interactive MCQ buttons.
5.  **Finalization:** The user can instantly download the entire curated course as a formatted `.md` file.

-----

## Essential Tools and Utilities

**Core AI & Orchestration**
  * **Google Gemini API (Model: gemini-2.5-flash):** The central "brain" chosen for its high-speed inference.
  * **Google Agent Development Kit (ADK):** The foundational framework for building and managing the multi-agent system.

**Backend & Web Delivery**
  * **FastAPI & Uvicorn:** Provides a high-performance asynchronous backend.
  * **SSE-Starlette:** Powers the Server-Sent Events for real-time frontend updates without websockets.

**DevOps & Security**
  * **python-dotenv:** Ensures secure management of API keys.

-----

## Installation

### Prerequisites

  * Python 3.10+
  * Google AI Studio API Key
  * Git

### Step-by-Step Setup

**1. Clone the Repository**
```bash
git clone [https://github.com/prasannadolas/ai-course-creator](https://github.com/prasannadolas/ai-course-creator)
cd ai-course-creator
```

**2. Set Up Virtual Environment**
*Windows:*
```bash
python -m venv venv
.\venv\Scripts\activate
```
*macOS/Linux:*
```bash
python3 -m venv venv
source venv/bin/activate
```

**3. Install Dependencies**
```bash
pip install -r requirements.txt
```

**4. Configure Environment**
Create a `.env` file in the root directory and add your Google API key:
```text
GOOGLE_API_KEY=your_actual_google_api_key
```

### Running the Application

**Run the FastAPI Server:**
```bash
uvicorn server:app --reload
```

*Access the interactive Course Creator UI at `http://127.0.0.1:8000`*

-----

## Conclusion & Value

The **Autonomous AI Course Creator** proves that complex, knowledge-intensive tasks like instructional design can be effectively automated through a sophisticated multi-agent system architecture. By grounding the AI with real-time search data and implementing adversarial feedback loops, we have built a system that balances the speed of AI with the quality control of human oversight.

For Learning & Development (L&D) teams, educators, and EdTech platforms, this tool transforms content creation from a slow, expensive bottleneck into a scalable utility. It offers a significant acceleration in speed-to-market and democratizes access to rapid, high-quality curriculum development.