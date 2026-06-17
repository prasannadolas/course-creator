import os
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import datetime

# ── 1. SUPABASE CONNECTION ──
if os.environ.get("RENDER"):
    # PRODUCTION (Render): Using the IPv4 Connection Pooler for deployment
    # ⚠️ IMPORTANT: If Render crashes, you must replace the URL below with the EXACT "Connection Pooler" URI from your Supabase Dashboard!
    DATABASE_URL = "postgresql://postgres.ouscmjufewdqqfgkqewm:EduGenesis1234567891@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
else:
    # LOCAL (VS Code): Using the Direct Connection to avoid the tenant bug locally
    DATABASE_URL = "postgresql://postgres:EduGenesis1234567891@db.ouscmjufewdqqfgkqewm.supabase.co:5432/postgres"

# ── 2. ENGINE CONFIGURATION ──
# We removed the SQLite fallback entirely. Your app will strictly use Supabase now!
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # Checks if connection is alive before trying to save
    pool_recycle=300      # Refreshes the connection every 5 minutes
)
print("🚀 Connected to Cloud Database (Supabase)")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ── 3. YOUR EXACT DATABASE MODELS ──
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    
    courses = relationship("Course", back_populates="owner")

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True)
    audience = Column(String)
    full_content = Column(Text) # The generated markdown
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="courses")

# Create the tables in the Supabase cloud automatically
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()