from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import auth, crud, models, schemas
from app.database import engine, get_db

# ---------------------------------------------------------------------------
# Auto-create tables on startup
# ---------------------------------------------------------------------------
models.Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Cuan – Aplikasi Manajemen Keuangan Mahasiswa",
    description="Backend API untuk pencatatan transaksi, budgeting, dan pelacakan investasi.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth (Register & Login)
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
            detail="Username atau email sudah digunakan",
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
    if crud.get_user(db=db, user_id=account.user_id) is None:
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

# ---------------------------------------------------------------------------
# Transactions
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
        skip=skip,
        limit=limit,
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
                name="Kas Usaha PhoBo",
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
            category="Usaha PhoBo",
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
    return crud.get_budgets(
        db=db, user_id=user_id, month=month, year=year, skip=skip, limit=limit
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year

    # 1. Total aset & saldo kas (non-investasi)
    accounts = crud.get_accounts(db=db, user_id=user_id, limit=1000)
    total_assets = sum(Decimal(str(acc.balance)) for acc in accounts)
    cash_balance = sum(
        Decimal(str(acc.balance))
        for acc in accounts
        if acc.type != models.AccountType.INVESTMENT
    )

    # 2. Total pemasukan & pengeluaran bulan berjalan
    transactions = crud.get_transactions(
        db=db,
        month=current_month,
        year=current_year,
        account_id=None,
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

    # 3. Total budget bulan berjalan
    budgets = crud.get_budgets(
        db=db,
        user_id=user_id,
        month=current_month,
        year=current_year,
        limit=1000,
    )
    total_budget_limit = sum(Decimal(str(b.limit_amount)) for b in budgets)
    remaining_budget = total_budget_limit - total_expenses_this_month

    return {
        "period": {
            "month": current_month,
            "year": current_year,
        },
        "total_assets": float(total_assets),
        "cash_balance": float(cash_balance),
        "current_month_income": float(total_income_this_month),
        "current_month_expenses": float(total_expenses_this_month),
        "total_budget_limit": float(total_budget_limit),
        "remaining_budget": float(remaining_budget),
    }


# ---------------------------------------------------------------------------
# Investments – Inflation Check
# ---------------------------------------------------------------------------

INFLATION_RATE: Decimal = Decimal("3.2")  # persen per tahun


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

    result = []
    for asset in assets:
        annual_return = Decimal(str(asset.annual_return_rate))
        net_real_return = annual_return - inflation_rate

        result.append(
            {
                "asset_id": str(asset.id),
                "asset_name": asset.asset_name,
                "asset_class": asset.asset_class,
                "annual_return_rate_pct": float(annual_return),
                "inflation_rate_pct": float(inflation_rate),
                "net_real_return_pct": float(net_real_return),
                "beats_inflation": net_real_return > Decimal("0"),
            }
        )

    return {
        "inflation_rate_pct": float(inflation_rate),
        "total_assets_checked": len(result),
        "assets": result,
    }
