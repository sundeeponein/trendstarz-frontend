# Launch-Day Command Checklist

Date: 2026-05-22
Release branch: sandeep/fe-categories-changes-inf-brand
Release commit: a69a629
Release owner: ____________________

## 1) Release context lock
- [ ] `pwd`
- [ ] `git rev-parse --abbrev-ref HEAD`
- [ ] `git log -1 --oneline`
- [ ] `git status --short` (must be empty)

## 2) Final quality gate
- [ ] `npm ci`
- [ ] `npm run build`
- [ ] `npx playwright test --reporter=line --max-failures=1`

Pass criteria:
- Build succeeds
- E2E is green

## 3) Tag + push
- [ ] `git tag -a launch-2026-05-22 -m "Launch day stable e2e green"`
- [ ] `git show --no-patch launch-2026-05-22`
- [ ] `git push origin HEAD`
- [ ] `git push origin launch-2026-05-22`

## 4) Deploy frontend
Choose your path:
- Vercel CLI: [ ] `npx vercel --prod --yes`
- Git-integrated deploy: [ ] confirm latest commit deployed and status is Ready

## 5) Backend readiness
- [ ] Trigger backend production deploy using standard pipeline
- [ ] Verify health endpoint returns success
- [ ] Verify auth endpoints are reachable

## 6) Must-pass live smoke
- [ ] Influencer registration completes
- [ ] Brand registration completes
- [ ] Photographer registration completes
- [ ] Login works for all 3 roles
- [ ] Password reset works

## 7) Controlled marketing ramp
- [ ] Start at 10-20% traffic
- [ ] Cap budgets first 24h
- [ ] Review conversion metrics every 15-30 min for first 2-4h

Immediate pause rule:
- Pause campaigns if any critical signup/login/profile flow breaks.

## 8) Rollback playbook
- [ ] Identify last known good tag
- [ ] Redeploy previous stable frontend
- [ ] Redeploy previous stable backend (if needed)
- [ ] Pause paid traffic
- [ ] Re-run smoke checks

## 9) End-of-day close
- [ ] Capture metrics snapshot (start/completion by role, login success, reset success)
- [ ] Log incidents and fixes
- [ ] Decide next-day ramp (20% -> 50%+)
- [ ] Post launch summary to team
