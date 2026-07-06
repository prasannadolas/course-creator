import logging
import sys

def setup_logger(name="AI_Course_Creator"):
    """
    Configures a professional logger that prints to the console.
    """
    logger = logging.getLogger(name)
    
    if logger.hasHandlers():
        return logger
        
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', datefmt='%H:%M:%S')
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    return logger

app_logger = setup_logger()