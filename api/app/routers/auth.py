"""`/auth/*` (06 §C): sign up / in / out, me, and the landing page's demo logins."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.deps import AppSettings, Db, current_user
from app.errors import ApiError
from app.models import User
from app.schemas.models import DemoSignIn, Me, SignIn, SignUp
from app.services import auth

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_EMAILS = {
    "creator": "creator@demo.pagecraft.app",
    "collaborator": "collaborator@demo.pagecraft.app",
}


def me(user: User) -> Me:
    return Me.model_validate(user)


@router.post("/sign-up", response_model=Me, status_code=201)
async def sign_up(body: SignUp, response: Response, db: Db, settings: AppSettings) -> Me:
    email = auth.normalise_email(body.email)
    user = User(
        email=email,
        name=body.name.strip(),
        password_hash=auth.hash_password(body.password),
        avatar_colour=auth.avatar_colour(email),
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ApiError(
            "email_taken", "There is already an account with that email — sign in", status=409
        ) from exc
    session, token = await auth.open_session(db, user)
    auth.set_session_cookie(response, token, session.expires_at, settings)
    return me(user)


@router.post("/sign-in", response_model=Me)
async def sign_in(body: SignIn, response: Response, db: Db, settings: AppSettings) -> Me:
    result = await auth.login(db, body.email, body.password)
    if result is None:
        raise ApiError("unauthorized", "That email and password don't match")
    user, session, token = result
    auth.set_session_cookie(response, token, session.expires_at, settings)
    return me(user)


@router.post("/demo", response_model=Me)
async def demo(body: DemoSignIn, response: Response, db: Db, settings: AppSettings) -> Me:
    user = (
        await db.execute(select(User).where(User.email == DEMO_EMAILS[body.as_]))
    ).scalar_one_or_none()
    if user is None:
        raise ApiError("unavailable", "The demo accounts aren't set up yet")
    session, token = await auth.open_session(db, user)
    auth.set_session_cookie(response, token, session.expires_at, settings)
    return me(user)


@router.post("/sign-out", status_code=204)
async def sign_out(request: Request, db: Db, settings: AppSettings) -> Response:
    token = request.cookies.get(auth.COOKIE_NAME, "")
    if token:
        await auth.delete_session(db, token)
    response = Response(status_code=204)
    auth.clear_session_cookie(response, settings)
    return response


@router.get("/me", response_model=Me)
async def get_me(user: Annotated[User | None, Depends(current_user)]) -> Me:
    if user is None:
        raise ApiError("unauthorized", "Not signed in")
    return me(user)
