# Deploy Options Buddy - 100% Free, 10 Minutes

You and your dad will have this working in **10 minutes**. Zero monthly cost.

---

## Step 1: Get Resend API Key (2 minutes)

1. Go to [resend.com/signup](https://resend.com/signup)
2. Sign up with your email (free, no credit card)
3. Click **API Keys** → **Create API Key**
4. Copy the key (looks like `re_xxxxxxxxxxxx`)
5. Keep it handy for Step 2

---

## Step 2: Deploy Backend to Render (4 minutes)

1. Go to [render.com](https://render.com) and sign up (free, no credit card needed)
2. Click **New** → **Blueprint**
3. Connect your GitHub account
4. Select repository: `komalamee/options-buddy-react`
5. Render will detect `render.yaml` automatically
6. Click **Apply**
7. It will ask for `RESEND_API_KEY`:
   - Paste your key from Step 1
8. Click **Create Services**
9. Wait 3-4 minutes while it deploys
10. When done, copy the backend URL (looks like `https://options-buddy-backend-xxxx.onrender.com`)

**Important**: Render auto-creates the database tables on first startup. No manual setup needed!

---

## Step 3: Add Yourself and Your Dad to Whitelist (2 minutes)

Go to your Supabase dashboard:
1. Open [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Paste this and click **Run**:

```sql
INSERT INTO email_whitelist (email, added_at)
VALUES
  ('komalamee@gmail.com', NOW()),
  ('hjjamin@gmail.com', NOW())
ON CONFLICT (email) DO NOTHING;
```

Done! Now only you two can log in.

---

## Step 4: Deploy Frontend to Vercel (2 minutes)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Find your `options-buddy-react` project
3. Click **Settings** → **Environment Variables**
4. Find `NEXT_PUBLIC_API_URL` and click **Edit**
5. Change it to your Render backend URL from Step 2:
   ```
   https://options-buddy-backend-xxxx.onrender.com
   ```
6. Click **Save**
7. Go to **Deployments** tab
8. Click the **...** menu on latest deployment
9. Click **Redeploy** → **Redeploy**

Wait 1-2 minutes.

---

## Step 5: Login! (1 minute)

1. Go to `https://options-buddy-react.vercel.app`
2. Enter your email: `komalamee@gmail.com`
3. Click **Send Magic Link**
4. Check your email
5. Click the link
6. **You're in!**

Do the same for your dad with his email `hjjamin@gmail.com`.

---

## For Your Dad - IBKR Connection (Coming Soon)

Right now, without IBKR connected, you can:
- ✅ Manually add positions
- ✅ Track performance
- ✅ Import IBKR CSV files
- ✅ Use the AI advisor

To connect live IBKR data, each person needs to run a tiny relay program. I'll make this dead simple in the next update.

---

## What Just Happened

You now have a **private, secure, multi-user options tracking app** running on the internet:

- **Render** hosts your backend API (free tier, goes to sleep after 15min, wakes in 30 sec)
- **Vercel** hosts your frontend (free forever, always fast)
- **Supabase** stores the data (free tier, 500MB database)
- **Resend** sends magic link emails (free, 100 emails/day)

**Total cost: $0/month**

---

## Troubleshooting

### "Email not whitelisted"
Re-run the SQL in Step 3 in Supabase dashboard.

### Backend not working
1. Go to Render dashboard
2. Click your service
3. Check the **Logs** tab
4. Look for errors

### Frontend shows error
1. Make sure `NEXT_PUBLIC_API_URL` in Vercel points to your Render URL
2. Redeploy the frontend

### Magic link not arriving
1. Check spam folder
2. Make sure you entered the correct email
3. Check Resend dashboard for delivery status

---

## Next Steps

Once you verify login works:
1. Import your IBKR trade history (CSV upload)
2. Manually add current positions
3. Set up AI provider (Settings page)
4. Optional: Set up IBKR relay for live data

---

## Get Railway Refund

1. Email Railway support: team@railway.app
2. Subject: "Request refund - deployed elsewhere"
3. Body: "Hi, I set up an account but deployed my app to Render instead. Can I please get a refund? Thanks!"

They're usually good about this if you ask within a few days.
