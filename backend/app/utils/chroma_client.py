import logging
import chromadb
from chromadb.utils import embedding_functions

logger = logging.getLogger(__name__)

# Initialize ChromaDB client
client = chromadb.PersistentClient(path="./chroma_db")

# Initialize embedding function
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Get or create collection
collection = client.get_or_create_collection(
    name="scam_memory",
    embedding_function=embedding_fn,
    metadata={"hnsw:space": "cosine"}
)


# Seed data: diverse phishing/scam examples
SEED_SCAMS = [
    "Account verification required: Click here to verify your identity or your account will be suspended.",
    "Urgent action needed: You have been selected for a refund. Reply with your banking details immediately.",
    "Security alert: Unusual activity detected on your account. Verify password at the link below.",
    "Payment failed: Your payment method was declined. Update payment information to continue service.",
    "Tax return ready: You are owed a refund. Claim it now by providing your SSN and banking info.",
]


def seed_collection_if_empty():
    """Seed the collection with phishing examples if it's empty."""
    count = collection.count()
    if count == 0:
        logger.info("Seeding scam_memory collection with example phishing texts...")
        for idx, scam_text in enumerate(SEED_SCAMS):
            collection.add(
                documents=[scam_text],
                metadatas=[{"type": "seed_phishing"}],
                ids=[f"seed_{idx}"]
            )
        logger.info(f"Seeded {len(SEED_SCAMS)} phishing examples.")


def query_similar_scams(text: str, n_results: int = 3) -> list[str]:
    """
    Query ChromaDB for similar known scams.
    
    Args:
        text: The message text to find similar scams for
        n_results: Number of similar scams to return
    
    Returns:
        List of similar scam document texts
    """
    try:
        seed_collection_if_empty()
        
        results = collection.query(
            query_texts=[text],
            n_results=min(n_results, collection.count())
        )
        
        # Extract documents from results
        if results and results["documents"]:
            return results["documents"][0]
        return []
    
    except Exception as e:
        logger.error(f"Error querying ChromaDB: {e}")
        return []


def add_confirmed_scam(text: str, metadata: dict = None):
    """
    Add a confirmed scam message to the collection for future learning.
    
    Args:
        text: The scam message text
        metadata: Optional metadata dict (e.g., {"type": "confirmed", "user_id": "xyz"})
    """
    try:
        if metadata is None:
            metadata = {}
        
        metadata["type"] = "confirmed_scam"
        
        # Generate ID based on timestamp
        import time
        doc_id = f"confirmed_{int(time.time() * 1000)}"
        
        collection.add(
            documents=[text],
            metadatas=[metadata],
            ids=[doc_id]
        )
        logger.info(f"Added confirmed scam to collection: {doc_id}")
    
    except Exception as e:
        logger.error(f"Error adding confirmed scam to ChromaDB: {e}")
