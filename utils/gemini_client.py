import os
from dotenv import load_dotenv
from google.adk.models.google_llm import Gemini

load_dotenv()

def get_gemini_model():
    """
    Returns a configured Gemini model instance for ADK agents.
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("❌ Critical Error: GOOGLE_API_KEY not found in .env")
    
    return Gemini(
        model="gemini-2.5-flash",
        api_key=api_key,
    )