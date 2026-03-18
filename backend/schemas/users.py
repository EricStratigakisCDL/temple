from pydantic import BaseModel


class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "reviewer"


class UpdateUserRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    name: str | None = None
    role: str | None = None
    status: str | None = None
