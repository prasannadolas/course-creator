import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

MODEL_NAME = "gemini-2.5-flash"
if not GOOGLE_API_KEY:
    raise ValueError("❌ API Key missing! Check .env file.")
if not JWT_SECRET_KEY: 
    raise ValueError("❌ JWT_SECRET_KEY missing! Check .env file.")