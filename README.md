# Port Automation

Phone number ordering app via NumberPilot. Built on Vercel + Supabase.

## Setup (one time, takes ~15 minutes)

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account + new project.
2. Go to **SQL Editor** and paste the contents of `supabase_setup.sql`, then click Run.
3. Go to **Settings > API** and copy:
   - **Project URL** (e.g. `https://xyz.supabase.co`)
   - **service_role** secret key (under "Project API keys")

### 2. GitHub

1. Create a new **private** repo on GitHub.
2. Push all these files to it:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourname/port-automation.git
   git push -u origin main
   ```

### 3. Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2. Click **Add New Project**, import your GitHub repo.
3. Before deploying, go to **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |
   | `JWT_SECRET` | Any long random string (generate at [randomkeygen.com](https://randomkeygen.com)) |
   | `NP_USERNAME` | Berniewilcox23 |
   | `NP_PASSWORD` | Ports3220! |
   | `APP_ENV` | production |

4. Click **Deploy**. Done. You get a live URL immediately.

### 4. Create your first admin user

In Supabase > SQL Editor, run:

```sql
insert into users (user_id, username, pin_hash, display_name, store_name, is_admin, is_active)
values (
  'admin001',
  'admin',
  encode(sha256('YOUR_PIN_HERE'::bytea), 'hex'),
  'Admin User',
  'HQ',
  true,
  true
);
```

Replace `YOUR_PIN_HERE` with whatever PIN you want.

## Deployment going forward

Just push to GitHub:

```bash
git add .
git commit -m "Your change description"
git push
```

Vercel auto-deploys in about 30 seconds. No clicking, no redeploy buttons.

## File Structure

```
port-automation/
  api/
    login.js        Login + logout
    dashboard.js    Dashboard data (orders, config)
    order.js        Place orders via NumberPilot
    admin.js        Admin CRUD (users, config, system)
  lib/
    db.js           Supabase client
    auth.js         JWT session helpers
    numberpilot.js  All NumberPilot API calls
    utils.js        Shared helpers (hash, dates, etc)
  public/
    login.html      Login page
    dashboard.html  Employee order page
    admin.html      Admin panel (4 tabs)
  vercel.json       Routing config
  package.json      Dependencies
  supabase_setup.sql  Run once in Supabase SQL editor
```

## Product Pricing

| Product | Cost |
|---------|------|
| METRO_CUSTOM_NUMBER | $12 |
| BOOST_CUSTOM_NUMBER | $12 |
| TM_CUSTOM_NUMBER | $12 |
| VZ_CUSTOM_NUMBER | $15 |
| ATT_CUSTOM_NUMBER | $14 |
