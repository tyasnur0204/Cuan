from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
    limit: int = Query(default=100, ge=1, le=500),
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
) -> schemas.AccountResponse:
    if account.user_id is None or crud.get_user(db=db, user_id=account.user_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {account.user_id} not found",
        )
    return crud.create_account(db=db, account=account)


@app.get(
    "/api/v1/accounts",
    response_model=list[schemas.AccountResponse],
    tags=["Accounts"],
)
def list_accounts(
    user_id: Optional[UUID] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[schemas.AccountResponse]:
    return crud.get_accounts(db=db, user_id=user_id, skip=skip, limit=limit)


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
        return crud.create_transaction(db=db, transaction=transaction)
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
    limit: int = Query(default=100, ge=1, le=500),
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
    if budget.user_id is None:
        budget = budget.model_copy(update={"user_id": current_user.id})
    return crud.create_budget(db=db, budget=budget)


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
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[schemas.BudgetResponse]:
    effective_user_id = user_id or current_user.id
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
    effective_user_id = user_id or current_user.id

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
    if asset.user_id is None:
        asset = asset.model_copy(update={"user_id": current_user.id})
    return crud.create_investment_asset(db=db, asset=asset)


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
) -> dict:
    assets = crud.get_investment_assets(db=db, user_id=user_id, limit=1000)
    accounts = crud.get_accounts(db=db, user_id=user_id, limit=1000)
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
