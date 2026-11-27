"""`/auth/*` (06 §C): sign up / in / out, me, and the landing page's demo logins."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from sqlalchemy.exc import IntegrityError

from app.deps import AppSettings, CurrentUser, Db, current_user
from app.errors import ApiError
from app.models import User
from app.schemas.models import (
    DemoSignIn,
    ForgotIn,
    ForgotOut,
    Me,
    ResetIn,
    SignIn,
    SignUp,
    TeammateOut,
)
from app.services import auth, email, invites, limits, sites

router = APIRouter(prefix="/auth", tags=["auth"])


def me(user: User) -> Me:
    return Me.model_validate(user)


@router.post("/sign-up", response_model=Me, status_code=201)
async def sign_up(
    body: SignUp, request: Request, response: Response, db: Db, settings: AppSettings
) -> Me:
    await limits.hit(db, f"sign-up:{limits.client_ip(request)}", 10, limits.HOUR)
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
async def sign_in(
    body: SignIn, request: Request, response: Response, db: Db, settings: AppSettings
) -> Me:
    await limits.hit(db, f"sign-in:{limits.client_ip(request)}", 30, limits.QUARTER)
    await limits.hit(db, f"sign-in:{auth.normalise_email(body.email)}", 10, limits.QUARTER)
    result = await auth.login(db, body.email, body.password)
    if result is None:
        raise ApiError("unauthorized", "That email and password don't match")
    user, session, token = result
    auth.set_session_cookie(response, token, session.expires_at, settings)
    return me(user)


@router.post("/demo", response_model=Me)
async def demo(
    body: DemoSignIn, request: Request, response: Response, db: Db, settings: AppSettings
) -> Me:
    await limits.hit(db, f"demo:{limits.client_ip(request)}", 20, limits.HOUR)
    user = await sites.open_demo(db, body.as_, settings)
    session, token = await auth.open_session(db, user)
    auth.set_session_cookie(response, token, session.expires_at, settings)
    return me(user)


@router.post("/demo/teammate", response_model=TeammateOut)
async def demo_teammate(
    request: Request, response: Response, db: Db, user: CurrentUser
) -> TeammateOut:
    """L3 "Open as your teammate": a session for the other demo user of this sandbox, returned
    in the body (not as a cookie) so this tab stays signed in as itself."""
    await limits.hit(db, f"demo-teammate:{limits.client_ip(request)}", 30, limits.HOUR)
    partner = await sites.demo_teammate(db, user)
    _, token = await auth.open_session(db, partner)
    response.headers["Cache-Control"] = "no-store"
    return TeammateOut(token=token, me=me(partner))


@router.post("/forgot", response_model=ForgotOut)
async def forgot(
    body: ForgotIn, request: Request, db: Db, settings: AppSettings, later: BackgroundTasks
) -> ForgotOut:
    """L4. Emails a one-hour reset link if a real account has this address. The answer and its
    timing are the same either way (the email goes after the response), and the link is never
    in a response."""
    await limits.hit(db, f"forgot:{limits.client_ip(request)}", 10, limits.HOUR)
    try:
        await limits.hit(db, f"forgot:{auth.normalise_email(body.email)}", 3, limits.HOUR)
    except ApiError:
        # Silent: neither an oracle nor a way to make the owner's own request fail.
        return ForgotOut(email_on=email.enabled(settings))
    found = await invites.start_reset(db, body.email, settings)
    if found:
        later.add_task(invites.send_reset, settings, *found)
    return ForgotOut(email_on=email.enabled(settings))


@router.post("/reset", response_model=Me)
async def reset(
    body: ResetIn, request: Request, response: Response, db: Db, settings: AppSettings
) -> Me:
    """L4. Sets the new password, ends every other session, and signs this browser in."""
    await limits.hit(db, f"reset:{limits.client_ip(request)}", 20, limits.HOUR)
    user = await invites.finish_reset(db, body.token, body.password)
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
