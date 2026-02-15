# 🔐 4 Team Admin Accounts & Join Links

## ✅ Successfully Deployed
**Live URL:** https://workflow-manager-hazel.vercel.app

---

## 👑 Admin Login Credentials

### 1) Aakash Pandya
- **Email:** akash.pandya@petpooja.com
- **Password:** Ak@2026#AP
- **Team:** Aakash Pandya Team

### 2) Ashish Upadhyay
- **Email:** ashish.upadhyay@petpooja.com
- **Password:** As@2026#AU
- **Team:** Ashish Upadhyay Team

### 3) Farrin Ansari
- **Email:** farrin.ansari@petpooja.com
- **Password:** Fa@2026#FA
- **Team:** Farrin Ansari Team

### 4) Arjun Gohil
- **Email:** arjun.gohil@petpooja.com
- **Password:** Ar@2026#AG
- **Team:** Arjun Gohil Team

---

## 📋 Admin Join Links (Permanent & Reusable)

### 👑 Team 1: Aakash Pandya Team
**Join Link:** https://workflow-manager-hazel.vercel.app/invite?token=ADM-AAK-0C3DA7EB

### 👑 Team 2: Arjun Gohil Team
**Join Link:** https://workflow-manager-hazel.vercel.app/invite?token=ADM-ARJ-A13B2366

### 👑 Team 3: Ashish Upadhyay Team
**Join Link:** https://workflow-manager-hazel.vercel.app/invite?token=ADM-ASH-80BEC2DF

### 👑 Team 4: Farrin Ansari Team
**Join Link:** https://workflow-manager-hazel.vercel.app/invite?token=ADM-FAR-4218C5AE

**✅ These links never expire and can be reused by multiple users**  
**✅ Each link automatically assigns users to the corresponding team**

---

## 🎯 How It Works

### Admin Login:
- Admins login using **email + password**
- Each admin can only see their own team's data
- Each admin can create up to **35 users** in their team

### User Registration:
- Users join a team using the **permanent join link** from their admin
- Users login using **Employee ID + password**
- Users can only see their own data within their team

### Data Isolation:
- ✅ All 4 teams are **completely isolated**
- ✅ Data will **NOT merge** between teams
- ✅ Each team has its own users, entries, and migrations
- ✅ Admins cannot see other teams' data

---

## 🚀 Next Steps

1. Login as one of the 4 admins above
2. Fetch your team's permanent join link via the API
3. Share that join link with your team members
4. Team members use the link to create accounts under your team
5. All data remains isolated within your team

---

## 📝 Technical Details

- **Schema:** Multi-tenant with team_id on all tables
- **Authentication:** Session-based with HTTP-only cookies
- **Password Security:** Scrypt hashing with random salts
- **Team Limit:** 35 users per team
- **Join Tokens:** Permanent (no expiration), reusable
- **Deployment:** Vercel serverless + Turso database

---

## ⚠️ Important Notes

- ❌ Admin registration is **disabled** - only the 4 pre-created admins exist
- ✅ Users can only join via **invite/join links** from their team admin
- ✅ Each admin manages their own team independently
- ✅ No data cross-contamination between teams
