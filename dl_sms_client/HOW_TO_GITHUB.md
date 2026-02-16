# 🛡️ GitHub Hosting: Secret Configuration

Your `sync.py` is now secured. To make it work, you MUST add your credentials to GitHub Secrets.

## 🔑 How to add Secrets:
1. Go to your private GitHub Repository.
2. Click **Settings** (top bar).
3. On the left sidebar, click **Secrets and variables** -> **Actions**.
4. Click **New repository secret** for EACH of the following keys:

| Secret Name | Value Example |
| :--- | :--- |
| `IVA_EMAIL` | your_iva_email@example.com |
| `IVA_PASS` | your_iva_password |
| `FB_PROJECT_ID` | demoxhexa |
| `FB_API_KEY` | AIzaSy... (Your Firebase API Key) |
| `SB_URL` | https://...supabase.co |
| `SB_KEY` | your_supabase_service_role_key |

## 🚀 Deployment
Once secrets are added:
1. Upload everything inside this `github` folder to your repo.
2. Go to the **Actions** tab.
3. Your sync will run automatically every 5 minutes.

---
*Stay Anonymous. Stay Secured.* 🦾
