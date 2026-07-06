import os
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import datetime

# ── 1. SUPABASE CONNECTION ──
if os.environ.get("RENDER"):
    DATABASE_URL = "postgresql://postgres.ouscmjufewdqqfgkqewm:EduGenesis1234567891@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
else:
    DATABASE_URL = "postgresql://postgres:EduGenesis1234567891@db.ouscmjufewdqqfgkqewm.supabase.co:5432/postgres"

# ── 2. ENGINE CONFIGURATION ──
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  
    pool_recycle=300   
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

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()