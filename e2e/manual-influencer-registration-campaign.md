# Manual Test: Influencer Registration and Campaign Discovery

## 1. Influencer Registration
1. Go to the frontend app and click "Register as Influencer" (route: `/register-influencer`).
2. Fill in all required fields:
   - Full Name
   - Username (unique)
   - Phone Number (unique)
   - Email (unique)
   - Password & Confirm Password
   - State
   - Languages
   - Categories
   - Social Media (at least one)
   - Profile Image (upload required)
   - At least one contact method (WhatsApp, Email, or Call)
3. Submit the form.
4. Check for success modal and email verification prompt.
5. Verify email by clicking the link sent to the provided email address.
6. Wait for admin approval (if required).

## 2. Login and Account Activation
1. Log in with the registered influencer credentials.
2. If account is pending, verify the message: "Admin needs to verify your ID. Your account is in pending/verification status."
3. Once approved, log in successfully and access the dashboard.

## 3. Campaign Discovery
1. Navigate to the "Campaign Management" or "Open Campaigns" page (route: `/campaigns`).
2. Browse the list of active campaigns.
3. View campaign details.
4. Apply or respond to campaign invites if available.

---

**Expected Results:**
- Registration should succeed with valid, unique data.
- Email verification and admin approval (if required) should be enforced.
- Influencer should be able to log in and see available campaigns.
- Campaigns should be listed and viewable.
