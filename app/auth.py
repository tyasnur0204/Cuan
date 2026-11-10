import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app import crud, models
from app.database import get_db

SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY", "finmate-secret-key-change-in-production-2026"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau telah kedaluwarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject: Optional[str] = payload.get("sub")
        if subject is None:
            raise credentials_exception
        user_id = UUID(subject)
    except (JWTError, ValueError):
        raise credentials_exception

    user = crud.get_user(db=db, user_id=user_id)
    if user is None:
        raise credentials_exception
    return user


def verify_api_key(
    api_key: Optional[str] = Depends(api_key_header),
    db: Session = Depends(get_db),
) -> models.APIKey:
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header X-API-Key wajib diisi",
        )

    active_keys = (
        db.query(models.APIKey)
        .filter(models.APIKey.is_active.is_(True))
        .all()
    )
    for key_record in active_keys:
        try:
            if crud.verify_password(api_key, key_record.key_string):
                return key_record
        except Exception:
            continue

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="API Key tidak valid atau tidak aktif",
    )
