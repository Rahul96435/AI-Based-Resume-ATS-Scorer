import React, { useEffect, useState } from 'react';
import { analyze, authenticate, getHistory, removeHistory, report } from './api.js';

const scoreLabels = { formatting: 'Formatting', keywords: 'Keywords & skills', content: 'Content quality', skill_validation: 'Skill validation', ats_compatibility: 'ATS compatibility' };
const storedSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem('ats-session'));
    return session?.token && session?.user?.email ? session : null;
  } catch {
    return null;
  }
};

function Auth({ onSuccess }) {
  const [mode, setMode] = useState('login'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { onSuccess(await authenticate(mode === 'login' ? 'login' : 'register', email, password)); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">ATS RESUME SCORER</p><h1>Make every application count.</h1><p>Upload your resume, compare it to a job description, and get an actionable ATS review.</p><form onSubmit={submit}><label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input required minLength="8" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="error">{error}</p>}<button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}</button></section></main>;
}

function Results({ result, onDownload }) {
  if (!result) return null;
  const jd = result.jd_comparison;
  return <section className="results"><div className="result-hero"><div><p className="eyebrow">ANALYSIS COMPLETE</p><h2>{result.interpretation}</h2></div><div className="score-circle"><strong>{Math.round(result.ATS_score)}</strong><span>/100</span></div></div><div className="score-grid">{Object.entries(result.component_scores).map(([key, value]) => <article key={key} className="score-card"><span>{scoreLabels[key]}</span><strong>{value}</strong><div className="meter"><i style={{ width: `${key === 'formatting' ? value * 5 : key === 'keywords' || key === 'content' ? value * 4 : value * 6.67}%` }} /></div></article>)}</div>{jd && <section className="panel"><h3>Job-description match <span>{jd.match_percentage}%</span></h3><div className="pill-group"><div><b>Matched</b>{jd.matched_keywords.map((item) => <em className="pill match" key={item}>{item}</em>) || '—'}</div><div><b>Missing</b>{jd.missing_keywords.map((item) => <em className="pill missing" key={item}>{item}</em>) || '—'}</div></div></section>}<section className="two-column"><article className="panel"><h3>Strengths</h3><ul>{result.strengths.length ? result.strengths.map((item) => <li key={item}>{item}</li>) : <li>Start by adding standard sections and relevant skills.</li>}</ul></article><article className="panel"><h3>Skill evidence</h3><p>{result.skill_validation_details.validated_count} of {result.skill_validation_details.total} detected skills are supported by experience or projects.</p><div className="pill-group">{result.skill_validation_details.unvalidated.map((item) => <em className="pill missing" key={item}>{item}</em>)}</div></article></section><section className="panel"><div className="panel-heading"><h3>Improvement plan</h3><button onClick={onDownload} className="secondary">Download PDF report</button></div>{result.detailed_feedback.length ? result.detailed_feedback.map((issue) => <article className="issue" key={issue.issue_title}><div><span className={`severity ${issue.severity_level.toLowerCase()}`}>{issue.severity_level}</span><h4>{issue.issue_title}</h4></div><p>{issue.explanation}</p><p><b>Fix:</b> {issue.how_to_fix}</p></article>) : <p>No major issues found—tailor your skills and examples to the role before you apply.</p>}</section></section>;
}

function History({ entries, onDelete, onOpen }) { return <section className="panel history"><div className="panel-heading"><h3>Previous analyses</h3><span>{entries.length} saved</span></div>{entries.length ? entries.map((entry) => <div className="history-row" key={entry.id}><button className="history-open" onClick={() => onOpen(entry.analysis_result)}><b>{entry.filename}</b><small>{new Date(entry.created_at).toLocaleString()} · {entry.analysis_result.ATS_score}/100</small></button><button className="danger" onClick={() => onDelete(entry.id)}>Delete</button></div>) : <p>No saved analyses yet.</p>}</section>; }

export default function App() {
  const [session, setSession] = useState(storedSession); 
  const [resume, setResume] = useState(null); 
  const [jd, setJd] = useState(''); 
  const [result, setResult] = useState(null); 
  const [history, setHistory] = useState([]); 
  const [error, setError] = useState(''); 
  const [busy, setBusy] = useState(false);
  const refreshHistory = async (token = session?.token) => { 
    if (token) setHistory(await getHistory(token)); 
  };
  useEffect(() => { 
    refreshHistory().catch(() => { }); 
  }, [session]);
  function setLoggedIn(next) {
    localStorage.setItem('ats-session', JSON.stringify(next)); 
    setSession(next); 
  }
  function signOut() {
    localStorage.removeItem('ats-session'); 
    setSession(null); 
    setHistory([]); 
    setResult(null); 
  }
  async function submit(event) {
    event.preventDefault();
    if (!resume) return setError('Choose a PDF or DOCX resume first.'); 
    setBusy(true); 
    setError(''); 
    try {
      setResult(await analyze(session.token, resume, jd)); 
      await refreshHistory(); 
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setBusy(false); 
    } 
  }
  async function download() {
    try {
      const blob = await report(session.token, result); 
      const url = URL.createObjectURL(blob); 
      const link = document.createElement('a'); 
      link.href = url; 
      link.download = 'ats_resume_report.pdf'; 
      link.click(); 
      URL.revokeObjectURL(url); 
    } catch (err) { 
      setError(err.message); 
    } 
  }
  async function deleteEntry(id) { 
    try { 
      await removeHistory(session.token, id); await refreshHistory(); 
    } catch (err) { 
      setError(err.message); 
    } 
  }
  if (!session) return <Auth onSuccess={setLoggedIn} />;
  return <><header><a className="brand">ATS<span>•</span>score</a><nav><button className="link-button" onClick={signOut}>Sign out</button></nav></header><main className="app-shell"><section className="intro"><p className="eyebrow">WELCOME, {session.user.email}</p><h1>Analyze your resume.</h1><p>Get a practical scorecard, evidence-backed skill review, and targeted job-description matching.</p></section><form className="analyzer panel" onSubmit={submit}><label className="file-label"><b>Resume</b><input type="file" accept=".pdf,.docx" onChange={(e) => setResume(e.target.files[0] || null)} /><small>{resume ? resume.name : 'PDF or DOCX · maximum 5 MB'}</small></label><label><b>Job description <small>(optional)</small></b><textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description to compare keywords and skill gaps." rows="7" /></label>{error && <p className="error">{error}</p>}<button disabled={busy}>{busy ? 'Analyzing your resume…' : 'Analyze resume'}</button></form><Results result={result} onDownload={download} /><History entries={history} onDelete={deleteEntry} onOpen={setResult} /></main></>;
}
