from datetime import datetime, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import ssl
import time
from typing import Optional
import urllib.error
import urllib.request
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import auth, crud, models, schemas
from app.database import engine, get_db

# ---------------------------------------------------------------------------
# Auto-create tables and safely ensure new columns on startup
# ---------------------------------------------------------------------------
models.Base.metadata.create_all(bind=engine)
if engine.dialect.name == "postgresql":
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE investment_assets "
                "ADD COLUMN IF NOT EXISTS invested_amount NUMERIC(18, 2) "
                "NOT NULL DEFAULT 0.00"
            )
        )
        conn.execute(text("DROP INDEX IF EXISTS ix_users_username"))
        conn.execute(
            text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key")
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_users_username ON users (username)")
        )

# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CUAN – Catat Uang, Aset Naik",
    description="Backend API CUAN (Catat Uang, Aset Naik) untuk pencatatan transaksi, budgeting, laporan, dan pelacakan investasi.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INFLATION_RATE: Decimal = Decimal("3.2")
MONTH_LABELS_ID = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
]


def _get_recent_months(end_month: int, end_year: int, count: int = 6) -> list[tuple[int, int]]:
    months = []
    m, y = end_month, end_year
    for _ in range(count):
        months.append((m, y))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()
    return months


# ---------------------------------------------------------------------------
# Auth (Register, Login, Profile)
# ---------------------------------------------------------------------------


@app.post(
    "/api/v1/register",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
def register_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
) -> schemas.UserResponse:
    if crud.get_user_by_email(db=db, email=user.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email sudah terdaftar",
        )
    try:
        return crud.create_user(db=db, user=user)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email sudah terdaftar",
        )


@app.post(
    "/api/v1/login",
    response_model=schemas.Token,
    tags=["Auth"],
)
def login_user(
    credentials: schemas.UserLogin,
    db: Session = Depends(get_db),
) -> schemas.Token:
    user = crud.get_user_by_email(db=db, email=credentials.email)
    if user is None or not crud.verify_password(
        credentials.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return schemas.Token(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UserResponse.model_validate(user),
    )


@app.get(
    "/api/v1/me",
    response_model=schemas.UserResponse,
    tags=["Auth"],
)
def get_me(
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.UserResponse:
    return current_user


@app.put(
    "/api/v1/me",
    response_model=schemas.UserResponse,
    tags=["Auth"],
)
def update_me(
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.UserResponse:
    if user_update.email is not None:
        existing = crud.get_user_by_email(db=db, email=user_update.email)
        if existing is not None and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email sudah digunakan",
            )
    try:
        return crud.update_user(db=db, db_user=current_user, user_update=user_update)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email sudah digunakan",
        )


@app.put(
    "/api/v1/me/password",
    tags=["Auth"],
)
def update_my_password(
    payload: schemas.PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    if not crud.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password saat ini tidak sesuai",
        )
    crud.update_user_password(db=db, db_user=current_user, new_password=payload.new_password)
    return {"message": "Password berhasil diperbarui"}


# ---------------------------------------------------------------------------
# Users & Accounts
# ---------------------------------------------------------------------------


@app.post(
    "/api/v1/users",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Users"],
)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
) -> schemas.UserResponse:
    return crud.create_user(db=db, user=user)


@app.get(
    "/api/v1/users",
    response_model=list[schemas.UserResponse],
    tags=["Users"],
)
def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> list[schemas.UserResponse]:
    return crud.get_users(db=db, skip=skip, limit=limit)


@app.post(
    "/api/v1/accounts",
    response_model=schemas.AccountResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Accounts"],
)
def create_account(
    account: schemas.AccountCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.AccountResponse:
    if account.user_id is not None and account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak dapat membuat akun untuk pengguna lain",
        )
    scoped_account = account.model_copy(update={"user_id": current_user.id})
    return crud.create_account(db=db, account=scoped_account)


@app.get(
    "/api/v1/accounts",
    response_model=list[schemas.AccountResponse],
    tags=["Accounts"],
)
def list_accounts(
    user_id: Optional[UUID] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[schemas.AccountResponse]:
    if user_id is not None and user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ke akun pengguna lain ditolak",
        )
    return crud.get_accounts(db=db, user_id=current_user.id, skip=skip, limit=limit)


@app.delete(
    "/api/v1/accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Accounts"],
)
def delete_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> None:
    deleted = crud.delete_account(db=db, account_id=account_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Akun tidak ditemukan",
        )


# ---------------------------------------------------------------------------
# Transactions (JWT + M2M Auto-Log)
# ---------------------------------------------------------------------------


@app.post(
    "/api/v1/transactions",
    response_model=schemas.TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Transactions"],
)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.TransactionResponse:
    try:
        return crud.create_transaction(
            db=db, transaction=transaction, user_id=current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@app.get(
    "/api/v1/transactions",
    response_model=list[schemas.TransactionResponse],
    tags=["Transactions"],
)
def list_transactions(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    account_id: Optional[UUID] = Query(default=None),
    type: Optional[models.TransactionType] = Query(default=None),
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[schemas.TransactionResponse]:
    return crud.get_transactions(
        db=db,
        month=month,
        year=year,
        account_id=account_id,
        user_id=current_user.id,
        tx_type=type,
        category=category,
        search=search,
        skip=skip,
        limit=limit,
    )


@app.delete(
    "/api/v1/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Transactions"],
)
def delete_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> None:
    deleted = crud.delete_transaction(
        db=db, transaction_id=transaction_id, user_id=current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaksi tidak ditemukan",
        )


@app.post(
    "/api/v1/transactions/auto-log",
    response_model=schemas.TransactionAutoLogResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Transactions"],
)
def auto_log_transaction(
    payload: schemas.TransactionAutoLogCreate,
    db: Session = Depends(get_db),
    api_key: models.APIKey = Depends(auth.verify_api_key),
) -> schemas.TransactionAutoLogResponse:
    try:
        account = (
            db.query(models.Account)
            .filter(models.Account.is_business_account.is_(True))
            .with_for_update()
            .first()
        )
        if account is None:
            user = db.query(models.User).first()
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Akun bisnis belum tersedia dan belum ada pengguna terdaftar.",
                )
            account = models.Account(
                user_id=user.id,
                name="Kas Usaha",
                type=models.AccountType.CASH,
                balance=Decimal("0.00"),
                is_business_account=True,
            )
            db.add(account)
            db.flush()

        account.is_business_account = True
        account.balance = Decimal(account.balance) + Decimal(payload.nominal)

        db_transaction = models.Transaction(
            account_id=account.id,
            type=models.TransactionType.INCOME,
            category="Pemasukan Usaha",
            amount=payload.nominal,
            transaction_date=payload.tanggal,
            notes=f"Auto-log M2M ({api_key.name})",
            is_business=True,
        )
        db.add(db_transaction)
        db.commit()
        db.refresh(db_transaction)

        return schemas.TransactionAutoLogResponse(
            id=db_transaction.id,
            account_id=db_transaction.account_id,
            type=db_transaction.type,
            category=db_transaction.category,
            amount=db_transaction.amount,
            transaction_date=db_transaction.transaction_date,
            notes=db_transaction.notes,
            is_business=db_transaction.is_business,
            is_business_account=account.is_business_account,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------


@app.post(
    "/api/v1/budgets",
    response_model=schemas.BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Budgets"],
)
def create_budget(
    budget: schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.BudgetResponse:
    scoped = budget.model_copy(update={"user_id": current_user.id})
    return crud.create_budget(db=db, budget=scoped)


@app.get(
    "/api/v1/budgets",
    response_model=list[schemas.BudgetResponse],
    tags=["Budgets"],
)
def list_budgets(
    user_id: Optional[UUID] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[schemas.BudgetResponse]:
    effective_user_id = current_user.id
    return crud.get_budgets(
        db=db, user_id=effective_user_id, month=month, year=year, skip=skip, limit=limit
    )


@app.delete(
    "/api/v1/budgets/{budget_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Budgets"],
)
def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> None:
    deleted = crud.delete_budget(db=db, budget_id=budget_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget tidak ditemukan",
        )


# ---------------------------------------------------------------------------
# Dashboard Summary
# ---------------------------------------------------------------------------


@app.get(
    "/api/v1/dashboard/summary",
    tags=["Dashboard"],
)
def dashboard_summary(
    user_id: Optional[UUID] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    inflation_rate: Decimal = Query(default=INFLATION_RATE, ge=Decimal("0")),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    effective_user_id = current_user.id

    accounts = crud.get_accounts(db=db, user_id=effective_user_id, limit=1000)
    account_name_map = {acc.id: acc.name for acc in accounts}
    total_assets = sum(Decimal(str(acc.balance)) for acc in accounts)
    cash_balance = sum(
        Decimal(str(acc.balance))
        for acc in accounts
        if acc.type != models.AccountType.INVESTMENT
    )

    transactions = crud.get_transactions(
        db=db,
        month=target_month,
        year=target_year,
        user_id=effective_user_id,
        limit=5000,
    )
    total_income_this_month = sum(
        Decimal(str(t.amount))
        for t in transactions
        if t.type == models.TransactionType.INCOME
    )
    total_expenses_this_month = sum(
        Decimal(str(t.amount))
        for t in transactions
        if t.type == models.TransactionType.EXPENSE
    )

    budgets = crud.get_budgets(
        db=db,
        user_id=effective_user_id,
        month=target_month,
        year=target_year,
        limit=1000,
    )
    total_budget_limit = sum(Decimal(str(b.limit_amount)) for b in budgets)
    remaining_budget = total_budget_limit - total_expenses_this_month

    # Net real investment growth vs inflation
    assets = crud.get_investment_assets(db=db, user_id=effective_user_id, limit=1000)
    if assets:
        total_invested = sum(Decimal(str(a.invested_amount or 0)) for a in assets)
        if total_invested > Decimal("0"):
            weighted_return = (
                sum(
                    Decimal(str(a.annual_return_rate)) * Decimal(str(a.invested_amount or 0))
                    for a in assets
                )
                / total_invested
            )
        else:
            weighted_return = sum(
                Decimal(str(a.annual_return_rate)) for a in assets
            ) / Decimal(len(assets))
        net_real_growth_pct = weighted_return - inflation_rate
    else:
        net_real_growth_pct = Decimal("0.0")

    # 6-month cashflow trend
    monthly_cashflow = []
    for m, y in _get_recent_months(target_month, target_year, count=6):
        m_txs = crud.get_transactions(
            db=db,
            month=m,
            year=y,
            user_id=effective_user_id,
            limit=5000,
        )
        m_income = sum(
            Decimal(str(t.amount))
            for t in m_txs
            if t.type == models.TransactionType.INCOME
        )
        m_expense = sum(
            Decimal(str(t.amount))
            for t in m_txs
            if t.type == models.TransactionType.EXPENSE
        )
        monthly_cashflow.append(
            {
                "label": MONTH_LABELS_ID[m],
                "month": m,
                "year": y,
                "income": float(m_income),
                "expense": float(m_expense),
            }
        )

    # Latest 5 transactions across all time for the user
    latest_txs = crud.get_transactions(
        db=db, user_id=effective_user_id, skip=0, limit=5
    )
    recent_transactions = [
        {
            "id": str(t.id),
            "account_id": str(t.account_id),
            "account_name": account_name_map.get(t.account_id, "-"),
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "category": t.category,
            "amount": float(t.amount),
            "transaction_date": t.transaction_date.isoformat(),
            "notes": t.notes,
            "is_business": t.is_business,
        }
        for t in latest_txs
    ]

    # Saving goals overview
    saving_goals = crud.get_saving_goals(db=db, user_id=effective_user_id, limit=200)
    active_goals = [g for g in saving_goals if not g.is_purchased]
    total_goals_saved = sum((g.saved_amount for g in active_goals), Decimal("0.00"))
    total_goals_target = sum((g.target_amount for g in active_goals), Decimal("0.00"))
    achieved_goals_count = sum(1 for g in saving_goals if g.is_achieved or g.is_purchased)
    top_goals = [
        {
            "id": str(g.id),
            "title": g.title,
            "category": g.category,
            "saved_amount": float(g.saved_amount),
            "target_amount": float(g.target_amount),
            "progress_pct": g.progress_pct,
            "is_achieved": g.is_achieved,
            "target_date": g.target_date.isoformat() if g.target_date else None,
        }
        for g in active_goals[:3]
    ]

    return {
        "period": {
            "month": target_month,
            "year": target_year,
        },
        "total_assets": float(total_assets),
        "cash_balance": float(cash_balance),
        "current_month_income": float(total_income_this_month),
        "current_month_expenses": float(total_expenses_this_month),
        "total_budget_limit": float(total_budget_limit),
        "remaining_budget": float(remaining_budget),
        "net_real_growth_pct": round(float(net_real_growth_pct), 2),
        "inflation_rate_pct": float(inflation_rate),
        "monthly_cashflow": monthly_cashflow,
        "recent_transactions": recent_transactions,
        "saving_goals_summary": {
            "total_saved": float(total_goals_saved),
            "total_target": float(total_goals_target),
            "active_count": len(active_goals),
            "achieved_count": achieved_goals_count,
            "top_goals": top_goals,
        },
    }


# ---------------------------------------------------------------------------
# Investments – CRUD & Inflation Check
# ---------------------------------------------------------------------------


@app.post(
    "/api/v1/investments",
    response_model=schemas.InvestmentAssetResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Investments"],
)
def create_investment_asset(
    asset: schemas.InvestmentAssetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.InvestmentAssetResponse:
    scoped = asset.model_copy(update={"user_id": current_user.id})
    return crud.create_investment_asset(db=db, asset=scoped)


@app.delete(
    "/api/v1/investments/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Investments"],
)
def delete_investment_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> None:
    deleted = crud.delete_investment_asset(
        db=db, asset_id=asset_id, user_id=current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aset investasi tidak ditemukan",
        )


@app.get(
    "/api/v1/investments/inflation-check",
    tags=["Investments"],
)
def inflation_check(
    user_id: Optional[UUID] = Query(default=None),
    inflation_rate: Decimal = Query(
        default=INFLATION_RATE,
        ge=Decimal("0"),
        description="Laju inflasi tahunan dalam persen (default: 3.2%)",
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    effective_user_id = current_user.id
    assets = crud.get_investment_assets(db=db, user_id=effective_user_id, limit=1000)
    accounts = crud.get_accounts(db=db, user_id=effective_user_id, limit=1000)
    inv_accounts_balance = sum(
        Decimal(str(acc.balance))
        for acc in accounts
        if acc.type == models.AccountType.INVESTMENT
    )

    result = []
    class_totals: dict[str, Decimal] = {}
    total_asset_value = Decimal("0.00")

    for asset in assets:
        annual_return = Decimal(str(asset.annual_return_rate))
        net_real_return = annual_return - inflation_rate
        inv_val = Decimal(str(asset.invested_amount or 0))
        total_asset_value += inv_val
        cls_name = (
            asset.asset_class.value
            if hasattr(asset.asset_class, "value")
            else str(asset.asset_class)
        )
        class_totals[cls_name] = class_totals.get(cls_name, Decimal("0.00")) + inv_val

        result.append(
            {
                "asset_id": str(asset.id),
                "asset_name": asset.asset_name,
                "asset_class": cls_name,
                "annual_return_rate_pct": float(annual_return),
                "invested_amount": float(inv_val),
                "inflation_rate_pct": float(inflation_rate),
                "net_real_return_pct": float(net_real_return),
                "beats_inflation": net_real_return > Decimal("0"),
            }
        )

    effective_total_value = (
        total_asset_value if total_asset_value > Decimal("0") else inv_accounts_balance
    )

    allocation_by_class = []
    if total_asset_value > Decimal("0"):
        for cls_name, val in class_totals.items():
            pct = (val / total_asset_value) * Decimal("100")
            allocation_by_class.append(
                {
                    "asset_class": cls_name,
                    "amount": float(val),
                    "percentage": round(float(pct), 1),
                }
            )
    elif assets:
        class_counts: dict[str, int] = {}
        for asset in assets:
            cls_name = (
                asset.asset_class.value
                if hasattr(asset.asset_class, "value")
                else str(asset.asset_class)
            )
            class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
        for cls_name, cnt in class_counts.items():
            pct = (cnt / len(assets)) * 100
            allocation_by_class.append(
                {
                    "asset_class": cls_name,
                    "amount": 0.0,
                    "percentage": round(pct, 1),
                }
            )

    return {
        "inflation_rate_pct": float(inflation_rate),
        "total_assets_checked": len(result),
        "total_invested_value": float(effective_total_value),
        "allocation_by_class": allocation_by_class,
        "assets": result,
    }


# ---------------------------------------------------------------------------
# Financial Reports
# ---------------------------------------------------------------------------


@app.get(
    "/api/v1/reports/summary",
    tags=["Reports"],
)
def reports_summary(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year

    txs = crud.get_transactions(
        db=db,
        month=target_month,
        year=target_year,
        user_id=current_user.id,
        limit=5000,
    )

    total_income = Decimal("0.00")
    total_expenses = Decimal("0.00")
    expense_map: dict[str, Decimal] = {}
    income_map: dict[str, Decimal] = {}

    for t in txs:
        amt = Decimal(str(t.amount))
        if t.type == models.TransactionType.INCOME:
            total_income += amt
            income_map[t.category] = income_map.get(t.category, Decimal("0.00")) + amt
        elif t.type == models.TransactionType.EXPENSE:
            total_expenses += amt
            expense_map[t.category] = expense_map.get(t.category, Decimal("0.00")) + amt

    expense_by_category = [
        {
            "category": cat,
            "amount": float(val),
            "percentage": round(
                float((val / total_expenses) * Decimal("100"))
                if total_expenses > 0
                else 0.0,
                1,
            ),
        }
        for cat, val in sorted(expense_map.items(), key=lambda kv: kv[1], reverse=True)
    ]

    income_by_category = [
        {
            "category": cat,
            "amount": float(val),
            "percentage": round(
                float((val / total_income) * Decimal("100"))
                if total_income > 0
                else 0.0,
                1,
            ),
        }
        for cat, val in sorted(income_map.items(), key=lambda kv: kv[1], reverse=True)
    ]

    monthly_comparison = []
    for m, y in _get_recent_months(target_month, target_year, count=6):
        m_txs = crud.get_transactions(
            db=db, month=m, year=y, user_id=current_user.id, limit=5000
        )
        m_inc = sum(
            Decimal(str(t.amount))
            for t in m_txs
            if t.type == models.TransactionType.INCOME
        )
        m_exp = sum(
            Decimal(str(t.amount))
            for t in m_txs
            if t.type == models.TransactionType.EXPENSE
        )
        monthly_comparison.append(
            {
                "label": MONTH_LABELS_ID[m],
                "month": m,
                "year": y,
                "income": float(m_inc),
                "expense": float(m_exp),
            }
        )

    return {
        "period": {"month": target_month, "year": target_year},
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "net_savings": float(total_income - total_expenses),
        "expense_by_category": expense_by_category,
        "income_by_category": income_by_category,
        "monthly_comparison": monthly_comparison,
    }


# ---------------------------------------------------------------------------
# Saving Goals (Target Tabungan / Celengan Impian)
# ---------------------------------------------------------------------------


@app.get(
    "/api/v1/goals",
    response_model=list[schemas.SavingGoalResponse],
    tags=["Saving Goals"],
)
def list_saving_goals(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[schemas.SavingGoalResponse]:
    return crud.get_saving_goals(db=db, user_id=current_user.id, skip=skip, limit=limit)


@app.post(
    "/api/v1/goals",
    response_model=schemas.SavingGoalResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Saving Goals"],
)
def create_saving_goal(
    payload: schemas.SavingGoalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.SavingGoalResponse:
    try:
        return crud.create_saving_goal(db=db, user_id=current_user.id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@app.get(
    "/api/v1/goals/{goal_id}",
    response_model=schemas.SavingGoalResponse,
    tags=["Saving Goals"],
)
def get_saving_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.SavingGoalResponse:
    goal = crud.get_saving_goal_response(db=db, goal_id=goal_id, user_id=current_user.id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target tabungan tidak ditemukan",
        )
    return goal


@app.patch(
    "/api/v1/goals/{goal_id}",
    response_model=schemas.SavingGoalResponse,
    tags=["Saving Goals"],
)
def update_saving_goal(
    goal_id: UUID,
    payload: schemas.SavingGoalUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.SavingGoalResponse:
    goal = crud.update_saving_goal(
        db=db, goal_id=goal_id, user_id=current_user.id, payload=payload
    )
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target tabungan tidak ditemukan",
        )
    return goal


@app.delete(
    "/api/v1/goals/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Saving Goals"],
)
def delete_saving_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> None:
    deleted = crud.delete_saving_goal(db=db, goal_id=goal_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target tabungan tidak ditemukan",
        )


@app.post(
    "/api/v1/goals/{goal_id}/contribute",
    response_model=schemas.SavingGoalResponse,
    tags=["Saving Goals"],
)
def contribute_saving_goal(
    goal_id: UUID,
    payload: schemas.SavingContributionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.SavingGoalResponse:
    try:
        goal = crud.contribute_saving_goal(
            db=db, goal_id=goal_id, user_id=current_user.id, payload=payload
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target tabungan tidak ditemukan",
        )
    return goal


@app.delete(
    "/api/v1/goals/{goal_id}/contributions/{contribution_id}",
    response_model=schemas.SavingGoalResponse,
    tags=["Saving Goals"],
)
def delete_saving_contribution(
    goal_id: UUID,
    contribution_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.SavingGoalResponse:
    try:
        goal = crud.delete_saving_contribution(
            db=db,
            goal_id=goal_id,
            contribution_id=contribution_id,
            user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target tabungan tidak ditemukan",
        )
    return goal


# ---------------------------------------------------------------------------
# M2M API Keys Management (Integrasi Eksternal)
# ---------------------------------------------------------------------------


@app.get(
    "/api/v1/api-keys",
    response_model=list[schemas.APIKeyResponse],
    tags=["API Keys"],
)
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[schemas.APIKeyResponse]:
    return crud.get_api_keys(db=db)


@app.post(
    "/api/v1/api-keys",
    response_model=schemas.APIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["API Keys"],
)
def create_api_key(
    payload: schemas.APIKeyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.APIKeyCreateResponse:
    db_key, raw_key = crud.create_api_key(db=db, name=payload.name)
    return schemas.APIKeyCreateResponse(
        id=db_key.id,
        name=db_key.name,
        is_active=db_key.is_active,
        raw_key=raw_key,
    )


@app.patch(
    "/api/v1/api-keys/{key_id}/toggle",
    response_model=schemas.APIKeyResponse,
    tags=["API Keys"],
)
def toggle_api_key(
    key_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.APIKeyResponse:
    key_obj = crud.toggle_api_key(db=db, key_id=key_id)
    if key_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key tidak ditemukan",
        )
    return key_obj


@app.delete(
    "/api/v1/api-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["API Keys"],
)
def delete_api_key(
    key_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> None:
    deleted = crud.delete_api_key(db=db, key_id=key_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key tidak ditemukan",
        )


# ---------------------------------------------------------------------------
# Health Check & Built Frontend SPA Serving (Production / Single-URL Mode)
# ---------------------------------------------------------------------------


@app.get("/api/v1/health", tags=["Health"])
def health_check() -> dict:
    return {"status": "ok", "service": "CUAN Web"}


_APK_CANDIDATES = [
    (
        "CUAN.apk",
        "cuan-android-latest",
        "https://github.com/tyasnur0204/Cuan/releases/latest/download/CUAN.apk",
        "https://github.com/tyasnur0204/Cuan/releases/latest",
    ),
    (
        "CUAN.apk",
        "cuan-android-latest",
        "https://github.com/tyasnur0204/Cuan/releases/download/cuan-android-latest/CUAN.apk",
        "https://github.com/tyasnur0204/Cuan/releases/tag/cuan-android-latest",
    ),
    (
        "FinMate.apk",
        "android-latest",
        "https://github.com/tyasnur0204/Cuan/releases/download/android-latest/FinMate.apk",
        "https://github.com/tyasnur0204/Cuan/releases/tag/android-latest",
    ),
]
_APK_RELEASE_CACHE: dict = {"ts": 0.0, "data": None}


def _get_ssl_context() -> ssl.SSLContext:
    env_ca = os.getenv("SSL_CERT_FILE")
    if env_ca and os.path.isfile(env_ca):
        return ssl.create_default_context(cafile=env_ca)

    default_ca = ssl.get_default_verify_paths().cafile
    if default_ca and os.path.isfile(default_ca):
        return ssl.create_default_context()

    for candidate in (
        r"C:\msys64\usr\ssl\certs\ca-bundle.crt",
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/pki/tls/certs/ca-bundle.crt",
        "/etc/ssl/cert.pem",
    ):
        if os.path.isfile(candidate):
            return ssl.create_default_context(cafile=candidate)

    return ssl.create_default_context()


def _probe_apk_asset(url: str, ssl_ctx: ssl.SSLContext) -> tuple[bool, Optional[int]]:
    # 1) Fast HEAD check
    try:
        req = urllib.request.Request(
            url,
            method="HEAD",
            headers={"User-Agent": "CUAN-Web-App/1.0"},
        )
        with urllib.request.urlopen(req, timeout=6, context=ssl_ctx) as resp:
            if 200 <= resp.status < 400:
                content_type = (resp.headers.get("Content-Type") or "").lower()
                content_len = resp.headers.get("Content-Length")
                size_bytes = int(content_len) if content_len and content_len.isdigit() else None
                if (
                    "android.package-archive" in content_type
                    or "octet-stream" in content_type
                    or "zip" in content_type
                ) and (size_bytes is None or size_bytes > 1024):
                    return True, size_bytes
    except Exception:
        pass

    # 2) Fallback 4-byte Range GET to bypass servers/SAS tokens that disallow HEAD
    try:
        req = urllib.request.Request(
            url,
            method="GET",
            headers={
                "User-Agent": "CUAN-Web-App/1.0",
                "Range": "bytes=0-3",
            },
        )
        with urllib.request.urlopen(req, timeout=8, context=ssl_ctx) as resp:
            if 200 <= resp.status < 400:
                magic = resp.read(4)
                if magic[:2] == b"PK":
                    size_bytes: Optional[int] = None
                    content_range = resp.headers.get("Content-Range") or ""
                    if "/" in content_range:
                        total_part = content_range.rsplit("/", 1)[-1].strip()
                        if total_part.isdigit():
                            size_bytes = int(total_part)
                    elif resp.status == 200:
                        content_len = resp.headers.get("Content-Length")
                        if content_len and content_len.isdigit():
                            size_bytes = int(content_len)
                    return True, size_bytes
    except Exception:
        pass

    return False, None


_VERSION_MANIFEST_URL = (
    "https://github.com/tyasnur0204/Cuan/releases/download/cuan-android-latest/cuan-version.json"
)


def _fetch_remote_release_manifest(ssl_ctx: ssl.SSLContext) -> Optional[dict]:
    try:
        req = urllib.request.Request(
            _VERSION_MANIFEST_URL,
            method="GET",
            headers={
                "User-Agent": "CUAN-Web-App/1.0",
                "Cache-Control": "no-cache",
            },
        )
        with urllib.request.urlopen(req, timeout=8, context=ssl_ctx) as resp:
            if 200 <= resp.status < 300:
                raw = resp.read(32768).decode("utf-8")
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and parsed.get("version"):
                    return parsed
    except Exception:
        pass
    return None


def _resolve_latest_apk_asset(force_refresh: bool = False) -> dict:
    now = time.monotonic()
    cached = _APK_RELEASE_CACHE.get("data")
    if cached is not None and not force_refresh:
        ttl = 60.0 if (cached.get("available") and cached.get("filename") == "CUAN.apk") else 15.0
        if (now - _APK_RELEASE_CACHE.get("ts", 0.0)) < ttl:
            return cached

    ssl_ctx = _get_ssl_context()
    resolved = {
        "available": False,
        "filename": "CUAN.apk",
        "size_bytes": None,
        "size_mb": None,
        "tag_name": "cuan-android-latest",
        "version": "1.0.0",
        "version_code": 1,
        "sha256": None,
        "built_at": None,
        "release_notes": [],
        "download_url": _APK_CANDIDATES[1][2],
        "release_page_url": _APK_CANDIDATES[1][3],
    }

    for filename, tag_name, url, page_url in _APK_CANDIDATES:
        ok, size_bytes = _probe_apk_asset(url, ssl_ctx)
        if ok:
            manifest = (
                _fetch_remote_release_manifest(ssl_ctx)
                if tag_name == "cuan-android-latest"
                else None
            )
            version_str = str((manifest or {}).get("version") or "1.0.0")
            try:
                version_code = int((manifest or {}).get("version_code") or 1)
            except (TypeError, ValueError):
                version_code = 1
            manifest_size = (manifest or {}).get("size_bytes")
            final_size = (
                int(manifest_size)
                if isinstance(manifest_size, (int, float)) and manifest_size > 1024
                else size_bytes
            )
            notes = (manifest or {}).get("release_notes")
            if not isinstance(notes, list):
                notes = []

            resolved = {
                "available": True,
                "filename": filename,
                "size_bytes": final_size,
                "size_mb": round(final_size / (1024 * 1024), 1) if final_size else None,
                "tag_name": tag_name,
                "version": version_str,
                "version_code": version_code,
                "sha256": (manifest or {}).get("sha256"),
                "built_at": (manifest or {}).get("built_at"),
                "release_notes": [str(n) for n in notes[:8]],
                "download_url": url,
                "release_page_url": page_url,
            }
            break

    _APK_RELEASE_CACHE["ts"] = now
    _APK_RELEASE_CACHE["data"] = resolved
    return resolved


@app.get("/api/v1/app/release", tags=["Mobile App"])
def get_mobile_app_release(refresh: bool = Query(default=False)) -> dict:
    info = _resolve_latest_apk_asset(force_refresh=refresh)
    return {
        "app_name": "CUAN",
        "tagline": "Catat Uang, Aset Naik",
        "available": info["available"],
        "filename": info["filename"],
        "version": info["version"],
        "latest_version": info["version"],
        "version_code": info["version_code"],
        "latest_version_code": info["version_code"],
        "sha256": info["sha256"],
        "built_at": info["built_at"],
        "release_notes": info["release_notes"],
        "size_bytes": info["size_bytes"],
        "size_mb": info["size_mb"],
        "tag_name": info["tag_name"],
        "download_url": "/api/v1/app/download",
        "proxy_download_url": "/api/v1/app/download?proxy=1",
        "direct_url": info["download_url"],
        "release_page_url": info["release_page_url"],
    }


@app.api_route("/api/v1/app/download", methods=["GET", "HEAD"], tags=["Mobile App"])
def download_mobile_app_apk(
    request: Request,
    proxy: bool = Query(default=False),
):
    info = _resolve_latest_apk_asset()
    target_url = info.get("download_url") or _APK_CANDIDATES[1][2]
    filename = info.get("filename") or "CUAN.apk"

    if not proxy:
        return RedirectResponse(
            url=target_url,
            status_code=status.HTTP_302_FOUND,
            headers={"Cache-Control": "no-store"},
        )

    ssl_ctx = _get_ssl_context()
    headers = {"User-Agent": "CUAN-Web-App/1.0"}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    method = "HEAD" if request.method == "HEAD" else "GET"
    req = urllib.request.Request(target_url, method=method, headers=headers)
    try:
        upstream = urllib.request.urlopen(req, timeout=20, context=ssl_ctx)
    except urllib.error.HTTPError as exc:
        raise HTTPException(
            status_code=exc.code if exc.code in (404, 416) else status.HTTP_502_BAD_GATEWAY,
            detail="File APK sedang tidak tersedia dari mirror.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gagal mengambil file APK dari mirror.",
        )

    resp_headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": "application/vnd.android.package-archive",
        "Cache-Control": "no-store",
    }
    for h_name in ("Content-Length", "Content-Range", "Accept-Ranges"):
        h_val = upstream.headers.get(h_name)
        if h_val:
            resp_headers[h_name] = h_val

    if method == "HEAD":
        upstream.close()
        return StreamingResponse(
            iter(()),
            status_code=upstream.status,
            headers=resp_headers,
            media_type="application/vnd.android.package-archive",
        )

    def _stream_chunks():
        try:
            while True:
                chunk = upstream.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            upstream.close()

    return StreamingResponse(
        _stream_chunks(),
        status_code=upstream.status,
        headers=resp_headers,
        media_type="application/vnd.android.package-archive",
    )


FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"

if FRONTEND_ASSETS_DIR.is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_ASSETS_DIR)),
        name="frontend-assets",
    )


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend_spa(full_path: str):
    if (
        full_path == "api"
        or full_path.startswith("api/")
        or full_path in {"docs", "redoc", "openapi.json"}
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found",
        )

    index_file = FRONTEND_DIST_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Frontend belum di-build. Jalankan npm run build atau gunakan dev server frontend.",
        )

    dist_root = FRONTEND_DIST_DIR.resolve()
    candidate = (dist_root / full_path).resolve()
    try:
        candidate.relative_to(dist_root)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found",
        )

    if full_path and candidate.is_file():
        return FileResponse(str(candidate))
    return FileResponse(str(index_file))
