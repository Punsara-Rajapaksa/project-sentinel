import logging
import spacy
import re

logger = logging.getLogger(__name__)

nlp = None


def load_model():
    global nlp
    if nlp is None:
        try:
            nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model 'en_core_web_sm' not found. Anonymization will be skipped.")
            return False
    return True


def anonymize_text(text: str) -> str:
    if not load_model():
        return text

    # Step 1: regex for email addresses
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
    
    # Step 1b: phone numbers (US-like and Sri Lankan)
    # US-like: 123-456-7890
    text = re.sub(r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b', '[PHONE]', text)
    # Sri Lankan mobile: 07x xxx xxxx (10 digits starting with 07)
    text = re.sub(r'\b07[1-9]\d{7}\b', '[PHONE]', text)
    # Sri Lankan generic: 0 followed by 9 digits (catches landlines too)
    text = re.sub(r'\b0\d{9}\b', '[PHONE]', text)

    # Step 2: spaCy for PERSON and GPE
    doc = nlp(text)
    tokens = []
    last_end = 0
    for ent in doc.ents:
        tokens.append(text[last_end:ent.start_char])
        if ent.label_ == "PERSON":
            tokens.append("[PERSON]")
        elif ent.label_ == "GPE":
            tokens.append("[LOCATION]")
        else:
            tokens.append(text[ent.start_char:ent.end_char])
        last_end = ent.end_char
    tokens.append(text[last_end:])
    return "".join(tokens)