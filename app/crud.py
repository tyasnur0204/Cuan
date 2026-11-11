from datetime import date, datetime, timedelta, timezone
import secrets
from decimal import Decimal
from typing import Optional
from uuid import UUID

import bcrypt
from sqlalchemy import extract, func, or_
from sqlalchemy.orm import Session, selectinload

from app import models, schemas


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    plain_bytes = plain_password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(plain_bytes, hashed_password.encode("utf-8"))
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    normalized = email.strip().lower()
    return (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized)
        .first()
    )


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username.strip(),
        email=user.email.strip().lower(),
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


def update_user(
    db: Session, db_user: models.User, user_update: schemas.UserUpdate
) -> models.User:
    try:
        if user_update.username is not None:
            db_user.username = user_update.username.strip()
        if user_update.email is not None:
            db_user.email = user_update.email.strip().lower()
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception:
        db.rollback()
        raise


def update_user_password(
    db: Session, db_user: models.User, new_password: str
) -> models.User:
    try:
        db_user.hashed_password = get_password_hash(new_password)
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


def delete_account(
    db: Session, account_id: UUID, user_id: UUID
) -> bool:
    account = (
        db.query(models.Account)
        .filter(
            models.Account.id == account_id,
            models.Account.user_id == user_id,
        )
        .first()
    )
    if account is None:
        return False
    try:
        db.delete(account)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


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
        elif transaction.type == models.TransactionType.TRANSFER:
            account.balance = current_balance - amount
            if (
                transaction.destination_account_id is not None
                and transaction.destination_account_id != transaction.account_id
            ):
                dest_account = (
                    db.query(models.Account)
                    .filter(models.Account.id == transaction.destination_account_id)
                    .with_for_update()
                    .first()
                )
                if dest_account is None:
                    raise ValueError(
                        f"Destination account with id {transaction.destination_account_id} not found"
                    )
                dest_account.balance = Decimal(dest_account.balance) + amount

        tx_data = transaction.model_dump(exclude={"destination_account_id"})
        db_transaction = models.Transaction(**tx_data)
        db.add(db_transaction)
        db.commit()
        db.refresh(db_transaction)
        return db_transaction
    except Exception:
        db.rollback()
        raise


def delete_transaction(
    db: Session, transaction_id: UUID, user_id: UUID
) -> bool:
    try:
        tx = (
            db.query(models.Transaction)
            .join(models.Account, models.Transaction.account_id == models.Account.id)
            .filter(
                models.Transaction.id == transaction_id,
                models.Account.user_id == user_id,
            )
            .first()
        )
        if tx is None:
            return False

        account = (
            db.query(models.Account)
            .filter(models.Account.id == tx.account_id)
            .with_for_update()
            .first()
        )
        if account is not None:
            amount = Decimal(tx.amount)
            if tx.type == models.TransactionType.INCOME:
                account.balance = Decimal(account.balance) - amount
            elif tx.type == models.TransactionType.EXPENSE:
                account.balance = Decimal(account.balance) + amount

        db.delete(tx)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def get_transactions(
    db: Session,
    month: Optional[int] = None,
    year: Optional[int] = None,
    account_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    tx_type: Optional[models.TransactionType] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[models.Transaction]:
    query = db.query(models.Transaction)
    if user_id is not None:
        query = query.join(
            models.Account, models.Transaction.account_id == models.Account.id
        ).filter(models.Account.user_id == user_id)
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
    if tx_type is not None:
        query = query.filter(models.Transaction.type == tx_type)
    if category:
        query = query.filter(models.Transaction.category == category)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                models.Transaction.category.ilike(pattern),
                models.Transaction.notes.ilike(pattern),
            )
        )

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


def delete_budget(db: Session, budget_id: UUID, user_id: UUID) -> bool:
    budget = (
        db.query(models.Budget)
        .filter(
            models.Budget.id == budget_id,
            models.Budget.user_id == user_id,
        )
        .first()
    )
    if budget is None:
        return False
    try:
        db.delete(budget)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def create_investment_asset(
    db: Session, asset: schemas.InvestmentAssetCreate
) -> models.InvestmentAsset:
    db_asset = models.InvestmentAsset(**asset.model_dump())
    try:
        db.add(db_asset)
        db.commit()
        db.refresh(db_asset)
        return db_asset
    except Exception:
        db.rollback()
        raise


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


def delete_investment_asset(
    db: Session, asset_id: UUID, user_id: UUID
) -> bool:
    asset = (
        db.query(models.InvestmentAsset)
        .filter(
            models.InvestmentAsset.id == asset_id,
            models.InvestmentAsset.user_id == user_id,
        )
        .first()
    )
    if asset is None:
        return False
    try:
        db.delete(asset)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def create_api_key(
    db: Session, name: str
) -> tuple[models.APIKey, str]:
    raw_key = f"fm_{secrets.token_urlsafe(24)}"
    db_key = models.APIKey(
        key_string=get_password_hash(raw_key),
        name=name,
        is_active=True,
    )
    try:
        db.add(db_key)
        db.commit()
        db.refresh(db_key)
        return db_key, raw_key
    except Exception:
        db.rollback()
        raise


def get_api_keys(db: Session) -> list[models.APIKey]:
    return db.query(models.APIKey).order_by(models.APIKey.name.asc()).all()


def toggle_api_key(db: Session, key_id: UUID) -> Optional[models.APIKey]:
    key_obj = db.query(models.APIKey).filter(models.APIKey.id == key_id).first()
    if key_obj is None:
        return None
    try:
        key_obj.is_active = not key_obj.is_active
        db.commit()
        db.refresh(key_obj)
        return key_obj
    except Exception:
        db.rollback()
        raise


def delete_api_key(db: Session, key_id: UUID) -> bool:
    key_obj = db.query(models.APIKey).filter(models.APIKey.id == key_id).first()
    if key_obj is None:
        return False
    try:
        db.delete(key_obj)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


# ---------------------------------------------------------------------------
# Saving Goals (Target Tabungan / Celengan Impian)
# ---------------------------------------------------------------------------


def _today_wib() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=7)).date()


def to_saving_goal_response(goal: models.SavingGoal) -> schemas.SavingGoalResponse:
    target = Decimal(str(goal.target_amount or 0))
    saved = Decimal(str(goal.saved_amount or 0))
    remaining = max(Decimal("0.00"), target - saved)
    progress = (
        min(100.0, round(float((saved / target) * Decimal("100")), 1))
        if target > Decimal("0")
        else 0.0
    )
    contribs = [
        schemas.SavingContributionResponse(
            id=c.id,
            goal_id=c.goal_id,
            account_id=c.account_id,
            account_name=c.account.name if c.account is not None else None,
            transaction_id=c.transaction_id,
            type=c.type,
            amount=c.amount,
            contribution_date=c.contribution_date,
            notes=c.notes,
            created_at=c.created_at,
        )
        for c in (goal.contributions or [])
    ]
    return schemas.SavingGoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        category=goal.category,
        target_amount=target,
        saved_amount=saved,
        target_date=goal.target_date,
        notes=goal.notes,
        is_purchased=bool(goal.is_purchased),
        progress_pct=progress,
        remaining_amount=remaining,
        is_achieved=saved >= target and target > Decimal("0"),
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        contributions=contribs,
    )


def _apply_goal_contribution(
    db: Session,
    goal: models.SavingGoal,
    user_id: UUID,
    contrib_type: str,
    amount: Decimal,
    contribution_date: date,
    account_id: Optional[UUID] = None,
    notes: Optional[str] = None,
) -> models.SavingContribution:
    amt = Decimal(amount)
    current_saved = Decimal(goal.saved_amount or 0)

    if contrib_type == "withdraw":
        if amt > current_saved:
            raise ValueError(
                "Saldo tabungan target tidak mencukupi untuk penarikan ini."
            )
        goal.saved_amount = current_saved - amt
    else:
        goal.saved_amount = current_saved + amt

    linked_tx_id = None
    linked_account_id = None
    clean_notes = notes.strip() if notes and notes.strip() else None

    if account_id is not None:
        account = (
            db.query(models.Account)
            .filter(
                models.Account.id == account_id,
                models.Account.user_id == user_id,
            )
            .with_for_update()
            .first()
        )
        if account is None:
            raise ValueError("Akun sumber dana tidak ditemukan.")

        if contrib_type == "withdraw":
            account.balance = Decimal(account.balance) + amt
            tx_note = f"Tarik Tabungan: {goal.title}" + (
                f" ({clean_notes})" if clean_notes else ""
            )
        else:
            account.balance = Decimal(account.balance) - amt
            tx_note = f"Nabung: {goal.title}" + (
                f" ({clean_notes})" if clean_notes else ""
            )

        tx = models.Transaction(
            account_id=account.id,
            type=models.TransactionType.TRANSFER,
            category="Target Tabungan",
            amount=amt,
            transaction_date=contribution_date,
            notes=tx_note,
            is_business=bool(account.is_business_account),
        )
        db.add(tx)
        db.flush()
        linked_tx_id = tx.id
        linked_account_id = account.id

    db_contrib = models.SavingContribution(
        goal_id=goal.id,
        account_id=linked_account_id,
        transaction_id=linked_tx_id,
        type=contrib_type,
        amount=amt,
        contribution_date=contribution_date,
        notes=clean_notes,
    )
    db.add(db_contrib)
    goal.updated_at = datetime.now(timezone.utc)
    return db_contrib


def _load_goal_with_relations(
    db: Session, goal_id: UUID, user_id: UUID
) -> Optional[models.SavingGoal]:
    return (
        db.query(models.SavingGoal)
        .options(
            selectinload(models.SavingGoal.contributions).selectinload(
                models.SavingContribution.account
            )
        )
        .filter(
            models.SavingGoal.id == goal_id,
            models.SavingGoal.user_id == user_id,
        )
        .first()
    )


def get_saving_goals(
    db: Session, user_id: UUID, skip: int = 0, limit: int = 100
) -> list[schemas.SavingGoalResponse]:
    goals = (
        db.query(models.SavingGoal)
        .options(
            selectinload(models.SavingGoal.contributions).selectinload(
                models.SavingContribution.account
            )
        )
        .filter(models.SavingGoal.user_id == user_id)
        .order_by(
            models.SavingGoal.is_purchased.asc(),
            models.SavingGoal.created_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [to_saving_goal_response(g) for g in goals]


def get_saving_goal_response(
    db: Session, goal_id: UUID, user_id: UUID
) -> Optional[schemas.SavingGoalResponse]:
    goal = _load_goal_with_relations(db=db, goal_id=goal_id, user_id=user_id)
    if goal is None:
        return None
    return to_saving_goal_response(goal)


def create_saving_goal(
    db: Session, user_id: UUID, payload: schemas.SavingGoalCreate
) -> schemas.SavingGoalResponse:
    try:
        db_goal = models.SavingGoal(
            user_id=user_id,
            title=payload.title.strip(),
            category=(payload.category or "Barang Impian").strip(),
            target_amount=Decimal(payload.target_amount),
            saved_amount=Decimal("0.00"),
            target_date=payload.target_date,
            notes=payload.notes.strip() if payload.notes and payload.notes.strip() else None,
        )
        db.add(db_goal)
        db.flush()

        if Decimal(payload.initial_amount) > Decimal("0"):
            _apply_goal_contribution(
                db=db,
                goal=db_goal,
                user_id=user_id,
                contrib_type="deposit",
                amount=Decimal(payload.initial_amount),
                contribution_date=_today_wib(),
                account_id=payload.account_id,
                notes="Setoran awal",
            )

        db.commit()
        loaded = _load_goal_with_relations(db=db, goal_id=db_goal.id, user_id=user_id)
        return to_saving_goal_response(loaded)
    except Exception:
        db.rollback()
        raise


def update_saving_goal(
    db: Session, goal_id: UUID, user_id: UUID, payload: schemas.SavingGoalUpdate
) -> Optional[schemas.SavingGoalResponse]:
    try:
        goal = (
            db.query(models.SavingGoal)
            .filter(
                models.SavingGoal.id == goal_id,
                models.SavingGoal.user_id == user_id,
            )
            .with_for_update()
            .first()
        )
        if goal is None:
            return None

        if payload.title is not None:
            goal.title = payload.title.strip()
        if payload.category is not None:
            goal.category = payload.category.strip()
        if payload.target_amount is not None:
            goal.target_amount = Decimal(payload.target_amount)
        if payload.clear_target_date:
            goal.target_date = None
        elif payload.target_date is not None:
            goal.target_date = payload.target_date
        if payload.notes is not None:
            goal.notes = payload.notes.strip() or None
        if payload.is_purchased is not None:
            goal.is_purchased = payload.is_purchased

        goal.updated_at = datetime.now(timezone.utc)
        db.commit()
        loaded = _load_goal_with_relations(db=db, goal_id=goal_id, user_id=user_id)
        return to_saving_goal_response(loaded)
    except Exception:
        db.rollback()
        raise


def contribute_saving_goal(
    db: Session,
    goal_id: UUID,
    user_id: UUID,
    payload: schemas.SavingContributionCreate,
) -> Optional[schemas.SavingGoalResponse]:
    try:
        goal = (
            db.query(models.SavingGoal)
            .filter(
                models.SavingGoal.id == goal_id,
                models.SavingGoal.user_id == user_id,
            )
            .with_for_update()
            .first()
        )
        if goal is None:
            return None

        _apply_goal_contribution(
            db=db,
            goal=goal,
            user_id=user_id,
            contrib_type=payload.type,
            amount=Decimal(payload.amount),
            contribution_date=payload.contribution_date or _today_wib(),
            account_id=payload.account_id,
            notes=payload.notes,
        )
        db.commit()
        loaded = _load_goal_with_relations(db=db, goal_id=goal_id, user_id=user_id)
        return to_saving_goal_response(loaded)
    except Exception:
        db.rollback()
        raise


def delete_saving_contribution(
    db: Session, goal_id: UUID, contribution_id: UUID, user_id: UUID
) -> Optional[schemas.SavingGoalResponse]:
    try:
        goal = (
            db.query(models.SavingGoal)
            .filter(
                models.SavingGoal.id == goal_id,
                models.SavingGoal.user_id == user_id,
            )
            .with_for_update()
            .first()
        )
        if goal is None:
            return None

        contrib = (
            db.query(models.SavingContribution)
            .filter(
                models.SavingContribution.id == contribution_id,
                models.SavingContribution.goal_id == goal_id,
            )
            .first()
        )
        if contrib is None:
            raise ValueError("Riwayat setoran tidak ditemukan.")

        amt = Decimal(contrib.amount)
        if contrib.type == "withdraw":
            goal.saved_amount = Decimal(goal.saved_amount) + amt
        else:
            if Decimal(goal.saved_amount) < amt:
                raise ValueError(
                    "Setoran tidak dapat dihapus karena sebagian dananya sudah ditarik."
                )
            goal.saved_amount = Decimal(goal.saved_amount) - amt

        if contrib.account_id is not None and contrib.transaction_id is not None:
            account = (
                db.query(models.Account)
                .filter(
                    models.Account.id == contrib.account_id,
                    models.Account.user_id == user_id,
                )
                .with_for_update()
                .first()
            )
            if account is not None:
                if contrib.type == "withdraw":
                    account.balance = Decimal(account.balance) - amt
                else:
                    account.balance = Decimal(account.balance) + amt

            tx = (
                db.query(models.Transaction)
                .filter(models.Transaction.id == contrib.transaction_id)
                .first()
            )
            if tx is not None:
                db.delete(tx)

        db.delete(contrib)
        goal.updated_at = datetime.now(timezone.utc)
        db.commit()
        loaded = _load_goal_with_relations(db=db, goal_id=goal_id, user_id=user_id)
        return to_saving_goal_response(loaded)
    except Exception:
        db.rollback()
        raise


def delete_saving_goal(db: Session, goal_id: UUID, user_id: UUID) -> bool:
    goal = (
        db.query(models.SavingGoal)
        .filter(
            models.SavingGoal.id == goal_id,
            models.SavingGoal.user_id == user_id,
        )
        .first()
    )
    if goal is None:
        return False
    try:
        db.delete(goal)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
