import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { leaderboard as leaderboardApi, groups as groupsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, ChevronLeft, ChevronRight, Globe2, Search, Trophy, Users } from 'lucide-react';

const RANGES = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week',  label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
];

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'k';
  return n.toLocaleString();
}
function fmtScore(n) {
  n = Number(n)||0;
  return n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:1});
}

const AVATAR_GRADS = [
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#64748b,#64748b)',
  'linear-gradient(135deg,#b45309,#92400e)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
  'linear-gradient(135deg,#22c55e,#16a34a)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
];

function Avatar({name,size=36,idx=0}) {
  return (
    <div style={{
      width:size,height:size,borderRadius:6,flexShrink:0,
      background:AVATAR_GRADS[idx%AVATAR_GRADS.length],
      display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:size*.34,fontWeight:900,color:'#fff',letterSpacing:'-0.5px',
    }}>
      {(name||'U').substring(0,2).toUpperCase()}
    </div>
  );
}

const PAGE_SIZE = 10;

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const initialGroupId = searchParams.get('groupId');

  const [activeTab, setActiveTab] = useState(initialGroupId ? 'group' : 'global');
  const [range, setRange]   = useState('today');
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [now, setNow]       = useState(new Date());

  const [myGroups, setMyGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || '');
  const requestIdRef = useRef(0);

  useEffect(() => { const t=setInterval(()=>setNow(new Date()),30000); return ()=>clearInterval(t); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Fetch groups for the dropdown
  useEffect(() => {
    const fetchMyGroups = async () => {
      try {
        const res = await groupsApi.list();
        setMyGroups(res.data || []);
        if (res.data?.length > 0 && !selectedGroupId && activeTab === 'group') {
          setSelectedGroupId(res.data[0].id);
        }
      } catch (err) { console.error(err); }
    };
    fetchMyGroups();
  }, [activeTab]);

  const fetchData = async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setUsers([]);
    setLoading(true);
    try {
      let res;
      if (activeTab === 'global') {
        res = await leaderboardApi.get(range);
      } else if (selectedGroupId) {
        res = await leaderboardApi.group(selectedGroupId, range);
      }
      if (res) {
        if (requestId !== requestIdRef.current) return;
        setUsers(res.data || []);
        setPage(1);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) console.error(err);
    }
    if (requestId === requestIdRef.current) setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [range, activeTab, selectedGroupId]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;
    const eventBelongsToCurrentView = (data = {}) => {
      if (range === 'today' && data.statDate && data.statDate !== localDateKey()) return false;
      if (activeTab === 'group') {
        if (!selectedGroupId) return false;
        return String(data.teamId || '') === String(selectedGroupId);
      }
      return true;
    };

    const handleActivity = (data) => {
      if (!eventBelongsToCurrentView(data)) return;
      setUsers(prev => {
        const userId = String(data.userId || data.user_id);
        const totals = data.totals || null;
        const delta = data.delta || {};
        const deltaKeys = Number(delta.keystrokeCount ?? data.keystrokes ?? 0);
        const deltaClicks = Number(delta.mouseClickCount ?? data.clicks ?? 0);
        const idx = prev.findIndex(u => String(u.user_id || u.id) === userId);
        if (idx >= 0) {
          const next = [...prev];
          const existing = next[idx];
          const status = data.presence || data.presenceStatus || data.status || existing.status || 'active';
          next[idx] = { 
            ...existing,
            ...data,
            name: data.name || existing.name,
            status,
            presence: status,
            presenceStatus: status,
            keystrokeCount: totals ? Number(totals.keystrokeCount || 0) : (Number(existing.keystrokeCount) || 0) + deltaKeys,
            mouseClickCount: totals ? Number(totals.mouseClickCount || 0) : (Number(existing.mouseClickCount) || 0) + deltaClicks,
            score: totals ? Number(totals.focusScore || data.score || 0) : (Number(existing.score) || 0) + (deltaKeys + deltaClicks) * 0.1
          };
          return next.sort((a,b) => Number(b.score||0) - Number(a.score||0));
        }
        // Fallback for new user not yet in DB
        const newUser = {
          ...data,
          user_id: userId,
          name: data.name || `User #${userId}`,
          status: data.presence || data.presenceStatus || data.status || 'active',
          presence: data.presence || data.presenceStatus || data.status || 'active',
          presenceStatus: data.presence || data.presenceStatus || data.status || 'active',
          keystrokeCount: totals ? Number(totals.keystrokeCount || 0) : deltaKeys,
          mouseClickCount: totals ? Number(totals.mouseClickCount || 0) : deltaClicks,
          score: totals ? Number(totals.focusScore || data.score || 0) : (deltaKeys + deltaClicks) * 0.1
        };
        const next = [...prev, newUser];
        return next.sort((a,b) => Number(b.score||0) - Number(a.score||0));
      });
    };
    const handleStatus = (data) => {
      if (activeTab === 'group' && selectedGroupId && data.teamId && String(data.teamId) !== String(selectedGroupId)) return;
      setUsers(prev => {
        const userId = String(data.userId || data.user_id);
        const nextStatus = data.presence || data.presenceStatus || data.status || 'online';
        const idx = prev.findIndex(u => String(u.user_id || u.id) === userId);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: nextStatus,
          presence: nextStatus,
          presenceStatus: nextStatus,
        };
        return next;
      });
    };
    socket.on('activity:user:update', handleActivity);
    socket.on('user:status:update', handleStatus);
    return () => {
      socket.off('activity:user:update', handleActivity);
      socket.off('user:status:update', handleStatus);
    };
  }, [socket, activeTab, selectedGroupId, range]);

  const top1 = users[0], top2 = users[1], top3 = users[2];
  const filtered = users.filter(u=>(u.name||'').toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const avgScore   = users.length ? Math.round(users.reduce((a,u)=>a+Number(u.keystrokeCount||0)+Number(u.mouseClickCount||0),0)/users.length) : 0;
  const timeStr = now.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const CARD = {
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  };

  return (
    <div className="leaderboard-page" style={{fontFamily:"'Space Grotesk',system-ui,sans-serif",maxWidth:1100,margin:'0 auto'}}>
      
      {/* ── HEADER ── */}
      <div style={{marginBottom:28}}>
        <div style={{display:'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16}}>
          <div>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:4,background:'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.25)',marginBottom:12}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:'#3b82f6',animation:'pulse-dot 2s ease infinite'}}/>
              <span style={{fontSize:10,fontWeight:800,color:'#3b82f6',letterSpacing:'0.1em'}}>HỆ THỐNG XẾP HẠNG</span>
            </div>
            <h1 style={{fontSize:32,fontWeight:900,margin:'0 0 6px',letterSpacing:'-0.8px',lineHeight:1}}>
              Bảng Xếp Hạng <span style={{color:'#3b82f6',fontStyle:'italic'}}>{activeTab === 'global' ? 'Toàn Cầu' : 'Nhóm'}</span>
            </h1>
          </div>

          <div className="leaderboard-controls" style={{display: 'flex', gap: 20, alignItems: 'center'}}>
            {/* Tab Switcher */}
            <div style={{display:'flex',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:3,gap:2}}>
              <button onClick={() => setActiveTab('global')} style={{
                padding:'7px 18px',borderRadius:5,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:activeTab==='global'?'#2563eb':'transparent',
                color:activeTab==='global'?'#fff':'#94a3b8',transition:'all .15s',
                display:'flex',alignItems:'center',gap:6,
              }}><Globe2 size={14} /> Toàn Cầu</button>
              <button onClick={() => setActiveTab('group')} style={{
                padding:'7px 18px',borderRadius:5,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:activeTab==='group'?'#2563eb':'transparent',
                color:activeTab==='group'?'#fff':'#94a3b8',transition:'all .15s',
                display:'flex',alignItems:'center',gap:6,
              }}><Users size={14} /> Nhóm</button>
            </div>

            {/* Time Range Filter */}
            <div style={{display:'flex',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:3,gap:2}}>
              {RANGES.map(({key,label})=>(
                <button key={key} onClick={()=>setRange(key)} style={{
                  padding:'7px 18px',borderRadius:5,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                  background:range===key?'#3b82f6':'transparent',
                  color:range===key?'#fff':'#94a3b8',transition:'all .15s',
                  boxShadow:range===key?'0 2px 8px rgba(59,130,246,.3)':'none',
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'group' && (
        <div className="leaderboard-group-filter" style={{...CARD, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16}}>
          <span style={{fontSize: 13, fontWeight: 700, color: '#94a3b8'}}>CHỌN NHÓM:</span>
          {myGroups.length > 0 ? (
            <select 
              value={selectedGroupId} 
              onChange={e => setSelectedGroupId(e.target.value)}
              style={{
                background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)',
                color: '#f1f5f9', padding: '8px 12px', borderRadius: 6, outline: 'none',
                fontSize: 14, fontWeight: 600, minWidth: 200
              }}
            >
              {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          ) : (
            <div style={{fontSize: 13, color: '#64748b'}}>Bạn chưa tham gia nhóm nào. <span onClick={() => navigate('/groups')} style={{display:'inline-flex',alignItems:'center',gap:4,color: '#3b82f6', cursor: 'pointer', fontWeight: 700}}>Đến trang Nhóm <ArrowRight size={13} /></span></div>
          )}
        </div>
      )}

      {/* ── TREND BAR ── */}
      <div className="leaderboard-trend" style={{...CARD,padding:'12px 20px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 8px rgba(34,197,94,0.6)',animation:'pulse-dot 2s ease infinite'}}/>
          <span style={{fontSize:11,fontWeight:700,color:'#22c55e',textTransform:'uppercase',letterSpacing:'0.08em'}}>Xu Hướng Hoạt Động</span>
          <span style={{fontSize:11,color:'#6b7280',marginLeft:6}}>
            ĐIỂM HOẠT ĐỘNG TB: <span style={{color:'#e2e8f0',fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{Number(avgScore).toLocaleString()} điểm</span>
          </span>
        </div>
        <div style={{fontSize:11,color:'#6b7280',fontWeight:600}}>
          Cập nhật lúc: <span style={{color:'#e2e8f0',fontFamily:"'JetBrains Mono',monospace"}}>{timeStr}</span>
        </div>
      </div>

      {/* ── PODIUM ── */}
      {!loading && users.length >= 1 && (
        <div className="leaderboard-podium" style={{...CARD,padding:'28px 24px',marginBottom:20,display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,alignItems:'end'}}>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:10,height:200}}>
            {top2 && (
              <div role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${top2.user_id}`); } }} onClick={()=>navigate(`/users/${top2.user_id}`)} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:8,flex:1}}>
                <div style={{position:'relative'}}>
                  <Avatar name={top2.name} size={44} idx={1}/>
                  <div style={{position:'absolute',bottom:-6,right:-6,width:16,height:16,borderRadius:3,background:'#64748b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#f8fafc'}}>2</div>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textAlign:'center'}}>{(top2.name||'').split(' ').pop().toUpperCase().slice(0,6)+'.'}</div>
                <div style={{fontSize:14,fontWeight:900,color:'#94a3b8',fontFamily:"'JetBrains Mono',monospace"}}>{fmtScore(top2.score)}</div>
                <div style={{width:'100%',height:90,background:'linear-gradient(180deg,rgba(148,163,184,0.15),rgba(148,163,184,0.05))',border:'1px solid rgba(148,163,184,0.2)',borderRadius:'4px 4px 0 0'}}/>
              </div>
            )}
            {top1 && (
              <div role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${top1.user_id}`); } }} onClick={()=>navigate(`/users/${top1.user_id}`)} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:8,flex:1.2}}>
                <Trophy size={18} color="#f59e0b" fill="#f59e0b" />
                <div style={{position:'relative'}}>
                  <Avatar name={top1.name} size={52} idx={0}/>
                  <div style={{position:'absolute',bottom:-6,right:-6,width:18,height:18,borderRadius:3,background:'#f59e0b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:'#f8fafc'}}>1</div>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:'#f59e0b',textAlign:'center'}}>{(top1.name||'').split(' ').pop().toUpperCase().slice(0,6)+'.'}</div>
                <div style={{fontSize:18,fontWeight:900,color:'#f59e0b',fontFamily:"'JetBrains Mono',monospace"}}>{fmtScore(top1.score)}</div>
                <div style={{width:'100%',height:130,background:'linear-gradient(180deg,rgba(245,158,11,0.18),rgba(245,158,11,0.05))',border:'1px solid rgba(245,158,11,0.25)',borderRadius:'4px 4px 0 0'}}/>
              </div>
            )}
            {top3 && (
              <div role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${top3.user_id}`); } }} onClick={()=>navigate(`/users/${top3.user_id}`)} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:8,flex:1}}>
                <div style={{position:'relative'}}>
                  <Avatar name={top3.name} size={40} idx={2}/>
                  <div style={{position:'absolute',bottom:-6,right:-6,width:16,height:16,borderRadius:3,background:'#b45309',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#fff'}}>3</div>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:'#d97706',textAlign:'center'}}>{(top3.name||'').split(' ').pop().toUpperCase().slice(0,6)+'.'}</div>
                <div style={{fontSize:14,fontWeight:900,color:'#d97706',fontFamily:"'JetBrains Mono',monospace"}}>{fmtScore(top3.score)}</div>
                <div style={{width:'100%',height:70,background:'linear-gradient(180deg,rgba(180,83,9,0.15),rgba(180,83,9,0.05))',border:'1px solid rgba(180,83,9,0.2)',borderRadius:'4px 4px 0 0'}}/>
              </div>
            )}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {users.slice(3, 8).map((u,i)=>{
              const rank=i+4;
              return (
                <div key={u.user_id} role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${u.user_id}`); } }} onClick={()=>navigate(`/users/${u.user_id}`)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'rgba(255,255,255,0.03)',borderRadius:6,border:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',transition:'background .15s'}}
                >
                  <div style={{width:22,height:22,borderRadius:4,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#94a3b8',flexShrink:0}}>{rank}</div>
                  <Avatar name={u.name} size={28} idx={rank-1}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{u.name}</div></div>
                  <div style={{fontSize:14,fontWeight:800,color:'#60a5fa',fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{fmtScore(u.score)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BOTTOM TABLE ── */}
      <div className="leaderboard-table-card" style={{...CARD,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'1px solid rgba(15,23,42,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.08em'}}>Danh Sách Thứ Hạng</span>
          </div>
          <div style={{position:'relative'}}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              aria-label="Tìm kiếm người dùng"
              value={searchInput}
              onChange={e=>setSearchInput(e.target.value)}
              placeholder="Tìm người dùng..."
              style={{background:'#1f2937',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'7px 12px 7px 30px',fontSize:12,color:'#f1f5f9',outline:'none',width:200}}
            />
          </div>
        </div>
        <div className="leaderboard-table-scroll">
          <table style={{width:'100%',minWidth:720,borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid rgba(15,23,42,0.06)'}}>
                {['Hạng','Thành Viên','Gõ Phím','Click','Tổng Điểm'].map(h=>(
                  <th key={h} style={{padding:'10px 18px',textAlign:h==='Hạng'?'left':'right',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{padding:'52px',textAlign:'center',color:'#94a3b8'}}>Đang tải...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} style={{padding:'52px',textAlign:'center',color:'#94a3b8'}}>Không có người dùng phù hợp</td></tr>
              ) : paginated.map((u,i)=>{
                const rank = (page-1)*PAGE_SIZE + i + 1;
                const sc = Number(u.score||0);
                return (
                  <tr key={u.user_id} role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${u.user_id}`); } }} onClick={()=>navigate(`/users/${u.user_id}`)} style={{borderBottom:'1px solid rgba(15,23,42,0.04)',cursor:'pointer'}}>
                    <td style={{padding:'12px 18px'}}><div style={{fontSize:11,fontWeight:800,color:'#6b7280'}}>{rank}</div></td>
                    <td style={{padding:'12px 18px'}}><div style={{display:'flex',alignItems:'center',gap:10}}><Avatar name={u.name} size={30} idx={rank-1}/><div style={{fontSize:13,fontWeight:600,color:'#e2e8f0'}}>{u.name}</div></div></td>
                    <td style={{padding:'12px 18px',textAlign:'right'}}><div style={{fontSize:13,fontWeight:800,color:'#e2e8f0',fontFamily:"'JetBrains Mono',monospace"}}>{fmtNum(u.keystrokeCount)}</div></td>
                    <td style={{padding:'12px 18px',textAlign:'right'}}><div style={{fontSize:13,color:'#94a3b8',fontFamily:"'JetBrains Mono',monospace"}}>{fmtNum(u.mouseClickCount)}</div></td>
                    <td style={{padding:'12px 18px',textAlign:'right'}}><span style={{fontSize:15,fontWeight:900,color:'#60a5fa'}}>{fmtScore(sc)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div style={{padding:'12px 18px',borderTop:'1px solid rgba(15,23,42,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:'#6b7280'}}>Trang {page} / {totalPages}</span>
          <div style={{display:'flex',gap:8}}>
            <button aria-label="Trang trước" disabled={page<=1} onClick={()=>setPage(p=>p-1)} style={{padding:'5px 12px',borderRadius:5,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',color:'#e2e8f0',cursor:page<=1?'not-allowed':'pointer',opacity:page<=1?0.4:1,display:'flex',alignItems:'center'}}><ChevronLeft size={15} /></button>
            <button aria-label="Trang sau" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} style={{padding:'5px 12px',borderRadius:5,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',color:'#e2e8f0',cursor:page>=totalPages?'not-allowed':'pointer',opacity:page>=totalPages?0.4:1,display:'flex',alignItems:'center'}}><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
