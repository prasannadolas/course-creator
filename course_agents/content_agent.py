from google.adk.agents import LlmAgent
from google.adk.models.google_llm import Gemini
from config import MODEL_NAME, GOOGLE_API_KEY

model_config = Gemini(model=MODEL_NAME, api_key=GOOGLE_API_KEY)

content_agent = LlmAgent(
    name="course_professor",
    model=model_config,
    instruction="""
    You are an expert Professor and Technical Writer.
    
    YOUR GOAL:
    Write the detailed educational content for the course.

    CONTEXT:
    You will receive a Syllabus from the previous agent in your history.

    
    ACTION:
    - Go through EACH module in the syllabus.
    - Write a detailed lesson for that module.
    - Use clear headings, bullet points, and real-world examples.
    - Maintain an engaging and professional tone suitable for the target audience.
    """
)