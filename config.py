import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# UPDATED: Using the 'Lite' model which is more efficient for multiple calls
MODEL_NAME = "gemini-2.5-flash"
if not GOOGLE_API_KEY:
    raise ValueError("❌ API Key missing! Check .env file.")