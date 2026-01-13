# CashBus - Deployment Checklist

## 🎯 Pre-Deployment Steps

### 1. Database Setup ✓
- [x] Supabase project created
- [ ] **CRITICAL**: Run [supabase/schema.sql](supabase/schema.sql) in SQL Editor
- [ ] Verify all 5 tables created
- [ ] Verify RLS policies active
- [ ] Verify triggers working

### 2. Environment Variables ✓
- [x] `.env.local` created
- [x] Supabase URL configured
- [x] Anon key configured
- [ ] Test environment loads without errors

### 3. Authentication Setup
- [ ] Enable Email provider in Supabase
- [ ] Set Site URL in Supabase Auth settings
- [ ] Add redirect URLs
- [ ] Test user registration
- [ ] Test user login
- [ ] Verify profile auto-created

### 4. Testing
- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Test `/auth` page loads
- [ ] Register new test user
- [ ] Login with test user
- [ ] Press panic button
- [ ] Verify incident created in Supabase
- [ ] Check stats update correctly
- [ ] Test sign out
- [ ] Mobile responsive check

---

## 🚀 Deployment Options

### Option A: Vercel (Recommended)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Add environment variables in Vercel dashboard
# Settings → Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://ltlfifqtprtkwprwwpxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

### Option B: Netlify
```bash
# 1. Install Netlify CLI
npm i -g netlify-cli

# 2. Build
npm run build

# 3. Deploy
netlify deploy --prod

# 4. Set environment variables in Netlify dashboard
```

---

## ⚙️ Post-Deployment

### 1. Update Supabase Auth Settings
- Site URL: `https://your-domain.vercel.app`
- Redirect URLs: `https://your-domain.vercel.app/auth`

### 2. Test Production
- [ ] Visit production URL
- [ ] Register new user
- [ ] Test panic button
- [ ] Verify GPS permissions work
- [ ] Check Supabase data created

### 3. Monitor
- [ ] Check Vercel/Netlify logs
- [ ] Check Supabase logs
- [ ] Monitor error rates
- [ ] Check performance metrics

---

## 🔐 Security Checklist

- [x] `.env.local` in `.gitignore`
- [x] RLS enabled on all tables
- [x] Anon key used (not service role key)
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] Rate limiting considered

---

## 📊 Success Metrics

After deployment, monitor:
- User registrations
- Incident reports created
- GPS capture success rate
- Authentication success rate
- Page load times
- Error rates

---

**Ready to deploy!** ✅
