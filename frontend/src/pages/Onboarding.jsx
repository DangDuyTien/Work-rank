import React, { useMemo, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Check, Loader2, RotateCcw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import JobTitleBadge, { CATEGORIZED_DEPARTMENTS, JOB_TITLE_CONFIG, OFFICIAL_JOB_TITLES } from '../components/JobTitleBadge';
import { auth } from '../services/api';
import { Reveal } from '../components/ui';

function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  try {
    const url = new URL(value, 'https://workrank.invalid');
    return url.origin === 'https://workrank.invalid' && url.pathname !== '/onboarding'
      ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
  } catch { return '/dashboard'; }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const returnTo = safeReturnPath(params.get('returnTo') || location.state?.from?.pathname || '/dashboard');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle && user.jobTitle !== 'Nhân viên' ? user.jobTitle : '');
  const [department, setDepartment] = useState(user?.department || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!jobTitle || !department) {
      setError('Vui lòng chọn chức danh và phòng ban để tiếp tục.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await auth.updateProfile({ jobTitle, department });
      setUser(response.data.user || response.data);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ. Vui lòng thử lại.');
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <main className="onboarding-page">
      <Reveal className="onboarding-shell" delay={0}>
        <div className="onboarding-mark" aria-hidden="true"><BriefcaseBusiness size={22} /></div>
        <p className="onboarding-kicker">BƯỚC ĐẦU TIÊN</p>
        <h1>Hoàn thiện hồ sơ để bắt đầu</h1>
        <p className="onboarding-intro">Chọn chức danh và phòng ban để đồng nghiệp nhận diện vai trò của bạn trên WorkRank.</p>
        <form onSubmit={submit} noValidate>
          <fieldset disabled={busy}>
            <legend>Chức danh công tác</legend>
            <div className="onboarding-role-grid" role="radiogroup" aria-label="Chọn chức danh">
              {OFFICIAL_JOB_TITLES.map((title) => {
                const config = JOB_TITLE_CONFIG[Object.keys(JOB_TITLE_CONFIG).find((key) => JOB_TITLE_CONFIG[key].label === title)];
                const selected = jobTitle === title;
                return (
                  <label key={title} className={`onboarding-role-card${selected ? ' is-selected' : ''}`}>
                    <input type="radio" name="jobTitle" value={title} checked={selected} onChange={() => setJobTitle(title)} />
                    <JobTitleBadge jobTitle={title} size="sm" />
                    <span>{config?.description}</span>
                    {selected && <Check size={16} aria-hidden="true" />}
                  </label>
                );
              })}
            </div>
            <label className="onboarding-field" htmlFor="onboarding-department">
              <span>Phòng ban</span>
              <select id="onboarding-department" value={department} onChange={(event) => setDepartment(event.target.value)} required>
                <option value="">Chọn phòng ban</option>
                {CATEGORIZED_DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </fieldset>
          <div className="onboarding-feedback" aria-live="polite">
            {error && <div className="onboarding-error" role="alert"><RotateCcw size={16} />{error}</div>}
          </div>
          <button className="onboarding-submit" type="submit" disabled={busy || !jobTitle || !department}>
            {busy ? <><Loader2 size={18} className="onboarding-spinner" /> Đang lưu hồ sơ…</> : <>Tiếp tục vào WorkRank <ArrowRight size={18} /></>}
          </button>
        </form>
        <p className="onboarding-note">Bạn có thể cập nhật thông tin này sau trong Cài đặt.</p>
      </Reveal>
    </main>
  );
}
