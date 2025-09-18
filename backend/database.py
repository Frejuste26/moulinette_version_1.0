import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from models.session import Base
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, database_url=None):
        self.database_url = database_url or os.getenv('DATABASE_URL', 'sqlite:///database/sage_x3.db')
        
        # Créer le dossier database si nécessaire
        if self.database_url.startswith('sqlite:///'):
            db_path = self.database_url.replace('sqlite:///', '')
            db_dir = os.path.dirname(db_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
        
        is_sqlite = self.database_url.startswith('sqlite:///')
        connect_args = {"check_same_thread": False} if is_sqlite else {}
        self.engine = create_engine(
            self.database_url,
            echo=False,  # Mettre à True pour debug SQL
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args=connect_args
        )
        
        self.SessionLocal = scoped_session(sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
            expire_on_commit=False  # Évite que les objets deviennent détachés après commit
        ))
        
        # Optimisations SQLite
        if is_sqlite:
            try:
                with self.engine.begin() as conn:
                    conn.execute(text("PRAGMA journal_mode=WAL"))
                    conn.execute(text("PRAGMA synchronous=NORMAL"))
                    conn.execute(text("PRAGMA foreign_keys=ON"))
            except Exception as e:
                logger.warning(f"Impossible d'appliquer les PRAGMAs SQLite: {e}")

        self.create_tables()
    
    def create_tables(self):
        """Crée toutes les tables"""
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("Tables créées avec succès")
        except Exception as e:
            logger.error(f"Erreur création tables: {e}")
            raise
    
    def get_session(self):
        """Retourne une session de base de données"""
        return self.SessionLocal()
    
    def close_session(self):
        """Ferme la session"""
        self.SessionLocal.remove()
    
    def health_check(self):
        """Vérifie la santé de la base de données"""
        try:
            session = self.get_session()
            session.execute(text("SELECT 1"))
            session.close()
            return True
        except Exception as e:
            logger.error(f"Health check DB failed: {e}")
            return False

# Instance globale
db_manager = DatabaseManager()