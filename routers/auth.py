from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, get_password_hash, verify_password
from database import get_db
from models import Rep, User
from schemas import Token, UserOut, UserRegister

router = APIRouter()


def token_for_user(user: User, db: Session) -> Token:
    rep_name = None
    if user.rep_id is not None:
        rep = db.query(Rep).filter(Rep.id == user.rep_id).first()
        rep_name = rep.name if rep else None

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "rep_id": user.rep_id,
        }
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        rep_id=user.rep_id,
        name=rep_name if user.role == "rep" and rep_name else user.email,
    )


@router.post("/register", response_model=UserOut)
def register_user(request: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    if request.role == "rep":
        if request.rep_id is None:
            raise HTTPException(status_code=400, detail="rep_id is required for reps")
        rep = db.query(Rep).filter(Rep.id == request.rep_id).first()
        if rep is None:
            raise HTTPException(status_code=400, detail="Rep not found")
    elif request.rep_id is not None:
        raise HTTPException(status_code=400, detail="Managers cannot have a rep_id")

    user = User(
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role=request.role,
        rep_id=request.rep_id,
        created_at=datetime.now().isoformat(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_for_user(user, db)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
