import os

def save_course_to_file(topic: str, content: str):
    """
    Saves the generated course content to a Markdown file.
    
    Args:
        topic (str): The name of the course (used for filename).
        content (str): The full text content of the course.
    
    Returns:
        str: A success message indicating where the file was saved.
    """
    safe_filename = topic.replace(" ", "_").replace("/", "-")
    filename = f"{safe_filename}_Course.md"
    
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        return f"✅ Success: Course saved locally as '{filename}'"
    except Exception as e:
        return f"❌ Error: Failed to save file. Reason: {str(e)}"