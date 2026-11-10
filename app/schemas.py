from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.models import AccountType, AssetClass, TransactionType


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., max_length=255)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=72)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)


class PasswordUpdate(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=72)
    new_password: str = Field(..., min_length=6, max_length=72)


class UserLogin(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=72)


class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: AccountType
    balance: Decimal = Field(default=Decimal("0.00"))
    is_business_account: bool = Field(default=False)


class AccountCreate(AccountBase):
    user_id: Optional[UUID] = None


class AccountResponse(AccountBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


class TransactionBase(BaseModel):
    type: TransactionType
    category: str = Field(..., min_length=1, max_length=100)
    amount: Decimal = Field(..., gt=Decimal("0"))
    transaction_date: date
    notes: Optional[str] = None
    is_business: bool = Field(default=False)


class TransactionCreate(TransactionBase):
    account_id: UUID
    destination_account_id: Optional[UUID] = None


class TransactionResponse(TransactionBase):
    id: UUID
    account_id: UUID

    model_config = ConfigDict(from_attributes=True)


class TransactionAutoLogCreate(BaseModel):
    nominal: Decimal = Field(
        ...,
        gt=Decimal("0"),
        validation_alias=AliasChoices("nominal", "amount"),
    )
    tanggal: date = Field(
        ...,
        validation_alias=AliasChoices("tanggal", "transaction_date"),
    )


class TransactionAutoLogResponse(TransactionResponse):
    is_business_account: bool = True


class BudgetBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    limit_amount: Decimal = Field(..., ge=Decimal("0"))
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)


class BudgetCreate(BudgetBase):
    user_id: Optional[UUID] = None


class BudgetResponse(BudgetBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


class InvestmentAssetBase(BaseModel):
    asset_name: str = Field(..., min_length=1, max_length=150)
    asset_class: AssetClass
    annual_return_rate: Decimal
    invested_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"))


class InvestmentAssetCreate(InvestmentAssetBase):
    user_id: Optional[UUID] = None


class InvestmentAssetResponse(InvestmentAssetBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class APIKeyResponse(BaseModel):
    id: UUID
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class APIKeyCreateResponse(APIKeyResponse):
    raw_key: str
