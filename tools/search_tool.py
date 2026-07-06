import logging
from duckduckgo_search import DDGS

logging.basicConfig(level=logging.INFO)
app_logger = logging.getLogger("SearchTool")

def perform_research(query: str):
    """
    Performs a real web search to find the latest information.
    """
    max_results = 3 
    
    app_logger.info(f"🔍 Researching: {query}")
    
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        
        if not results:
            return "No results found."
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
    print(perform_research("Latest trends in AI 2026"))