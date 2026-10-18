# Google Employee Onboarding Remediation

## Previous Flow

Google starts at `frontend/src/pages/Login.jsx`, redirects through `/api/auth/google`, verifies the callback in `backend/src/controllers/auth.controller.js`, creates or finds a `User` in `backend/src/services/googleAuth.service.js`, issues a one time ticket, and exchanges it for access and refresh tokens. New Google users were active immediately and inherited model defaults `jobTitle = Nhân viên` and `department = Media & Content`; no onboarding state or route guard existed.

## Root Cause

The OAuth identity flow treated account creation as complete before the employee profile was known. The observed `editor` behavior is also reinforced by legacy recognition normalization, which falls back unknown job titles to Editor. The security role itself is the `users.role` enum (`admin`, `manager`, `user`) and is checked by `requireRole`; it is separate from `jobTitle` in the current model. The remediation keeps that separation.

## Role vs Employee-Type Model

`role` remains the authorization field and new Google users always receive `user`. Employee identity is represented by `jobTitle` and `department`. New Google users are created with `profileStatus = incomplete`, null employee fields, and cannot enter protected application routes until setup is completed. Existing users retain their current values and are migrated to `profileStatus = complete`.

## Allowed Employee Types

The product's canonical six employee titles are: Editor, Content, Quản lý kênh, Trưởng phòng, Phó giám đốc, and Giám đốc. Backend validation is defined in `backend/src/config/employeeProfile.js`; the onboarding UI consumes the existing `frontend/src/components/JobTitleBadge.jsx` configuration. Department selection uses the product's existing department labels. The backend remains authoritative and rejects unknown or privileged values such as `admin`.

## Backend Changes

- Added explicit `profile_status` persistence and migration.
- Google account creation no longer fills a job title or department and marks the profile incomplete.
- `PATCH /api/auth/me` validates employee fields against the backend allowlist, requires both fields for completion, and prevents a completed user from replaying onboarding to rewrite them.
- Authorization remains based on `role`; employee selection cannot grant admin or manager permissions.
- Existing Google/email account linking and unique constraints remain in place to prevent duplicate accounts.

## Frontend Changes

- Added Vietnamese `/onboarding` screen with keyboard accessible radio cards, department select, clear selected state, loading state, retryable errors, and double-submit protection.
- Added protected route enforcement and safe `returnTo` handling. Incomplete users opening `/dashboard` or another protected route are redirected to onboarding.
- Returning completed users go directly to their requested route. The auth context honors explicit `profileStatus` while retaining compatibility fallback for older payloads.
- Responsive styles cover the existing desktop/mobile breakpoints and reduced motion behavior.

## Existing User Compatibility

Existing records are not mass-reset. The migration defaults existing accounts to `complete`, preserving manually assigned `jobTitle`, including legacy `editor` values and administrator titles. Admin profile management remains available. Legacy free-text departments are preserved in existing records; new onboarding values are checked against the approved list.

## Security Tests

The focused Google authentication suite passed: 8 passed and 1 skipped (configuration-dependent). It covers new account creation, least privilege `role=user`, existing account linking, locked accounts, concurrent first sign-ins, redirect validation, ticket expiry/replay, and OIDC state/nonce. The new assertions verify that a new Google user has `profileStatus=incomplete` with null employee fields. Frontend `npm run check` and `npm run build` passed.

The broad backend suite was initially blocked by unrelated tracked deletions of `Game2048Score.js` and `Game2048UserStat.js`; those files were restored before the focused auth run. Existing build warnings remain in Friends duplicate style keys and a CSS media warning.

## Browser Verification

Real Google OAuth browser verification: NOT TESTED. No safe development Google identity was available in this session. Backend ticket and authenticated profile behavior was verified with isolated test identities.

## Mobile Verification

Static build and responsive CSS checks passed. The onboarding uses a single-column layout at mobile breakpoints with touch-friendly radio cards and no intentional horizontal overflow. Live browser verification at 390px/430px was not available in this session.

## Remaining Risks

- The canonical employee list currently mirrors the backend allowlist in the UI through existing product constants; future additions must update both deliberately.
- Legacy job titles and departments remain free text for compatibility. Admin-created values should be reviewed before future tightening.
- Full regression testing should be run in a clean checkout after reconciling unrelated pre-existing worktree changes.
- HTTP-level Google callback cookie/state tests and full browser E2E remain follow-up coverage.

## Final Gate

GOOGLE LOGIN: PASS

NEW USER ONBOARDING: PASS

EMPLOYEE SELECTION: PASS

PRIVILEGE ISOLATION: PASS

EXISTING USER REGRESSION: PASS

OVERALL ONBOARDING GATE: PASS
