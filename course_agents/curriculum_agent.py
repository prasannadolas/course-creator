from google.adk.agents import LlmAgent
from google.adk.models.google_llm import Gemini
from config import MODEL_NAME, GOOGLE_API_KEY
from tools.search_tool import perform_research 

model_config = Gemini(model=MODEL_NAME, api_key=GOOGLE_API_KEY)

curriculum_agent = LlmAgent(
    name="curriculum_architect",
    model=model_config,
    tools=[perform_research], 
    instruction="""
    You are an expert Instructional Designer.
    
    YOUR GOAL:
    Create a syllabus.
    

    IMPORTANT:
    If the topic is modern or specific (like "AI trends 2025"), USE YOUR SEARCH TOOL 
    to find the latest info before designing the modules.

    
    OUTPUT FORMAT:
    - A structured list of 4-6 Modules.
    - For each module, provide a title and a 1-sentence summary of what will be learned.
    - DO NOT write the actual lessons yet. Only the structure.
    """
)