import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Trophy, Search, RefreshCcw, Play, BarChart3, Star, Clock, ChevronRight, User, X, ShieldCheck, Loader2, Activity
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale, PointElement, LineElement
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, RadialLinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const lineupCache = {}; // Global session cache

const App = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('goalscrape_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // --- GOALSCRAPE AI LOGIC V7.0 ---
  const getAIAnalysis = (match) => {
    try {
      const scores = (match.Score || "0 - 0").split(' - ');
      const h = parseInt(scores[0]) || 0;
      const a = parseInt(scores[1]) || 0;
      const timeStr = match.Time.toLowerCase();
      
      let homeProb = 33 + (h - a) * 20;
      let awayProb = 33 + (a - h) * 20;
      
      // Time factor
      if (timeStr.includes('finished')) {
        return h > a ? {h:100, a:0, d:0, v:match['Home Team']} : (a > h ? {h:0, a:100, d:0, v:match['Away Team']} : {h:0, a:0, d:100, v: "Draw"});
      }

      const total = homeProb + awayProb + 25;
      return {
        home: Math.max(5, Math.min(95, Math.round((homeProb / total) * 100))),
        away: Math.max(5, Math.min(95, Math.round((awayProb / total) * 100))),
        draw: Math.max(5, Math.min(50, Math.round((25 / total) * 100))),
        verdict: h > a ? match['Home Team'] : (a > h ? match['Away Team'] : "High Draw Probability")
      };
    } catch(e) {
      return { home: 33, away: 33, draw: 34, verdict: "Analyzing..." };
    }
  };

  const generateAIStats = (match) => {
    const scores = (match.Score || "0 - 0").split(' - ');
    const h = parseInt(scores[0]) || 0;
    const a = parseInt(scores[1]) || 0;
    
    let baseHomePossession = 50 + (h - a) * 5;
    baseHomePossession = Math.max(35, Math.min(65, baseHomePossession));
    
    return {
      possession: [baseHomePossession, 100 - baseHomePossession],
      shots: [h * 3 + 2, a * 3 + 2],
      corners: [h + 3, a + 3],
      fouls: [10 + a, 10 + h], // Losing team usually fouls more
      cards: [Math.min(4, Math.max(1, a)), Math.min(4, Math.max(1, h))]
    };
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('goalscrape_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const fetchMatches = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/matches');
      if (response.data.success) {
        setMatches(response.data.data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerScraper = async () => {
    setScraping(true);
    try {
      await axios.post('http://localhost:5000/api/scrape');
      await fetchMatches();
    } catch (error) {
      console.error("Scraping error:", error);
    } finally {
      setScraping(false);
    }
  };

  const toggleFavorite = (e, match) => {
    e.stopPropagation();
    const matchId = `${match.League}-${match['Home Team']}-${match['Away Team']}`;
    setFavorites(prev => 
      prev.includes(matchId) 
        ? prev.filter(id => id !== matchId) 
        : [...prev, matchId]
    );
  };

  const filteredMatches = matches.filter(match => 
    match['Home Team'].toLowerCase().includes(searchTerm.toLowerCase()) ||
    match['Away Team'].toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.League.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedMatches = useMemo(() => {
    const groups = {};
    filteredMatches.forEach(match => {
      if (!groups[match.League]) groups[match.League] = [];
      groups[match.League].push(match);
    });
    return groups;
  }, [filteredMatches]);

  const favoriteMatches = matches.filter(match => 
    favorites.includes(`${match.League}-${match['Home Team']}-${match['Away Team']}`)
  );

  const chartData = useMemo(() => {
    const leagues = Object.keys(groupedMatches);
    const counts = leagues.map(l => groupedMatches[l].length);
    return {
      labels: leagues.slice(0, 8),
      datasets: [
        {
          label: 'Matches',
          data: counts.slice(0, 8),
          backgroundColor: '#00ff80',
          borderRadius: 5,
        },
      ],
    };
  }, [groupedMatches]);

  const AIAnalysisModal = ({ match, onClose }) => {
    if (!match) return null;
    const isFinished = match.Time.toLowerCase().includes('finished');
    const analysis = getAIAnalysis(match);
    const simulatedStats = generateAIStats(match);
    
    const doughnutData = {
      labels: [match['Home Team'], match['Away Team'], 'Draw'],
      datasets: [{
        data: [analysis.home || analysis.h, analysis.away || analysis.a, analysis.draw || analysis.d],
        backgroundColor: ['#00ff80', '#00bcff', 'rgba(255, 255, 255, 0.1)'],
        borderColor: 'transparent',
        hoverOffset: 4
      }]
    };

    const StatRow = ({ label, home, away, isPercent }) => {
      const isHomeWinner = home > away;
      const isAwayWinner = away > home;

      return (
        <div className="stat-list-row">
          <div className={`stat-num home ${isHomeWinner ? 'winner' : ''}`}>
            {home}{isPercent ? '%' : ''}
          </div>
          <div className="stat-label-center">{label}</div>
          <div className={`stat-num away ${isAwayWinner ? 'winner' : ''}`}>
            {away}{isPercent ? '%' : ''}
          </div>
        </div>
      );
    };

    const pseudoRandom = (seedInfo, index, max) => {
      let hash = 0;
      for (let i = 0; i < seedInfo.length; i++) hash = seedInfo.charCodeAt(i) + ((hash << 5) - hash);
      const x = Math.abs(Math.sin(hash + index + 1)) * 10000;
      return Math.floor((x - Math.floor(x)) * max) + 1;
    };

    const generateMatchTimeline = (match) => {
      const scores = (match.Score || "0 - 0").split(' - ');
      const h = parseInt(scores[0]) || 0;
      const a = parseInt(scores[1]) || 0;
      const isFinished = match.Time.toLowerCase().includes('finished');
      
      let maxMin = 90;
      const timeNum = parseInt(match.Time.replace(/[^0-9]/g, ''));
      if (!isNaN(timeNum) && timeNum > 0 && !isFinished) {
        maxMin = Math.min(90, timeNum);
      }
      
      const seed = match['Home Team'] + match['Away Team'];
      let events = [];
      
      for(let i=0; i<h; i++) events.push({ minute: pseudoRandom(seed, i*5, maxMin), team: 'home', type: 'goal' });
      for(let i=0; i<a; i++) events.push({ minute: pseudoRandom(seed, i*7+11, maxMin), team: 'away', type: 'goal' });
      
      const cards = pseudoRandom(seed, 10, 4); // 1 to 4 yellow cards
      for(let i=0; i<cards; i++) {
          const t = pseudoRandom(seed, 20+i, 2) === 1 ? 'home' : 'away';
          events.push({ minute: pseudoRandom(seed, 30+i, maxMin), team: t, type: 'yellow' });
      }
      
      events.sort((ev1, ev2) => ev1.minute - ev2.minute);
      return events;
    };

    const generateRecentForm = (teamName) => {
      const outcomes = ['W', 'W', 'D', 'L', 'W', 'L', 'W', 'D']; // Weighted for realistic distribution
      const form = [];
      for(let i=0; i<5; i++) {
        const idx = pseudoRandom(teamName, i * 13, outcomes.length) - 1;
        form.push(outcomes[idx] || 'W');
      }
      return form;
    };

    const TeamForm = ({ team, alignment }) => {
       const form = useMemo(() => generateRecentForm(team), [team]);
       return (
          <div className={`team-form-block ${alignment}`}>
             <span className="form-team-name">{team}</span>
             <div className="form-badges">
                {form.map((res, i) => <span key={i} className={`f-badge ${res}`}>{res}</span>)}
             </div>
          </div>
       );
    };

    const timelineEvents = useMemo(() => generateMatchTimeline(match), [match]);

    const TimelineView = () => (
      <div className="match-stats-visualizer mt-4" style={{border: 'none', background: 'transparent', padding: '10px 0'}}>
        <h4 className="stats-title" style={{color: '#a0aec0', fontSize: '0.8rem', paddingBottom: '20px', textAlign: 'center', letterSpacing: '1px', fontWeight: '600'}}>
          MATCH EVENTS
        </h4>
        <div className="timeline-container">
          <div className="timeline-spine"></div>
          {timelineEvents.map((ev, idx) => (
            <div key={idx} className={`timeline-entry ${ev.team}`}>
               <div className="time-col side-left text-right">
                 {ev.team === 'home' && <span className={`event-badge ${ev.type}`}>{ev.type === 'goal' ? '⚽ Goal' : '🟨 Card'}</span>}
               </div>
               <div className="time-col center-min">
                  <span>{ev.minute}'</span>
               </div>
               <div className="time-col side-right text-left">
                 {ev.team === 'away' && <span className={`event-badge ${ev.type}`}>{ev.type === 'goal' ? '⚽ Goal' : '🟨 Card'}</span>}
               </div>
            </div>
          ))}
          {timelineEvents.length === 0 && <div className="no-events text-center mt-2 text-gray-500 text-sm">Waiting for match events...</div>}
        </div>
      </div>
    );

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content analytics" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{isFinished ? <Trophy size={20} /> : <BarChart3 size={20} />} {isFinished ? "Match Summary" : "AI Match Analysis"}</h3>
            <button className="close-btn" onClick={onClose}><X /></button>
          </div>
          
          <div className="ai-content-body">
            {!isFinished ? (
              <>
                <div className="prediction-hero">
                   <div className="chart-circle" style={{width: '180px', position: 'relative'}}>
                     <Doughnut data={doughnutData} options={{ cutout: '80%', plugins: { legend: { display: false } } }} />
                     <div className="center-prob" style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold'}}>
                       {analysis.home || analysis.h}%
                     </div>
                   </div>
                   <div className="verdict-card">
                     <label>GOALSCRAPE VERDICT</label>
                     <h3>{analysis.verdict || analysis.v}</h3>
                     <p className="sub-text">{match.Score} • {match.Time}</p>
                     <div className="analytics-badge">PREDICTIVE MODE</div>
                   </div>
                </div>

                <div className="recent-form-container">
                  <h4 className="stats-title" style={{color: '#a0aec0', fontSize: '0.8rem', paddingBottom: '15px', textAlign: 'center', letterSpacing: '1px', fontWeight: '600'}}>
                    RECENT FORM
                  </h4>
                  <div className="form-comparison">
                     <TeamForm team={match['Home Team']} alignment="left" />
                     <div className="form-vs-badge">H2H</div>
                     <TeamForm team={match['Away Team']} alignment="right" />
                  </div>
                </div>

                <div className="prob-bars-stack">
                  <div className="prob-bar-label"><span>{match['Home Team']}</span><span>{analysis.home || analysis.h}%</span></div>
                  <div className="progress-bg"><div className="progress-fill home" style={{width: `${analysis.home || analysis.h}%`}}></div></div>
                  <div className="prob-bar-label"><span>Draw</span><span>{analysis.draw || analysis.d}%</span></div>
                  <div className="progress-bg"><div className="progress-fill draw" style={{width: `${analysis.draw || analysis.d}%`}}></div></div>
                  <div className="prob-bar-label"><span>{match['Away Team']}</span><span>{analysis.away || analysis.a}%</span></div>
                  <div className="progress-bg"><div className="progress-fill away" style={{width: `${analysis.away || analysis.a}%`}}></div></div>
                </div>
                
                <TimelineView />

                <div className="match-stats-visualizer mt-4" style={{border: 'none', background: 'transparent', padding: '10px 0'}}>
                  <h4 className="stats-title" style={{color: '#a0aec0', fontSize: '0.8rem', paddingBottom: '20px', textAlign: 'center', letterSpacing: '1px', fontWeight: '600'}}>
                    TEAM STATS
                  </h4>
                  <div className="stats-list">
                    <StatRow label="Possession" home={simulatedStats.possession[0]} away={simulatedStats.possession[1]} isPercent={true} />
                    <StatRow label="Shots" home={simulatedStats.shots[0]} away={simulatedStats.shots[1]} />
                    <StatRow label="Corners" home={simulatedStats.corners[0]} away={simulatedStats.corners[1]} />
                    <StatRow label="Fouls" home={simulatedStats.fouls[0]} away={simulatedStats.fouls[1]} />
                    <StatRow label="Yellow cards" home={simulatedStats.cards[0]} away={simulatedStats.cards[1]} />
                  </div>
                </div>
              </>
            ) : (
              <div className="finished-match-summary">
                 <div className="result-hero">
                    <div className="hero-team"><span>{match['Home Team']}</span></div>
                    <div className="hero-score">{match.Score}</div>
                    <div className="hero-team text-right"><span>{match['Away Team']}</span></div>
                 </div>

                 <div className="recent-form-container mt-2">
                  <h4 className="stats-title" style={{color: '#a0aec0', fontSize: '0.8rem', paddingBottom: '15px', textAlign: 'center', letterSpacing: '1px', fontWeight: '600'}}>
                    RECENT FORM
                  </h4>
                  <div className="form-comparison">
                     <TeamForm team={match['Home Team']} alignment="left" />
                     <div className="form-vs-badge">H2H</div>
                     <TeamForm team={match['Away Team']} alignment="right" />
                  </div>
                </div>
                 
                 <TimelineView />

                 <div className="match-stats-visualizer mt-4" style={{border: 'none', background: 'transparent', padding: '10px 0'}}>
                  <h4 className="stats-title" style={{color: '#a0aec0', fontSize: '0.8rem', paddingBottom: '20px', textAlign: 'center', letterSpacing: '1px', fontWeight: '600'}}>
                    TEAM STATS
                  </h4>
                  <div className="stats-list">
                    <StatRow label="Possession" home={simulatedStats.possession[0]} away={simulatedStats.possession[1]} isPercent={true} />
                    <StatRow label="Shots" home={simulatedStats.shots[0]} away={simulatedStats.shots[1]} />
                    <StatRow label="Corners" home={simulatedStats.corners[0]} away={simulatedStats.corners[1]} />
                    <StatRow label="Fouls" home={simulatedStats.fouls[0]} away={simulatedStats.fouls[1]} />
                    <StatRow label="Yellow cards" home={simulatedStats.cards[0]} away={simulatedStats.cards[1]} />
                  </div>
                </div>

                 <div className="summary-card">
                    <label>STATUS</label>
                    <p>This match is officially completed.</p>
                    <div className="completion-badge">MATCH FINISHED</div>
                 </div>
              </div>
            )}
          </div>
          
          <div className="modal-footer-info">
             <Clock size={14} /> {isFinished ? "Match database archived" : "Next outcome update in 60s"}
          </div>
        </div>
      </div>
    );
  };

  const MatchCard = ({ match }) => {
    const analysis = getAIAnalysis(match);
    const isFinished = match.Time.toLowerCase().includes('finished');
    const matchId = `${match.League}-${match['Home Team']}-${match['Away Team']}`;
    const isFav = favorites.includes(matchId);
    const scores = (match.Score || "0 - 0").split(' - ');
    const homeScore = scores[0] || '0';
    const awayScore = scores[1] || '0';

    return (
      <div className={`match-card ai-powered ${isFav ? 'premium-fav' : ''} ${isFinished ? 'finished' : ''}`} onClick={() => setSelectedMatch(match)}>
        <div className="match-card-header">
           <span className={isFinished ? "finished-badge" : "live-badge"}>
             {!isFinished && <span className="pulse"></span>} {match.Time}
           </span>
           {!isFinished && (
             <div className="ai-badge-mini">
               AI {analysis.home || analysis.h}%
             </div>
           )}
           <button 
             className={`fav-btn ${isFav ? 'active' : ''}`}
             onClick={(e) => toggleFavorite(e, match)}
           >
             <Star filling={isFav ? "white" : "none"} size={16} />
           </button>
        </div>
        
        <div className="teams-container">
          <div className="team">
            <span className="team-name">{match['Home Team']}</span>
            <span className="score-val">{homeScore}</span>
          </div>
          <div className="team">
            <span className="team-name">{match['Away Team']}</span>
            <span className="score-val">{awayScore}</span>
          </div>
        </div>
        
        <div className="match-footer ai">
          {!isFinished ? (
            <div className="win-expectation">
              <div className="exp-bar"><div className="exp-fill" style={{width: `${analysis.home || analysis.h}%`}}></div></div>
              <span>AI Expectation: {analysis.verdict || analysis.v}</span>
            </div>
          ) : (
             <div className="match-result-tag">
               <Trophy size={14} /> Full Time Result
             </div>
          )}
          <ChevronRight size={14} className="arrow-icon" />
        </div>
      </div>
    );
  };

  const MAJOR_LEAGUES = ['Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League'];

  const finalFilteredMatches = useMemo(() => {
    let base = matches.filter(match => 
      match['Home Team'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      match['Away Team'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.League.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (activeTab === 'Live') return base.filter(m => !m.Time.includes(':') && !m.Time.toLowerCase().includes('finished'));
    if (activeTab === 'Finished') return base.filter(m => m.Time.toLowerCase().includes('finished'));
    if (MAJOR_LEAGUES.includes(activeTab)) return base.filter(m => m.League.toLowerCase().includes(activeTab.toLowerCase()));
    
    return base;
  }, [matches, searchTerm, activeTab]);

  const finalGroups = useMemo(() => {
    const groups = {};
    finalFilteredMatches.forEach(match => {
      if (!groups[match.League]) groups[match.League] = [];
      groups[match.League].push(match);
    });
    return groups;
  }, [finalFilteredMatches]);

  const favMatches = matches.filter(match => 
    favorites.includes(`${match.League}-${match['Home Team']}-${match['Away Team']}`)
  );

  const pseudoRandomStandings = (seedInfo, index, max) => {
    let hash = 0;
    for (let i = 0; i < seedInfo.length; i++) hash = seedInfo.charCodeAt(i) + ((hash << 5) - hash);
    const x = Math.abs(Math.sin(hash + index + 1)) * 10000;
    return Math.floor((x - Math.floor(x)) * max) + 1;
  };

  const standingsData = useMemo(() => {
    const sData = {};
    Object.keys(finalGroups).forEach(league => {
      const teamsSet = new Set();
      finalGroups[league].forEach(m => {
        teamsSet.add(m['Home Team']);
        teamsSet.add(m['Away Team']);
      });
      
      const generated = Array.from(teamsSet).map(team => {
        const pld = pseudoRandomStandings(team, 1, 10) + 20;
        const w = pseudoRandomStandings(team, 2, pld);
        const d = pseudoRandomStandings(team, 3, pld - w);
        const l = pld - w - d;
        const gf = w * 2 + pseudoRandomStandings(team, 4, 30);
        const ga = l * 2 + pseudoRandomStandings(team, 5, 30);
        const gd = gf - ga;
        const pts = w * 3 + d;
        return { team, pld, w, d, l, gf, ga, gd, pts };
      });
      
      generated.sort((a, b) => b.pts - a.pts || b.gd - a.gd);
      sData[league] = generated;
    });
    return sData;
  }, [finalGroups]);

  return (
    <div className="dashboard dark-ai">
      <header className="main-header">
        <div className="brand">
          <div className="logo-icon"><Trophy size={32} /></div>
          <div className="brand-text">
            <h1>GoalScrape AI</h1>
            <p>Predictive Intelligence Hub</p>
          </div>
        </div>

        <div className="header-actions">
           <div className="search-box">
             <Search size={18} />
             <input type="text" placeholder="Search matches or leagues..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
           
           <button className={`action-btn analytics ${showAnalytics ? 'active' : ''}`} onClick={() => setShowAnalytics(!showAnalytics)}>
             <BarChart3 size={20} /> <span>Analytics</span>
           </button>

           <button className={`action-btn scrape ${scraping ? 'loading' : ''}`} onClick={triggerScraper} disabled={scraping}>
             <RefreshCcw size={20} className={scraping ? 'spin' : ''} />
             <span>Refetch</span>
           </button>
        </div>
      </header>

      <div className="tabs-bar">
        {['All', 'Live', 'Finished', 'Standings'].map(tab => (
          <button 
            key={tab} 
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        
        <div className="league-dropdown-container">
           <select 
              className={`tab-item league-select ${MAJOR_LEAGUES.includes(activeTab) ? 'active' : ''}`}
              onChange={(e) => setActiveTab(e.target.value)}
              value={MAJOR_LEAGUES.includes(activeTab) ? activeTab : 'default'}
           >
              <option value="default" disabled>Select League ▾</option>
              {MAJOR_LEAGUES.map(league => (
                 <option key={league} value={league}>{league}</option>
              ))}
           </select>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <label>MATCHES</label>
          <div className="stat-val">{finalFilteredMatches.length}</div>
        </div>
        <div className="stat-item">
          <label>AI VERDICTS</label>
          <div className="stat-val">{finalFilteredMatches.length}</div>
        </div>
        <div className="stat-item">
          <label>NETWORK</label>
          <div className="stat-val">{lastUpdated}</div>
        </div>
      </div>

      <main className="content">
        {showAnalytics && (
          <section className="analytics-section">
            <div className="chart-wrapper">
              <h3><BarChart3 size={20} style={{verticalAlign: 'middle', marginRight: '10px'}}/> AI League Distribution</h3>
              <div style={{ height: '300px' }}>
                <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </section>
        )}

        {activeTab === 'Standings' ? (
          <div className="standings-wrapper">
            {Object.keys(standingsData).map(league => (
               <section key={league} className="category-section">
                  <h2 className="section-title"><Trophy size={20} color="#00ff80" /> {league} - Standings</h2>
                  <div className="table-container">
                    <table className="standings-table">
                       <thead>
                         <tr>
                           <th>#</th>
                           <th className="team-col-header">TEAM</th>
                           <th>PL</th>
                           <th>W</th>
                           <th>D</th>
                           <th>L</th>
                           <th>GD</th>
                           <th>PTS</th>
                         </tr>
                       </thead>
                       <tbody>
                         {standingsData[league].map((t, i) => (
                            <tr key={i} className={i < 4 ? 'promo-zone' : (i >= standingsData[league].length - 3 && standingsData[league].length > 4 ? 'rel-zone' : '')}>
                              <td className="rank-cell">
                                <span className="rank-badge">{i + 1}</span>
                              </td>
                              <td className="team-col-name">{t.team}</td>
                              <td>{t.pld}</td>
                              <td>{t.w}</td>
                              <td>{t.d}</td>
                              <td>{t.l}</td>
                              <td>{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                              <td className="pts-col">{t.pts}</td>
                            </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
               </section>
            ))}
            {Object.keys(standingsData).length === 0 && (
               <div className="no-data-msg text-center mt-8 text-gray-500">No league standings available in the database currently.</div>
            )}
          </div>
        ) : (
          <>
            {favMatches.length > 0 && activeTab === 'All' && (
              <section className="category-section favorites-area">
                <h2 className="section-title"><Star className="fill-yellow" size={24} /> Pinned Analytics</h2>
                <div className="matches-grid">
                  {favMatches.map((match, idx) => <MatchCard key={`fav-${idx}`} match={match} />)}
                </div>
              </section>
            )}

            {Object.keys(finalGroups).map(league => (
              <section key={league} className="category-section">
                <h2 className="section-title"><ChevronRight size={20} /> {league}</h2>
                <div className="matches-grid">
                  {finalGroups[league].map((match, idx) => <MatchCard key={idx} match={match} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      <AIAnalysisModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  );
};

export default App;
