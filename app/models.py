import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AccountType(str, enum.Enum):
    CASH = "Cash"
    BANK = "Bank"
    INVESTMENT = "Investment"


class TransactionType(str, enum.Enum):
    INCOME = "Income"
    EXPENSE = "Expense"
    TRANSFER = "Transfer"


class AssetClass(str, enum.Enum):
    RDPU = "RDPU"
    SBN = "SBN"
    SAHAM = "Saham"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(100), unique=False, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False, server_default="")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    accounts = relationship(
        "Account", back_populates="user", cascade="all, delete-orphan"
    )
    budgets = relationship(
        "Budget", back_populates="user", cascade="all, delete-orphan"
    )
    investment_assets = relationship(
        "InvestmentAsset", back_populates="user", cascade="all, delete-orphan"
    )


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    type = Column(
        SQLEnum(
            AccountType,
            name="account_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    balance = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    is_business_account = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    user = relationship("User", back_populates="accounts")
    transactions = relationship(
        "Transaction", back_populates="account", cascade="all, delete-orphan"
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(
        SQLEnum(
            TransactionType,
            name="transaction_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    category = Column(String(100), nullable=False, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    transaction_date = Column(Date, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    is_business = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    account = relationship("Account", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category = Column(String(100), nullable=False)
    limit_amount = Column(Numeric(18, 2), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

    user = relationship("User", back_populates="budgets")


class InvestmentAsset(Base):
    __tablename__ = "investment_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_name = Column(String(150), nullable=False)
    asset_class = Column(
        SQLEnum(
            AssetClass,
            name="asset_class",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    annual_return_rate = Column(Numeric(10, 4), nullable=False)
    invested_amount = Column(
        Numeric(18, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )

    user = relationship("User", back_populates="investment_assets")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    key_string = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    is_active = Column(
        Boolean, nullable=False, default=True, server_default="true"
    )
