# 🎯 JobFit Analyser

An AI-powered job fit analyser that gives you an honest assessment of any job, plus a tailored CV, cover letter, and LinkedIn outreach message - ALL based on your personal profile, interests, and career goals.

Built by [Olivia Y. Liu](https://www.linkedin.com/in/oliviayliu/) · Powered by Claude

---

## What it does

Paste any job description and get:

- **Fit score (0–100)** — honest assessment of how well the role matches your profile
- **Red flag alerts** — flags citizenship issues, dealbreakers, or role mismatches before you waste time
- **3-year market outlook** — whether demand for this role is growing or shrinking
- **Tailored CV** — rewrites your CV to highlight what's most relevant for that specific role
- **Cover letter** — role-specific, no clichés
- **LinkedIn outreach message** — 2-3 sentence message to send to someone at the company
- **Application tracker** — tracks every role you've assessed with interview status

---

## Two versions

| File | Best for |
|------|----------|
| `job_fit_local.html` | **Easiest** — download and open in any browser, no setup |
| `job_fit_analyzer_public.jsx` | Developers who want to customise or deploy it |

---

## Option 1 — Use the HTML file (no setup needed)

1. Download `job_fit_local.html`
2. Double-click to open in Chrome or Safari
3. On first open, enter your Anthropic API key
4. Complete the 6-step profile setup
5. Start analysing jobs

**Get a free API key:** Go to [console.anthropic.com](https://console.anthropic.com) → sign up → API Keys → Create key. New accounts get free credits. Each job analysis costs roughly $0.003.

---

## Option 2 — Run the React app locally (for developers)

### Requirements
- Node.js 18+
- An Anthropic API key

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/jobfit-analyser.git
cd jobfit-analyser

# 2. Install dependencies
npm install

# 3. Create a .env file with your API key
echo "VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# 4. Start the app
npm run dev
```

Then open `http://localhost:5173` in your browser.

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add `VITE_ANTHROPIC_API_KEY` as an environment variable in your Vercel project settings.

---

## Customising your profile

When you first open the app, you'll be guided through a setup:

- **Your CV / work history** — paste your experience
- **What energises you** — types of work you enjoy
- **What drains you** — work that doesn't suit you
- **Long-term goals** — where you want to be in 3–5 years
- **Constraints** — visa requirements, sectors to avoid, dealbreakers

You can edit this anytime in the **My Profile** tab.

---

## Privacy

- Your API key is stored only in your browser's local storage
- Your profile and history are stored only on your device
- Nothing is sent to any server except the Anthropic API (to generate responses)

---

## Tech stack

- React 18
- Anthropic Claude API
- No backend required
- localStorage for persistence

---

## Contributing

Pull requests welcome. Ideas for improvement:

- [ ] PDF export for CV
- [ ] Email export for cover letter
- [ ] Multiple profile support
- [ ] Job board integrations

---

## Licence

MIT — use it, adapt it, build on it.

---

*Made in Oslo 🇳🇴*
