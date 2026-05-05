import logging
from duckduckgo_search import DDGS

# Setup a local logger for the tool to avoid import path issues
logging.basicConfig(level=logging.INFO)
app_logger = logging.getLogger("SearchTool")

def perform_research(query: str, max_results=3):
    """
    Performs a real web search to find the latest information.
    """
    app_logger.info(f"🔍 Researching: {query}")
    
    try:
        # Use a context manager for older versions of DDGS
        with DDGS() as ddgs:
            # list() is used to consume the generator
            results = list(ddgs.text(query, max_results=max_results))
        
        if not results:
            return "No results found."

        # Format the results into a clean string for the Agent
        formatted_results = ""
        for i, res in enumerate(results, 1):
            formatted_results += f"\n--- Source {i} ---\n"
            formatted_results += f"Title: {res.get('title', 'No Title')}\n"
            formatted_results += f"URL: {res.get('href', 'No URL')}\n"
            formatted_results += f"Summary: {res.get('body', 'No Summary')}\n"
            
        return formatted_results

    except Exception as e:
        app_logger.error(f"Search failed: {e}")
        return f"Search Error: {str(e)}"

if __name__ == "__main__":
    # Test the tool directly
    print(perform_research("Latest trends in AI 2026"))