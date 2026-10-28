import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  Loader2,
  LogOut,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import usePublicSpotlight from '../hooks/usePublicSpotlight';
import { RecognitionStatus, SpotlightFeedback, displayScore, recognitionState, removeVietnameseDiacritics } from '../components/PublicRecognition';
import RecognitionPortraitFrame from '../components/RecognitionPortraitFrame';
import { Reveal } from '../components/ui';
import { auth } from '../services/api';
import { useAuth } from '../context/AuthContext';

function MvpVisualAward({ data, loading, error, retry }) {
  const mvp = data?.mvp;
  const team = data?.championTeam;
  const type = mvp ? 'mvp' : 'champion';
  const championState = recognitionState(data, 'champion');
  const mvpState = recognitionState(data, 'mvp');
  const state = type === 'mvp' ? mvpState : championState;
  const rawName = type === 'mvp' ? mvp?.name : team?.teamName;
  const name = removeVietnameseDiacritics(rawName);
  return (
    <Reveal as="aside" delay={200} className="public-auth-recognition" aria-label="Ghi nhận mùa giải" aria-busy={loading}>
      <Link to="/" className="public-editorial-brand" aria-label="WorkRank — Trang chủ">
        <BrandMark size={28} showLabel={false} /><span>WORKRANK<small>3WIN MEDIA</small></span>
      </Link>
      <div className="public-auth-editorial-heading">
        <h2>Người được vinh danh</h2>
        <p>{data?.season?.name || (loading ? 'Đang tải mùa giải…' : error ? 'Chưa tải được mùa giải' : 'Chưa có mùa giải công bố')}</p>
      </div>
      <SpotlightFeedback loading={loading} error={error} retry={retry} />
      <RecognitionPortraitFrame key={`${type}-${data?.season?.id || 'none'}-${name || 'none'}`} type={type} record={type === 'mvp' ? mvp : team} loading={loading} />
      <div className="public-auth-person">
        <div><span className="public-editorial-kicker">{type === 'mvp' ? 'CÁ NHÂN NỔI BẬT' : 'ĐỘI NHÓM NỔI BẬT'}</span><h3>{name || (loading ? 'Đang tải…' : 'Chờ ghi nhận tiếp theo')}</h3><RecognitionStatus state={state} type={type} /></div>
        {(mvp || team) && <p className="public-auth-score"><strong>{displayScore(type === 'mvp' ? mvp?.score : team?.seasonScore)}</strong><span>Điểm mùa giải</span></p>}
      </div>
      {mvp?.reason && <p className="public-auth-reason">{mvp.reason}</p>}
      <Link className="public-editorial-link" to="/">Khám phá vinh danh <ArrowRight size={17} /></Link>
    </Reveal>
  );
}

function GoogleMark() {
  return <img src="/google-g-logo.png" alt="" aria-hidden="true" width="20" height="20" />;
}

function safeInternalPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value) || value.length > 2048) return '/dashboard';
  try {
    const url = new URL(value, 'https://workrank.invalid');
    return url.origin === 'https://workrank.invalid' ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

const GOOGLE_ERRORS = {
  cancelled: 'Bạn đã hủy đăng nhập Google. Hãy thử lại khi sẵn sàng.',
  not_configured: 'Đăng nhập Google chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
  invalid_state: 'Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.',
  google_failed: 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.',
  account_locked: 'Tài khoản WorkRank đã bị khóa. Vui lòng liên hệ quản trị viên.',
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, logout } = useAuth();
  const spotlight = usePublicSpotlight();
  const ticketRef = useRef(null);
  const passwordRef = useRef(null);
  const [busy, setBusy] = useState(location.pathname === '/auth/google/callback');
  const [error, setError] = useState('');
  const [linkTicket, setLinkTicket] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [password, setPassword] = useState('');

  const query = new URLSearchParams(location.search);
  const from = location.state?.from;
  const intendedPath = safeInternalPath(query.get('returnTo') || (from?.pathname ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/dashboard'));

  useEffect(() => {
    const authError = new URLSearchParams(location.search).get('authError');
    if (authError) setError(GOOGLE_ERRORS[authError] || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    if (location.pathname !== '/auth/google/callback') return;

    const ticket = new URLSearchParams(location.hash.slice(1)).get('ticket');
    if (!ticket) {
      setBusy(false);
      setError('Không tìm thấy phiên đăng nhập Google. Vui lòng thử lại.');
      return;
    }
    if (ticketRef.current === ticket) return;
    ticketRef.current = ticket;
    window.history.replaceState(window.history.state, '', `${location.pathname}${location.search}`);
    setBusy(true);
    auth.exchangeGoogleTicket(ticket).then((response) => {
      if (response.data?.linkRequired) {
        setLinkTicket(response.data.linkTicket);
        setLinkEmail(response.data.email || '');
      } else {
        setUser(response.data.user);
        navigate(safeInternalPath(response.data.redirectTo), { replace: true });
      }
    }).catch((err) => {
      setError(err.response?.data?.message || 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.');
    }).finally(() => setBusy(false));
  }, [location.hash, location.pathname, location.search, navigate, setUser]);

  useEffect(() => {
    if (linkTicket && !busy) passwordRef.current?.focus();
  }, [linkTicket, busy]);

  const startGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await auth.checkGoogleAvailability();
      window.location.assign(auth.googleStartUrl(intendedPath));
    } catch (err) {
      setBusy(false);
      setError(err.response?.data?.message || 'Không thể kết nối tới WorkRank. Hãy kiểm tra mạng rồi thử lại.');
    }
  };

  const linkGoogle = async (event) => {
    event.preventDefault();
    if (busy || !linkTicket) return;
    setBusy(true);
    setError('');
    try {
      const response = await auth.linkGoogleAccount(linkTicket, password);
      setPassword('');
      setUser(response.data.user);
      navigate(safeInternalPath(response.data.redirectTo), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể liên kết tài khoản. Hãy kiểm tra mật khẩu rồi thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page-wrapper public-auth-page">
      <div className="public-auth-shell">
        <Reveal delay={0} className="public-auth-form-panel">
          <Link className="public-auth-mobile-brand public-editorial-brand" to="/" aria-label="WorkRank — Trang chủ">
            <BrandMark size={28} showLabel={false} /><span>WORKRANK<small>3WIN MEDIA</small></span>
          </Link>
          <div className="public-auth-form-heading google-auth-heading">
            <h1>{linkTicket ? 'Liên kết tài khoản WorkRank' : 'Chào mừng đến WorkRank.'}</h1>
            <p>{linkTicket ? 'Xác minh tài khoản hiện có để giữ nguyên dữ liệu và quyền truy cập.' : 'Đăng nhập nhanh và an toàn bằng tài khoản Google.'}</p>
          </div>

          {user && !linkTicket && <div className="google-auth-session">
            <div className="google-auth-session-copy"><CheckCircle2 size={18} /><span>Đang đăng nhập với <strong>{user.name}</strong> ({user.email})</span></div>
            <div className="google-auth-session-actions">
              <button className="google-auth-secondary" type="button" onClick={() => navigate('/dashboard')}><ArrowRight size={15} /> Mở Dashboard</button>
              <button className="google-auth-logout" type="button" onClick={() => logout()}><LogOut size={15} /> Đăng xuất</button>
            </div>
          </div>}

          <div className="google-auth-feedback-slot" aria-live="polite">
            {error && <div className="google-auth-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
            {busy && !linkTicket && <div className="google-auth-pending" role="status"><Loader2 className="google-auth-spinner" size={19} /> Đang xác minh với Google…</div>}
          </div>

          {linkTicket ? <form className="google-auth-link-form" onSubmit={linkGoogle}>
            <div className="google-auth-link-explainer"><Lock size={17} /><span>Email <strong>{linkEmail}</strong> đã có tài khoản WorkRank. Nhập mật khẩu WorkRank cũ để xác minh quyền sở hữu và liên kết Google.</span></div>
            <label htmlFor="google-link-password">Mật khẩu WorkRank hiện tại</label>
            <input id="google-link-password" ref={passwordRef} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
            <button className="google-auth-button" type="submit" disabled={busy || !password}>{busy ? <Loader2 className="google-auth-spinner" size={19} /> : <Lock size={19} />} Xác minh và liên kết</button>
            <p className="google-auth-help">Chỉ liên kết sau khi mật khẩu được xác minh. Nếu quên mật khẩu, liên hệ quản trị viên WorkRank.</p>
            <button className="google-auth-restart" type="button" disabled={busy} onClick={() => { setLinkTicket(''); setPassword(''); navigate('/login', { replace: true }); }}>Dùng tài khoản Google khác</button>
          </form> : <div className="google-auth-actions">
            <button className="google-auth-button" type="button" onClick={startGoogle} disabled={busy} aria-label="Tiếp tục với Google">
              {busy ? <Loader2 className="google-auth-spinner" size={20} /> : <GoogleMark />}<span>{busy ? 'Đang đăng nhập…' : 'Tiếp tục với Google'}</span>
            </button>
            <p className="google-auth-caption">Bạn sẽ được chuyển tới Google để chọn tài khoản.</p>
          </div>}
          <div className="google-auth-footer"><span>Tiếp tục đồng nghĩa với việc sử dụng tài khoản Google để truy cập WorkRank.</span><Link to="/">Về trang chủ</Link></div>
        </Reveal>
        <MvpVisualAward {...spotlight} />
      </div>
    </main>
  );
}
