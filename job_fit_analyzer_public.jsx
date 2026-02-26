import { useState, useEffect } from "react";

const EMPTY_PROFILE = { name: "", cv: "", interests: "", dislikes: "", goals: "", constraints: "" };

const ONBOARDING_STEPS = [
  { key: "name", label: "What's your name?", hint: "Just your first name is fine", placeholder: "e.g. Sarah", type: "input", required: true },
  { key: "cv", label: "Paste your CV or work history", hint: "Include job titles, companies, dates, and key achievements. The more detail, the better the analysis.", placeholder: "e.g.\nSenior Product Manager | Spotify | 2022–present\n- Led growth of premium subscription...\n\nMBA | INSEAD | 2020", type: "textarea", required: true },
  { key: "interests", label: "What kind of work energises you?", hint: "Be honest — this shapes every assessment", placeholder: "e.g.\n- Working directly with customers\n- Solving ambiguous strategic problems\n- Building and leading teams\n- Data-driven decision making", type: "textarea", required: true },
  { key: "dislikes", label: "What kind of work drains you?", hint: "This helps filter out roles that look good on paper but would make you miserable", placeholder: "e.g.\n- Purely administrative or process-heavy work\n- Highly technical coding roles\n- Extreme high-pressure sales environments", type: "textarea", required: false },
  { key: "goals", label: "What are your long-term career goals?", hint: "Where do you want to be in 3–5 years? What kind of work would feel meaningful?", placeholder: "e.g.\n- Move into a leadership role at a mission-driven company\n- Build expertise at the intersection of tech and policy\n- Work internationally, ideally in Asia or Europe", type: "textarea", required: true },
  { key: "constraints", label: "Any constraints or red flags to watch for?", hint: "e.g. visa/work permit limitations, sectors you can't work in, things that would be dealbreakers", placeholder: "e.g.\n- Need visa sponsorship for UK roles\n- Cannot work in defence or weapons industries\n- Need remote-friendly or hybrid role", type: "textarea", required: false },
];

const INTERVIEW_STATUSES = ["Applied","Screening","Interview","Final Round","Offer","Rejected","Withdrawn"];
const STATUS_COLORS = { "Applied":"#6366f1","Screening":"#8b5cf6","Interview":"#f59e0b","Final Round":"#3b82f6","Offer":"#10b981","Rejected":"#ef4444","Withdrawn":"#666" };

function buildSystemPrompt(profile) {
  return `You are a highly experienced career advisor and CV writer helping ${profile.name || "a job seeker"}.

THEIR CV / EXPERIENCE:
${profile.cv}

WHAT THEY ENJOY AND THRIVE IN:
${profile.interests}

WHAT THEY DISLIKE OR STRUGGLE WITH:
${profile.dislikes || "Not specified"}

LONG-TERM GOALS:
${profile.goals}

CONSTRAINTS AND RED FLAGS:
${profile.constraints || "None specified"}

Be honest, direct, and specific. Never invent experience they don't have. Tailor everything to this specific person.`;
}

async function callClaude(prompt, profile) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: buildSystemPrompt(profile),
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || data.content?.[0]?.text || "";
}

function exportToWord(cv, title, name) {
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'><head><meta charset='utf-8'><style>body{font-family:Arial,sans-serif;font-size:11pt;margin:2cm;color:#1a1a1a}pre{font-family:Arial,sans-serif;white-space:pre-wrap;font-size:10.5pt;line-height:1.6}</style></head><body><pre>${cv}</pre></body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(name||"CV").replace(/\s+/g,"_")}_${title.replace(/\s+/g,"_")}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

const parseField = (text, field) => text?.match(new RegExp(`${field}:\\s*([^\\n]+)`))?.[1]?.trim() || null;
const parseScore = (text) => { const m = text?.match(/SCORE:\s*(\d+)/); return m ? parseInt(m[1]) : null; };
const scoreColor = (s) => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
const scoreLabel = (s) => s >= 75 ? "Strong match" : s >= 50 ? "Partial match — worth considering" : "Not recommended right now";

export default function App() {
  const [screen, setScreen] = useState("loading"); // loading | onboarding | app
  const [onboardStep, setOnboardStep] = useState(0);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE);
  const [view, setView] = useState("analyze");
  const [jobText, setJobText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("assessment");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get("jfa_profile");
        const h = await window.storage.get("jfa_history");
        if (p) { const v = JSON.parse(p.value); setProfile(v); setProfileDraft(v); setScreen("app"); }
        else setScreen("onboarding");
        if (h) setHistory(JSON.parse(h.value));
      } catch(e) { setScreen("onboarding"); }
    })();
  }, []);

  const saveHistory = async (h) => {
    setHistory(h);
    try { await window.storage.set("jfa_history", JSON.stringify(h)); } catch(e) {}
  };

  const completeOnboarding = async () => {
    setProfile(profileDraft);
    try { await window.storage.set("jfa_profile", JSON.stringify(profileDraft)); } catch(e) {}
    setScreen("app");
  };

  const saveProfile = async () => {
    setProfile(profileDraft);
    try { await window.storage.set("jfa_profile", JSON.stringify(profileDraft)); } catch(e) {}
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const analyze = async () => {
    if (!jobText.trim()) return;
    setLoading(true); setError(null); setResults(null);
    try {
      setLoadingMsg("📊 Assessing fit...");
      const assessment = await callClaude(`Assess this job for ${profile.name || "this person"}. Be honest and direct.

JOB DESCRIPTION:
${jobText}

Respond in EXACTLY this format:
SCORE: [0-100]
VERDICT: [STRONG FIT / GOOD FIT / PARTIAL FIT / POOR FIT / NOT RECOMMENDED]
ROLE_TITLE: [extract the job title]
COMPANY: [extract company name or Unknown]
SUMMARY: [2-3 sentences honest overall assessment]
RED_FLAGS: [List any serious issues: visa/work permit problems, dealbreaker constraints from their profile, or write "None"]
MARKET_TREND: [2 sentences: is demand for this role type growing or shrinking over next 3 years? Consider AI impact and sector trends]
STRENGTHS:
- [point]
- [point]
- [point]
GAPS:
- [point]
- [point]
HONEST_ADVICE: [1-2 sentences of frank, direct advice on whether to apply]`, profile);

      const roleTitle = parseField(assessment, "ROLE_TITLE") || "Role";
      const company = parseField(assessment, "COMPANY") || "Unknown";
      const score = parseScore(assessment);
      setResults({ assessment, jobDesc: jobText, roleTitle, company });
      setActiveTab("assessment");

      const entry = {
        id: Date.now(), date: new Date().toLocaleDateString("en-GB"),
        roleTitle, company, score,
        verdict: parseField(assessment, "VERDICT"),
        status: "Applied", jobDesc: jobText
      };
      await saveHistory([entry, ...history].slice(0, 50));
    } catch(e) { setError("Something went wrong. Please try again."); }
    setLoading(false); setLoadingMsg("");
  };

  const generateCV = async () => {
    setLoading(true); setLoadingMsg("📄 Writing tailored CV...");
    try {
      const cv = await callClaude(`Write a tailored CV for this person for the role below.

JOB:
${results.jobDesc}

Rules:
- Lead with a profile statement tailored to this specific role
- Reorder experience to highlight what's most relevant
- Strong action verbs, quantified achievements where possible
- Do NOT invent experience they don't have
- Concise (1 page equivalent)
- Format clearly: PROFILE, EXPERIENCE, EDUCATION, SKILLS`, profile);
      setResults(r => ({ ...r, cv })); setActiveTab("cv");
    } catch(e) { setError("Error generating CV."); }
    setLoading(false); setLoadingMsg("");
  };

  const generateCover = async () => {
    setLoading(true); setLoadingMsg("✉️ Writing cover letter...");
    try {
      const cover = await callClaude(`Write a compelling cover letter for this person for the role below.

JOB:
${results.jobDesc}

Rules:
- Strong, specific opening (not "I am writing to apply")
- Highlight 2-3 most relevant experiences with specifics
- Address why this specific organisation
- ~350 words, confident and direct
- No hollow corporate language or clichés`, profile);
      setResults(r => ({ ...r, cover })); setActiveTab("cover");
    } catch(e) { setError("Error generating cover letter."); }
    setLoading(false); setLoadingMsg("");
  };

  const generateLinkedIn = async () => {
    setLoading(true); setLoadingMsg("💼 Drafting LinkedIn message...");
    try {
      const linkedin = await callClaude(`Write a short LinkedIn outreach message for this person to send to someone at the hiring company.

JOB:
${results.jobDesc}

Rules:
- 2-3 sentences maximum
- Don't ask for a job — ask for a conversation
- Lead with their strongest credential as a hook
- Mention something specific about the company
- Human and confident, not templated`, profile);
      setResults(r => ({ ...r, linkedin })); setActiveTab("linkedin");
    } catch(e) { setError("Error generating LinkedIn message."); }
    setLoading(false); setLoadingMsg("");
  };

  const updateStatus = async (id, status) => {
    await saveHistory(history.map(h => h.id === id ? { ...h, status } : h));
  };
  const deleteItem = async (id) => {
    await saveHistory(history.filter(h => h.id !== id));
  };

  const score = parseScore(results?.assessment);
  const verdict = parseField(results?.assessment, "VERDICT");
  const redFlags = parseField(results?.assessment, "RED_FLAGS");
  const marketTrend = parseField(results?.assessment, "MARKET_TREND");
  const cleanAssessment = results?.assessment
    ?.replace(/SCORE:.*\n/, "")?.replace(/VERDICT:.*\n/, "")
    ?.replace(/ROLE_TITLE:.*\n/, "")?.replace(/COMPANY:.*\n/, "")
    ?.replace(/RED_FLAGS:.*\n/, "")?.replace(/MARKET_TREND:.*\n/, "");

  const currentStep = ONBOARDING_STEPS[onboardStep];

  // ── STYLES ──
  const C = {
    app: { minHeight: "100vh", background: "#f9f7f4", fontFamily: "'Georgia', serif", color: "#1a1a1a" },
    // Onboarding
    onboard: { minHeight: "100vh", background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Georgia', serif" },
    onboardCard: { background: "#fff", borderRadius: "16px", padding: "40px 48px", maxWidth: "560px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
    onboardTitle: { fontSize: "13px", color: "#999", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "32px" },
    onboardQ: { fontSize: "22px", fontWeight: "700", color: "#1a1a2e", marginBottom: "8px", lineHeight: "1.3" },
    onboardHint: { fontSize: "14px", color: "#888", marginBottom: "20px", fontStyle: "italic" },
    progress: { display: "flex", gap: "6px", marginBottom: "32px" },
    progressDot: (active, done) => ({ width: "8px", height: "8px", borderRadius: "50%", background: done ? "#1a1a2e" : active ? "#d4a84b" : "#e5e5e5", transition: "all 0.3s" }),
    // Nav
    nav: { background: "#fff", borderBottom: "1px solid #e8e4df", display: "flex", alignItems: "center", padding: "0 32px", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    navLogo: { fontSize: "15px", fontWeight: "700", color: "#1a1a2e", marginRight: "24px", padding: "16px 0", letterSpacing: "0.5px" },
    navBtn: (a) => ({ padding: "16px 18px", border: "none", background: "transparent", color: a ? "#1a1a2e" : "#aaa", fontFamily: "'Georgia', serif", fontSize: "12px", fontWeight: a ? "700" : "400", cursor: "pointer", borderBottom: a ? "2px solid #d4a84b" : "2px solid transparent", letterSpacing: "0.8px", textTransform: "uppercase", transition: "all 0.2s" }),
    // Layout
    wrap: { maxWidth: "820px", margin: "0 auto", padding: "36px 24px" },
    h1: { fontSize: "28px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 6px" },
    sub: { color: "#999", fontSize: "14px", margin: "0 0 28px", fontStyle: "italic" },
    // Cards
    card: { background: "#fff", border: "1px solid #e8e4df", borderRadius: "12px", padding: "24px", marginBottom: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
    // Form
    label: { display: "block", color: "#888", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "8px" },
    input: { width: "100%", background: "#fafafa", border: "1px solid #e0dbd4", borderRadius: "8px", padding: "11px 14px", color: "#1a1a1a", fontFamily: "'Georgia', serif", fontSize: "14px", outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", minHeight: "130px", background: "#fafafa", border: "1px solid #e0dbd4", borderRadius: "8px", padding: "11px 14px", color: "#1a1a1a", fontFamily: "'Georgia', serif", fontSize: "14px", resize: "vertical", outline: "none", boxSizing: "border-box" },
    // Buttons
    btnPrimary: { background: "#1a1a2e", color: "#fff", border: "none", borderRadius: "8px", padding: "12px 28px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Georgia', serif" },
    btnGold: { background: "#d4a84b", color: "#1a1a2e", border: "none", borderRadius: "8px", padding: "12px 28px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Georgia', serif" },
    btnOutline: { background: "transparent", color: "#1a1a2e", border: "1px solid #1a1a2e", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", cursor: "pointer", fontFamily: "'Georgia', serif" },
    btnGhost: { background: "transparent", color: "#aaa", border: "1px solid #e0dbd4", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "'Georgia', serif" },
    tab: (a) => ({ padding: "9px 16px", borderRadius: "8px", border: "1px solid", borderColor: a ? "#1a1a2e" : "#e0dbd4", background: a ? "#1a1a2e" : "transparent", color: a ? "#fff" : "#aaa", fontWeight: a ? "700" : "400", fontSize: "12px", cursor: "pointer", fontFamily: "'Georgia', serif", letterSpacing: "0.3px" }),
    // Score
    scoreCard: (sc) => ({ background: "#fff", border: `2px solid ${scoreColor(sc)}`, borderRadius: "12px", padding: "20px 24px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }),
    flag: { background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px 16px", marginBottom: "12px", color: "#dc2626", fontSize: "13px", lineHeight: "1.6" },
    trend: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 16px", marginBottom: "12px", color: "#166534", fontSize: "13px", lineHeight: "1.6" },
    pre: { whiteSpace: "pre-wrap", fontFamily: "'Georgia', serif", fontSize: "14px", color: "#1a1a1a", lineHeight: "1.85", margin: 0 },
    select: (status) => ({ background: "#fff", border: `1px solid ${STATUS_COLORS[status] || "#e0dbd4"}`, borderRadius: "6px", padding: "4px 8px", color: STATUS_COLORS[status] || "#aaa", fontFamily: "'Georgia', serif", fontSize: "12px", cursor: "pointer" }),
    statCard: { background: "#fff", border: "1px solid #e8e4df", borderRadius: "10px", padding: "16px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  };

  // ── LOADING ──
  if (screen === "loading") {
    return <div style={{ ...C.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ color: "#aaa", fontStyle: "italic", fontSize: "16px" }}>Loading…</div>
    </div>;
  }

  // ── ONBOARDING ──
  if (screen === "onboarding") {
    const isLast = onboardStep === ONBOARDING_STEPS.length - 1;
    const canProceed = !currentStep.required || (profileDraft[currentStep.key]?.trim().length > 0);

    return (
      <div style={C.onboard}>
        <div style={{ ...C.onboardCard }}>
          <div style={C.onboardTitle}>Job Fit Analyser — Setup {onboardStep + 1} of {ONBOARDING_STEPS.length}</div>

          <div style={C.progress}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div key={i} style={C.progressDot(i === onboardStep, i < onboardStep)} />
            ))}
          </div>

          <div style={C.onboardQ}>{currentStep.label}</div>
          <div style={C.onboardHint}>{currentStep.hint}</div>

          {currentStep.type === "input" ? (
            <input
              style={{ ...C.input, fontSize: "16px", padding: "14px 16px" }}
              placeholder={currentStep.placeholder}
              value={profileDraft[currentStep.key]}
              onChange={e => setProfileDraft(p => ({ ...p, [currentStep.key]: e.target.value }))}
              autoFocus
            />
          ) : (
            <textarea
              style={{ ...C.textarea, minHeight: "150px" }}
              placeholder={currentStep.placeholder}
              value={profileDraft[currentStep.key]}
              onChange={e => setProfileDraft(p => ({ ...p, [currentStep.key]: e.target.value }))}
              autoFocus
            />
          )}

          {!currentStep.required && (
            <div style={{ fontSize: "12px", color: "#bbb", marginTop: "6px", fontStyle: "italic" }}>Optional — you can skip this</div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
            {onboardStep > 0
              ? <button style={C.btnGhost} onClick={() => setOnboardStep(s => s - 1)}>← Back</button>
              : <div />
            }
            <div style={{ display: "flex", gap: "10px" }}>
              {!currentStep.required && (
                <button style={C.btnGhost} onClick={() => isLast ? completeOnboarding() : setOnboardStep(s => s + 1)}>
                  Skip
                </button>
              )}
              <button
                style={{ ...C.btnGold, opacity: canProceed ? 1 : 0.4 }}
                disabled={!canProceed}
                onClick={() => isLast ? completeOnboarding() : setOnboardStep(s => s + 1)}
              >
                {isLast ? "Start Analysing →" : "Continue →"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "24px", fontSize: "12px", color: "#555", textAlign: "center" }}>
          Your data is stored privately in your browser only.
        </div>
      </div>
    );
  }

  // ── MAIN APP ──
  return (
    <div style={C.app}>
      <div style={C.nav}>
        <span style={C.navLogo}>✦ JobFit</span>
        {[["analyze", "Analyse"], ["history", "History"], ["settings", "My Profile"]].map(([v, l]) => (
          <button key={v} style={C.navBtn(view === v)} onClick={() => setView(v)}>{l}</button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: "13px", color: "#bbb", fontStyle: "italic" }}>
          {profile.name && `Hi, ${profile.name.split(" ")[0]}`}
        </div>
      </div>

      <div style={C.wrap}>

        {/* ─── ANALYSE ─── */}
        {view === "analyze" && <>
          <h1 style={C.h1}>Job Fit Analyser</h1>
          <p style={C.sub}>Paste any job description — get an honest assessment, tailored CV, cover letter & LinkedIn message</p>

          <div style={C.card}>
            <label style={C.label}>Job Description</label>
            <textarea
              style={{ ...C.textarea, minHeight: "160px" }}
              placeholder="Paste the full job description here — include the job title, responsibilities, requirements, and company name for the best results..."
              value={jobText}
              onChange={e => setJobText(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
              <span style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic" }}>
                {loading ? loadingMsg : `Assessed against your CV, interests, goals & constraints`}
              </span>
              <button
                style={{ ...C.btnPrimary, opacity: loading || !jobText.trim() ? 0.4 : 1 }}
                onClick={analyze}
                disabled={loading || !jobText.trim()}
              >
                {loading ? "Working…" : "Analyse →"}
              </button>
            </div>
          </div>

          {error && <div style={{ ...C.flag, marginBottom: "14px" }}>⚠ {error}</div>}

          {results && <>
            {/* Score */}
            <div style={C.scoreCard(score)}>
              <div style={{ textAlign: "center", minWidth: "72px" }}>
                <div style={{ fontSize: "52px", fontWeight: "700", color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: "10px", color: "#bbb", marginTop: "2px", letterSpacing: "1.2px", textTransform: "uppercase" }}>Fit Score</div>
              </div>
              <div>
                <div style={{ fontSize: "19px", fontWeight: "700", color: "#1a1a2e" }}>{verdict}</div>
                <div style={{ fontSize: "13px", color: "#aaa", marginTop: "4px", fontStyle: "italic" }}>{results.roleTitle} · {results.company}</div>
                <div style={{ fontSize: "12px", color: scoreColor(score), marginTop: "4px", fontWeight: "600" }}>{scoreLabel(score)}</div>
              </div>
            </div>

            {redFlags && redFlags.toLowerCase() !== "none" && (
              <div style={C.flag}><strong>🚩 Red Flag:</strong> {redFlags}</div>
            )}
            {marketTrend && (
              <div style={C.trend}><strong>📈 3-Year Market Outlook:</strong> {marketTrend}</div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
              {[["assessment","📊 Assessment"],["cv","📄 CV"],["cover","✉️ Cover Letter"],["linkedin","💼 LinkedIn"]].map(([id, label]) => (
                <button key={id} style={C.tab(activeTab === id)} onClick={() => {
                  setActiveTab(id);
                  if (id === "cv" && !results.cv) generateCV();
                  if (id === "cover" && !results.cover) generateCover();
                  if (id === "linkedin" && !results.linkedin) generateLinkedIn();
                }}>{label}</button>
              ))}
            </div>

            <div style={C.card}>
              {activeTab === "assessment" && <>
                <h3 style={{ color: "#1a1a2e", marginTop: 0, fontSize: "15px" }}>Full Assessment</h3>
                <pre style={C.pre}>{cleanAssessment}</pre>
              </>}

              {activeTab === "cv" && (
                loading && loadingMsg.includes("CV") ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontStyle: "italic" }}>{loadingMsg}</div>
                ) : results.cv ? <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ color: "#1a1a2e", margin: 0, fontSize: "15px" }}>Tailored CV</h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={C.btnGhost} onClick={() => navigator.clipboard.writeText(results.cv)}>📋 Copy</button>
                      <button style={C.btnOutline} onClick={() => exportToWord(results.cv, results.roleTitle, profile.name)}>⬇ Word</button>
                    </div>
                  </div>
                  <pre style={C.pre}>{results.cv}</pre>
                </> : <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontStyle: "italic" }}>Generating…</div>
              )}

              {activeTab === "cover" && (
                loading && loadingMsg.includes("cover") ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontStyle: "italic" }}>{loadingMsg}</div>
                ) : results.cover ? <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ color: "#1a1a2e", margin: 0, fontSize: "15px" }}>Cover Letter</h3>
                    <button style={C.btnGhost} onClick={() => navigator.clipboard.writeText(results.cover)}>📋 Copy</button>
                  </div>
                  <pre style={C.pre}>{results.cover}</pre>
                </> : <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontStyle: "italic" }}>Generating…</div>
              )}

              {activeTab === "linkedin" && (
                loading && loadingMsg.includes("LinkedIn") ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontStyle: "italic" }}>{loadingMsg}</div>
                ) : results.linkedin ? <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ color: "#1a1a2e", margin: 0, fontSize: "15px" }}>LinkedIn Outreach</h3>
                    <button style={C.btnGhost} onClick={() => navigator.clipboard.writeText(results.linkedin)}>📋 Copy</button>
                  </div>
                  <div style={{ background: "#f9f7f4", borderRadius: "8px", padding: "20px", borderLeft: "3px solid #d4a84b", fontSize: "15px", lineHeight: "1.8", color: "#1a1a2e", fontStyle: "italic" }}>
                    {results.linkedin}
                  </div>
                </> : <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontStyle: "italic" }}>Generating…</div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <button style={C.btnGhost} onClick={() => { setResults(null); setJobText(""); }}>← Analyse another role</button>
            </div>
          </>}
        </>}

        {/* ─── HISTORY ─── */}
        {view === "history" && <>
          <h1 style={C.h1}>Application History</h1>
          <p style={C.sub}>Track every role you've assessed — and spot patterns in what fits you</p>

          {history.length === 0 ? (
            <div style={{ ...C.card, textAlign: "center", padding: "60px", color: "#bbb", fontStyle: "italic" }}>
              No history yet. Analyse a job to get started.
            </div>
          ) : <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "20px" }}>
              {[
                ["Total Assessed", history.length],
                ["Avg Score", Math.round(history.reduce((a, h) => a + (h.score || 0), 0) / history.length)],
                ["Good Fits (65+)", history.filter(h => h.score >= 65).length],
                ["Interviews", history.filter(h => ["Interview","Final Round","Offer"].includes(h.status)).length]
              ].map(([l, v]) => (
                <div key={l} style={C.statCard}>
                  <div style={{ fontSize: "26px", fontWeight: "700", color: "#d4a84b" }}>{v}</div>
                  <div style={{ fontSize: "11px", color: "#aaa", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={C.card}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 110px 130px 36px", gap: "8px", paddingBottom: "10px", borderBottom: "1px solid #f0ece6", marginBottom: "4px" }}>
                {["Role & Company","Score","Verdict","Status",""].map(h => (
                  <div key={h} style={{ fontSize: "10px", color: "#bbb", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</div>
                ))}
              </div>
              {history.map(item => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 110px 130px 36px", gap: "8px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f9f7f4" }}>
                  <div>
                    <div style={{ fontSize: "14px", color: "#1a1a2e", fontWeight: "600" }}>{item.roleTitle}</div>
                    <div style={{ fontSize: "12px", color: "#bbb", marginTop: "2px" }}>{item.company} · {item.date}</div>
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: scoreColor(item.score) }}>{item.score}</div>
                  <div style={{ fontSize: "11px", color: "#aaa", fontStyle: "italic", lineHeight: "1.4" }}>{item.verdict}</div>
                  <select style={C.select(item.status)} value={item.status} onChange={e => updateStatus(item.id, e.target.value)}>
                    {INTERVIEW_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button style={{ ...C.btnGhost, padding: "3px 7px", color: "#ddd" }} onClick={() => deleteItem(item.id)}>✕</button>
                </div>
              ))}
            </div>
          </>}
        </>}

        {/* ─── SETTINGS ─── */}
        {view === "settings" && <>
          <h1 style={C.h1}>My Profile</h1>
          <p style={C.sub}>Edit your CV, interests, goals and constraints — every analysis uses this</p>

          {[
            ["name", "Your name", "input", "e.g. Sarah"],
            ["cv", "CV / Work history", "textarea", "Job titles, companies, dates, key achievements..."],
            ["interests", "What you enjoy & thrive in", "textarea", "Types of work that energise you..."],
            ["dislikes", "What you dislike or struggle with", "textarea", "Work that drains you or doesn't suit you..."],
            ["goals", "Long-term career goals", "textarea", "Where you want to be in 3–5 years..."],
            ["constraints", "Constraints & red flags", "textarea", "Visa requirements, sectors to avoid, dealbreakers..."]
          ].map(([key, label, type, placeholder]) => (
            <div key={key} style={{ ...C.card, marginBottom: "10px" }}>
              <label style={C.label}>{label}</label>
              {type === "input"
                ? <input style={C.input} placeholder={placeholder} value={profileDraft[key]} onChange={e => setProfileDraft(p => ({ ...p, [key]: e.target.value }))} />
                : <textarea style={{ ...C.textarea, minHeight: "90px" }} placeholder={placeholder} value={profileDraft[key]} onChange={e => setProfileDraft(p => ({ ...p, [key]: e.target.value }))} />
              }
            </div>
          ))}

          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
            <button style={C.btnPrimary} onClick={saveProfile}>Save Profile</button>
            <button style={C.btnGhost} onClick={() => { setProfileDraft(EMPTY_PROFILE); setScreen("onboarding"); setOnboardStep(0); }}>
              Reset & Restart
            </button>
            {profileSaved && <span style={{ color: "#10b981", fontSize: "13px" }}>✓ Saved</span>}
          </div>
        </>}

      </div>
    </div>
  );
}
