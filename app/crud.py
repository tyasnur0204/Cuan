from decimal import Decimal
from typing import Optional
from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app import models, schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
    )
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception:
        db.rollback()
        raise


def get_user(db: Session, user_id: UUID) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_users(
    db: Session, skip: int = 0, limit: int = 100
) -> list[models.User]:
    return db.query(models.User).offset(skip).limit(limit).all()


def create_account(db: Session, account: schemas.AccountCreate) -> models.Account:
    db_account = models.Account(**account.model_dump())
    try:
        db.add(db_account)
        db.commit()
        db.refresh(db_account)
        return db_account
    except Exception:
        db.rollback()
        raise


def get_account(db: Session, account_id: UUID) -> Optional[models.Account]:
    return db.query(models.Account).filter(models.Account.id == account_id).first()


def get_accounts(
    db: Session, user_id: Optional[UUID] = None, skip: int = 0, limit: int = 100
) -> list[models.Account]:
    query = db.query(models.Account)
    if user_id is not None:
        query = query.filter(models.Account.user_id == user_id)
    return query.offset(skip).limit(limit).all()


def create_transaction(
    db: Session, transaction: schemas.TransactionCreate
) -> models.Transaction:
    try:
        account = (
            db.query(models.Account)
            .filter(models.Account.id == transaction.account_id)
            .with_for_update()
            .first()
        )
        if account is None:
            raise ValueError(f"Account with id {transaction.account_id} not found")

        current_balance = Decimal(account.balance)
        amount = Decimal(transaction.amount)

        if transaction.type == models.TransactionType.INCOME:
            account.balance = current_balance + amount
        elif transaction.type == models.TransactionType.EXPENSE:
            account.balance = current_balance - amount

        db_transaction = models.Transaction(**transaction.model_dump())
        db.add(db_transaction)
        db.commit()
        db.refresh(db_transaction)
        return db_transaction
    except Exception:
        db.rollback()
        raise


def get_transactions(
    db: Session,
    month: Optional[int] = None,
    year: Optional[int] = None,
    account_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[models.Transaction]:
    query = db.query(models.Transaction)
    if month is not None:
        query = query.filter(
            extract("month", models.Transaction.transaction_date) == month
        )
    if year is not None:
        query = query.filter(
            extract("year", models.Transaction.transaction_date) == year
        )
    if account_id is not None:
        query = query.filter(models.Transaction.account_id == account_id)

    return (
        query.order_by(models.Transaction.transaction_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_budget(db: Session, budget: schemas.BudgetCreate) -> models.Budget:
    db_budget = models.Budget(**budget.model_dump())
    try:
        db.add(db_budget)
        db.commit()
        db.refresh(db_budget)
        return db_budget
    except Exception:
        db.rollback()
        raise


def get_budgets(
    db: Session,
    user_id: Optional[UUID] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[models.Budget]:
    query = db.query(models.Budget)
    if user_id is not None:
        query = query.filter(models.Budget.user_id == user_id)
    if month is not None:
        query = query.filter(models.Budget.month == month)
    if year is not None:
        query = query.filter(models.Budget.year == year)
    return query.offset(skip).limit(limit).all()


def get_investment_assets(
    db: Session,
    user_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[models.InvestmentAsset]:
    query = db.query(models.InvestmentAsset)
    if user_id is not None:
        query = query.filter(models.InvestmentAsset.user_id == user_id)
    return query.offset(skip).limit(limit).all()


def get_investment_asset(
    db: Session, asset_id: UUID
) -> Optional[models.InvestmentAsset]:
    return (
        db.query(models.InvestmentAsset)
        .filter(models.InvestmentAsset.id == asset_id)
        .first()
    )
