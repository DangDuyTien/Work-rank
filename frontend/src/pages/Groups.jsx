import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groups as groupsApi, users as usersApi } from '../services/api';
import { Clipboard, Edit3, Plus, RefreshCw, Swords, Trash2, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UiContext';

const CONTEST_STORAGE_KEY = 'workrank:group-contests:v1';

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-content)',
  padding: 24,
  boxShadow: 'var(--shadow-card)',
  transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
};

const BUTTON = {
  padding: '10px 20px',
  borderRadius: 'var(--radius-interactive)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

function loadContests() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTEST_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveContests(contests) {
  localStorage.setItem(CONTEST_STORAGE_KEY, JSON.stringify(contests));
}

function formatDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function memberInviteCode(userId) {
  return `WRU-${String(userId || '').padStart(4, '0')}`;
}

function parseMemberInviteCode(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/^WRU-?/, '');
  const parsed = Number(normalized.replace(/^0+/, '') || normalized);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function timeLeftLabel(endAt, now = new Date()) {
  const ms = new Date(endAt).getTime() - now.getTime();
  if (ms <= 0) return 'Đã kết thúc';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)} ngày ${hours % 24} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showContest, setShowContest] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [contests, setContests] = useState(() => loadContests());
  const [contestMode, setContestMode] = useState('2v2');
  const [contestName, setContestName] = useState('');
  const [contestEndAt, setContestEndAt] = useState(formatDateTimeLocal());
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [memberCode, setMemberCode] = useState('');
  const [addingMember, setAddingMember] = useState('');
  const [contestStats, setContestStats] = useState({});
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await groupsApi.list();
      setGroups(res.data || []);
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Không tải được danh sách nhóm', { type: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      fetchGroups();
    };
    window.addEventListener('workrank:team-updated', handleUpdate);
    window.addEventListener('workrank:user-updated', handleUpdate);
    return () => {
      window.removeEventListener('workrank:team-updated', handleUpdate);
      window.removeEventListener('workrank:user-updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    saveContests(contests);
  }, [contests]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const size = Number(contestMode[0] || 2);
    setTeamA((prev) => prev.slice(0, size));
    setTeamB((prev) => prev.slice(0, size));
  }, [contestMode]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    const name = newName.trim();
    const description = newDesc.trim();
    if (!name) {
      setError('Tên nhóm không được để trống');
      return;
    }
    try {
      await groupsApi.create({ name, description });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      toast('Đã tạo nhóm mới', { type: 'success' });
      void fetchGroups();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Có lỗi xảy ra');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError('Vui lòng nhập mã mời');
      return;
    }
    try {
      await groupsApi.join(code);
      setShowJoin(false);
      setInviteCode('');
      toast('Đã tham gia nhóm', { type: 'success' });
      void fetchGroups();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Mã mời không hợp lệ');
    }
  };

  const handleLeave = async (id) => {
    const ok = await confirm({
      title: 'Rời nhóm này?',
      message: 'Bạn sẽ không còn xuất hiện trong bảng xếp hạng của nhóm này cho tới khi tham gia lại bằng mã mời.',
      confirmText: 'Rời nhóm',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await groupsApi.leave(id);
      toast('Đã rời nhóm', { type: 'success' });
      void fetchGroups();
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || 'Lỗi khi rời nhóm', { type: 'error' });
    }
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setEditName(group.name || '');
    setEditDesc(group.description || '');
    setError('');
  };

  const handleUpdateGroup = async (event) => {
    event.preventDefault();
    if (!editingGroup) return;
    const name = editName.trim();
    if (!name) {
      setError('Tên nhóm không được để trống');
      return;
    }
    try {
      await groupsApi.update(editingGroup.id, { name, description: editDesc.trim() });
      setEditingGroup(null);
      toast('Đã cập nhật nhóm', { type: 'success' });
      void fetchGroups();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Không cập nhật được nhóm');
    }
  };

  const handleDeleteGroup = async (group) => {
    const ok = await confirm({
      title: 'Xóa nhóm này?',
      message: 'Tất cả thành viên sẽ bị gỡ khỏi nhóm. Bảng xếp hạng nhóm này sẽ không còn truy cập được.',
      confirmText: 'Xóa nhóm',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await groupsApi.delete(group.id);
      toast('Đã xóa nhóm', { type: 'success' });
      void fetchGroups();
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || 'Không xóa được nhóm', { type: 'error' });
    }
  };

  const handleKickMember = async (group, member) => {
    const ok = await confirm({
      title: 'Gỡ thành viên khỏi nhóm?',
      message: `${member.name || `User #${member.id}`} sẽ không còn xuất hiện trong nhóm này.`,
      confirmText: 'Gỡ thành viên',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await groupsApi.kick(group.id, member.id);
      toast('Đã gỡ thành viên khỏi nhóm', { type: 'success' });
      void fetchGroups();
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || 'Không gỡ được thành viên', { type: 'error' });
    }
  };

  const copyInviteCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Đã copy mã mời', { type: 'success' });
    } catch {
      toast('Không copy được mã mời trên trình duyệt này', { type: 'error' });
    }
  };

  const contestSize = Number(contestMode[0] || 2);
  const visibleContests = contests;
  const myMemberCode = memberInviteCode(user?.id);

  const resetContestForm = () => {
    setContestMode('2v2');
    setContestName('');
    setContestEndAt(formatDateTimeLocal());
    setTeamA([]);
    setTeamB([]);
    setMemberCode('');
    setError('');
  };

  const openContestModal = () => {
    resetContestForm();
    setShowContest(true);
  };

  const removeContest = async (contestId) => {
    const ok = await confirm({
      title: 'Xóa cuộc thi?',
      message: 'Cuộc thi này sẽ bị xóa khỏi trình duyệt hiện tại.',
      confirmText: 'Xóa',
      tone: 'danger',
    });
    if (!ok) return;
    setContests((prev) => prev.filter((contest) => contest.id !== contestId));
  };

  const addMemberByCode = async (side) => {
    const userId = parseMemberInviteCode(memberCode);
    if (!userId) {
      toast('Mã thành viên không hợp lệ. Ví dụ: WRU-0001', { type: 'error' });
      return;
    }
    const setter = side === 'A' ? setTeamA : setTeamB;
    const other = side === 'A' ? teamB : teamA;
    const current = side === 'A' ? teamA : teamB;
    if (current.some((member) => member.id === userId)) {
      toast(`Người này đã có trong Đội ${side}`, { type: 'error' });
      return;
    }
    if (other.some((member) => member.id === userId)) {
      toast('Một người chỉ được nằm ở một đội', { type: 'error' });
      return;
    }
    if (current.length >= contestSize) {
      toast(`Đội ${side} đã đủ ${contestSize} người`, { type: 'error' });
      return;
    }

    setAddingMember(side);
    try {
      const profileRes = await usersApi.get(userId);
      const profile = profileRes.data || {};
      const baselineActions = Number(profile.competitionSummary?.current_season_score || 0);
      const entry = {
        id: String(profile.id || userId),
        name: profile.name || `User #${userId}`,
        baselineActions,
      };
      setter([...current, entry]);
      setContestStats((prev) => ({ ...prev, [entry.id]: baselineActions }));
      setMemberCode('');
    } catch (err) {
      toast(err.response?.data?.message || 'Không tìm thấy thành viên theo mã này', { type: 'error' });
    } finally {
      setAddingMember('');
    }
  };

  const removeContestMember = (side, userId) => {
    const setter = side === 'A' ? setTeamA : setTeamB;
    const current = side === 'A' ? teamA : teamB;
    setter(current.filter((member) => member.id !== String(userId)));
  };

  const refreshContestScores = async () => {
    const ids = Array.from(new Set(contests.flatMap((contest) => [
      ...contest.teamA.map((member) => member.id),
      ...contest.teamB.map((member) => member.id),
    ])));
    if (!ids.length) return;
    try {
      const entries = await Promise.all(ids.map(async (id) => {
        const res = await usersApi.get(id);
        return [String(id), Number(res.data?.competitionSummary?.current_season_score || 0)];
      }));
      setContestStats((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      toast('Đã cập nhật điểm cuộc thi', { type: 'success' });
    } catch (err) {
      toast(err.response?.data?.message || 'Không cập nhật được điểm cuộc thi', { type: 'error' });
    }
  };


  const createContest = (event) => {
    event.preventDefault();
    setError('');
    if (teamA.length !== contestSize || teamB.length !== contestSize) {
      setError(`Mỗi đội cần đúng ${contestSize} người.`);
      return;
    }
    if (new Date(contestEndAt).getTime() <= Date.now()) {
      setError('Thời gian kết thúc phải ở tương lai.');
      return;
    }

    const contest = {
      id: `contest-${Date.now()}`,
      name: contestName.trim() || `${contestMode.toUpperCase()} theo mã thành viên`,
      mode: contestMode,
      size: contestSize,
      createdAt: new Date().toISOString(),
      endAt: new Date(contestEndAt).toISOString(),
      teamA,
      teamB,
    };
    setContests((prev) => [contest, ...prev]);
    setShowContest(false);
    resetContestForm();
    toast('Đã tạo cuộc thi nhóm', { type: 'success' });
  };

  const contestScore = (members) => members.reduce((sum, member) => {
    const currentActions = contestStats[String(member.id)] ?? Number(member.baselineActions || 0);
    return sum + Math.max(0, Number(currentActions || 0) - Number(member.baselineActions || 0));
  }, 0);

  return (
    <div className="groups-page" style={{ maxWidth: 1000, margin: '0 auto', fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="groups-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.8px', lineHeight: 1.25 }}>
            Nhóm <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Của Tôi</span>
          </h1>
        </div>
        <div className="groups-actions" style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowJoin(true)}
            style={{ ...BUTTON, background: 'rgba(15,23,42,0.08)', color: '#1e293b', border: '1px solid rgba(15,23,42,0.12)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,23,42,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(15,23,42,0.08)'}
          >
            <UserPlus size={15} />
            Tham Gia Nhóm
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{ ...BUTTON, background: 'var(--accent)', color: 'var(--accent-foreground)' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <Plus size={15} />
            Tạo Nhóm Mới
          </button>
        </div>
      </div>

      <section style={{ ...CARD, padding: 20, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#d97706', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
              <Swords size={14} />
              Cuộc thi nhóm · Beta cục bộ
            </div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>Đấu 2v2 hoặc 3v3</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}>
              Dữ liệu cuộc thi hiện lưu trên trình duyệt này; bản đồng bộ backend sẽ được tách riêng ở phase sau.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(217,119,6,0.22)', borderRadius: 'var(--radius-content)', background: 'rgba(217,119,6,0.08)', padding: '8px 10px', color: 'var(--accent-hover)', fontSize: 12, fontWeight: 600 }}>
              Mã của bạn: <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{myMemberCode}</span>
              <button
                type="button"
                onClick={() => copyInviteCode(myMemberCode)}
                aria-label="Copy mã thành viên"
                style={{ border: 0, background: 'transparent', color: 'var(--accent-hover)', cursor: 'pointer', display: 'flex', padding: 0 }}
              >
                <Clipboard size={13} />
              </button>
            </div>
            {contests.length > 0 && (
              <button
                type="button"
                onClick={refreshContestScores}
                style={{ ...BUTTON, background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid rgba(15,23,42,0.12)', padding: '9px 12px' }}
              >
                <RefreshCw size={14} />
                Cập nhật điểm
              </button>
            )}
            <button
              type="button"
              onClick={openContestModal}
              style={{ ...BUTTON, background: '#d97706', color: 'var(--surface)', padding: '9px 12px' }}
            >
              <Swords size={14} />
              Tạo cuộc thi
            </button>
          </div>
        </div>

        {visibleContests.length === 0 ? (
          <div style={{ border: '1px dashed rgba(15,23,42,0.14)', borderRadius: 'var(--radius-content)', padding: 18, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
            Chưa có cuộc thi nào. Hãy nhập mã thành viên để tạo trận 2v2 hoặc 3v3.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {visibleContests.map((contest) => {
              const scoreA = contestScore(contest.teamA);
              const scoreB = contestScore(contest.teamB);
              const ended = new Date(contest.endAt).getTime() <= now.getTime();
              const winner = scoreA === scoreB ? 'Hòa' : scoreA > scoreB ? 'Đội A thắng' : 'Đội B thắng';
              return (
                <div key={contest.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-content)', background: 'var(--surface-soft)', padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ color: ended ? '#16a34a' : '#d97706', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                        {ended ? 'Đã chốt kết quả' : timeLeftLabel(contest.endAt, now)}
                      </div>
                      <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>{contest.name}</h3>
                      <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>
                        {contest.mode.toUpperCase()} · Kết thúc {new Date(contest.endAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Xóa cuộc thi"
                      onClick={() => removeContest(contest.id)}
                      style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['Đội A', contest.teamA, scoreA, 'var(--accent)'],
                      ['Đội B', contest.teamB, scoreB, '#db2777'],
                    ].map(([label, members, score, color]) => (
                      <div key={label} style={{ border: `1px solid ${color === 'var(--accent)' ? 'var(--accent-border)' : 'rgba(219,39,119,0.2)'}`, borderRadius: 'var(--radius-content)', background: 'var(--surface)', padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ color, fontSize: 12, fontWeight: 600 }}>{label}</span>
                          <strong style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{Number(score).toLocaleString()}</strong>
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {members.map((member) => (
                            <span key={member.id} style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{member.name}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {ended && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, color: winner === 'Hòa' ? 'var(--text-secondary)' : '#16a34a', fontSize: 13, fontWeight: 700 }}>
                      <Trophy size={15} />
                      {winner}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Đang tải danh sách nhóm...</div>
      ) : groups.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '60px 24px' }}>
          <Users size={48} color="var(--accent)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Bạn chưa tham gia nhóm nào</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>Hãy bắt đầu bằng cách tạo nhóm mới hoặc nhập mã mời từ bạn bè.</p>
        </div>
      ) : (
        <div className="groups-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {groups.map(g => (
            <div key={g.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-content)',
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: 'var(--surface)'
                }}>
                  {g.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{
                  padding: '4px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-border)', fontSize: 10, fontWeight: 600, color: 'var(--accent)'
                }}>
                  {g.role === 'owner' ? 'CHỦ NHÓM' : 'THÀNH VIÊN'}
                </div>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{g.name}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.55, height: 40, overflow: 'hidden' }}>{g.description || 'Không có mô tả'}</p>
              
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Thành viên</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{g.member_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Mã mời</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', fontFamily: 'monospace' }}>{g.invite_code}</div>
                    <button
                      type="button"
                      aria-label="Copy mã mời"
                      onClick={() => copyInviteCode(g.invite_code)}
                      style={{ border: 'none', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 'var(--radius-interactive)', padding: 5, cursor: 'pointer', display: 'flex' }}
                    >
                      <Clipboard size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {Array.isArray(g.members) && g.members.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: 14, marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Thành viên</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {g.members.slice(0, 6).map((member) => {
                      const isOwnerMember = String(member.id) === String(g.ownerId || g.owner_id);
                      return (
                        <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid rgba(15,23,42,0.08)', background: 'var(--surface-soft)', padding: '8px 10px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name || `User #${member.id}`}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}>{isOwnerMember ? 'Chủ nhóm' : 'Thành viên'}</div>
                          </div>
                          {g.role === 'owner' && !isOwnerMember && (
                            <button
                              type="button"
                              onClick={() => handleKickMember(g, member)}
                              aria-label={`Gỡ ${member.name || `User #${member.id}`}`}
                              style={{ border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: 7, cursor: 'pointer', display: 'flex' }}
                            >
                              <UserMinus size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {g.member_count > g.members.length && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>+{g.member_count - g.members.length} thành viên khác</div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate(`/leaderboard?groupId=${g.id}`)}
                  style={{ ...BUTTON, flex: 1, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-border)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-soft)'}
                >
                  Xem BXH
                </button>
                {g.role === 'owner' && (
                  <>
                    <button
                      onClick={() => openEditGroup(g)}
                      aria-label="Sửa nhóm"
                      style={{ ...BUTTON, padding: '10px', background: 'rgba(15,23,42,0.06)', color: 'var(--text-primary)', border: '1px solid rgba(15,23,42,0.1)' }}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(g)}
                      aria-label="Xóa nhóm"
                      style={{ ...BUTTON, padding: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
                {g.role !== 'owner' && (
                  <button
                    onClick={() => handleLeave(g.id)}
                    style={{ ...BUTTON, padding: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  >
                    Rời
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-group-title" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 overflow-hidden modal-dialog-enter">
            <h2 id="edit-group-title" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px', color: 'var(--text-primary)' }}>Sửa nhóm</h2>
            <form onSubmit={handleUpdateGroup}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Tên nhóm *</label>
                <input
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.12)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Mô tả</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.12)', color: 'var(--text-primary)', height: 80, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setEditingGroup(null)} style={{ ...BUTTON, flex: 1, borderRadius: 8, background: 'rgba(15,23,42,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(15,23,42,0.08)' }}>Hủy</button>
                <button type="submit" style={{ ...BUTTON, flex: 1, borderRadius: 8, background: 'var(--text-primary)', color: 'var(--surface)' }}>Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contest Modal */}
      {showContest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div role="dialog" aria-modal="true" aria-labelledby="create-contest-title" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto p-6 modal-dialog-enter">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div>
                <h2 id="create-contest-title" style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Tạo cuộc thi nhóm</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>Chọn đội, đặt giờ kết thúc, đội có số thao tác tăng thêm cao hơn sẽ thắng.</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setShowContest(false)} style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createContest}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Tên cuộc thi</label>
                  <input
                    value={contestName}
                    onChange={(event) => setContestName(event.target.value)}
                    placeholder="Ví dụ: Sprint chiều nay"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-interactive)', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Chế độ</label>
                  <select
                    value={contestMode}
                    onChange={(event) => setContestMode(event.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-interactive)', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="2v2">2v2</option>
                    <option value="3v3">3v3</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Kết thúc</label>
                  <input
                    type="datetime-local"
                    value={contestEndAt}
                    onChange={(event) => setContestEndAt(event.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-interactive)', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-content)', background: 'var(--accent-soft)', padding: 12, marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--accent-hover)', marginBottom: 7 }}>Nhập mã thành viên</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 8 }}>
                  <input
                    value={memberCode}
                    onChange={(event) => setMemberCode(event.target.value.toUpperCase())}
                    placeholder="Ví dụ: WRU-0001"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-interactive)', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}
                  />
                  <button
                    type="button"
                    onClick={() => addMemberByCode('A')}
                    disabled={addingMember !== ''}
                    style={{ ...BUTTON, background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '9px 12px', opacity: addingMember ? 0.7 : 1 }}
                  >
                    {addingMember === 'A' ? 'Đang thêm...' : 'Thêm A'}
                  </button>
                  <button
                    type="button"
                    onClick={() => addMemberByCode('B')}
                    disabled={addingMember !== ''}
                    style={{ ...BUTTON, background: '#db2777', color: 'var(--surface)', padding: '9px 12px', opacity: addingMember ? 0.7 : 1 }}
                  >
                    {addingMember === 'B' ? 'Đang thêm...' : 'Thêm B'}
                  </button>
                </div>
                <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>
                  Người chơi gửi mã cá nhân của họ. Mã của bạn: <span style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono',monospace" }}>{myMemberCode}</span>.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  ['A', teamA, 'var(--accent)'],
                  ['B', teamB, '#db2777'],
                ].map(([side, members, color]) => (
                  <div key={side} style={{ border: `1px solid ${color === 'var(--accent)' ? 'var(--accent-border)' : 'rgba(219,39,119,0.2)'}`, borderRadius: 'var(--radius-content)', padding: 12, background: 'var(--surface-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ color, fontSize: 13, fontWeight: 600 }}>Đội {side}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{members.length}/{contestSize}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 74 }}>
                      {members.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>Chưa chọn thành viên</span>
                      ) : members.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => removeContestMember(side, member.id)}
                          style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-interactive)', background: 'var(--surface)', color: 'var(--text-primary)', padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                        >
                          {member.name}
                          <X size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setShowContest(false)} style={{ ...BUTTON, flex: 1, background: 'rgba(15,23,42,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(15,23,42,0.08)' }}>Hủy</button>
                <button type="submit" style={{ ...BUTTON, flex: 1, background: '#d97706', color: 'var(--surface)' }}>
                  <Swords size={15} />
                  Tạo trận {contestMode.toUpperCase()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div role="dialog" aria-modal="true" aria-labelledby="create-group-title" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 overflow-hidden modal-dialog-enter">
            <h2 id="create-group-title" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px', color: 'var(--text-primary)' }}>Tạo Nhóm Mới</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Tên nhóm *</label>
                <input
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.12)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Mô tả</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.12)', color: 'var(--text-primary)', height: 80, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ ...BUTTON, flex: 1, borderRadius: 8, background: 'rgba(15,23,42,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(15,23,42,0.08)' }}>Hủy</button>
                <button type="submit" style={{ ...BUTTON, flex: 1, borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-foreground)' }}>Tạo Nhóm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div role="dialog" aria-modal="true" aria-labelledby="join-group-title" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 overflow-hidden modal-dialog-enter">
            <h2 id="join-group-title" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px', color: 'var(--text-primary)' }}>Tham Gia Nhóm</h2>
            <form onSubmit={handleJoin}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Mã mời (Invite Code)</label>
                <input
                  required
                  placeholder="Ví dụ: WR-XXXXXX"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.12)', color: 'var(--text-primary)', textAlign: 'center', fontSize: 18, fontWeight: 600, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setShowJoin(false)} style={{ ...BUTTON, flex: 1, borderRadius: 8, background: 'rgba(15,23,42,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(15,23,42,0.08)' }}>Hủy</button>
                <button type="submit" style={{ ...BUTTON, flex: 1, borderRadius: 8, background: '#22c55e', color: 'var(--surface)' }}>Tham Gia</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
