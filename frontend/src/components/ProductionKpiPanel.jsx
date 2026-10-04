import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, History, Layers, RefreshCw, Upload } from 'lucide-react';
import { kpiApi } from '../services/api';

function apiMessage(error, fallback) {
  return error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || fallback;
}

const panelStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
};

export default function ProductionKpiPanel({ onNotice = () => {} }) {
  const [versions, setVersions] = useState([]);
  const [history, setHistory] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [version, setVersion] = useState('');
  const [activationVersion, setActivationVersion] = useState('');
  const [activationRole, setActivationRole] = useState('ALL');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [versionsRes, historyRes] = await Promise.all([
        kpiApi.getProductionVersions(),
        kpiApi.getProductionHistory({ limit: 30 }),
      ]);
      const nextVersions = versionsRes?.data || [];
      setVersions(nextVersions);
      setHistory(historyRes?.data || []);
      setActivationVersion((current) => current || nextVersions.find((item) => item.active)?.version || nextVersions[0]?.version || '');
    } catch (err) {
      setError(apiMessage(err, 'Không thể tải phiên bản Production KPI'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const previewRows = useMemo(() => preview?.parsedRules || [], [preview]);

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setError('');
    try {
      const result = await kpiApi.previewProductionExcel(file);
      setPreview(result);
      if (!version) setVersion(file.name.replace(/\.(xlsx|xls)$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48));
    } catch (err) {
      setError(apiMessage(err, 'Không thể preview file Excel'));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview?.success || !version.trim()) return;
    setImporting(true);
    setError('');
    try {
      await kpiApi.importProductionExcel(file, { version: version.trim(), autoActivate: false });
      onNotice(`Đã lưu phiên bản KPI ${version.trim()} ở trạng thái bản nháp.`);
      setFile(null);
      setPreview(null);
      setVersion('');
      await loadData();
    } catch (err) {
      setError(apiMessage(err, 'Không thể import phiên bản KPI'));
    } finally {
      setImporting(false);
    }
  };

  const handleActivate = async () => {
    if (!activationVersion || !reason.trim()) return;
    setActivating(true);
    setError('');
    try {
      await kpiApi.activateProductionVersion({
        version: activationVersion,
        role: activationRole,
        reason: reason.trim(),
      });
      onNotice(`Đã kích hoạt phiên bản KPI ${activationVersion}.`);
      setReason('');
      await loadData();
    } catch (err) {
      setError(apiMessage(err, 'Không thể kích hoạt phiên bản KPI'));
    } finally {
      setActivating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...panelStyle, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f766e', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
              <FileSpreadsheet size={15} /> Production KPI
            </div>
            <h2 style={{ margin: '6px 0 4px', fontSize: 18, color: '#0f172a' }}>Import benchmark và kiểm soát phiên bản</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              Preview trước, lưu bản nháp, sau đó kích hoạt riêng với lý do audit.
            </p>
          </div>
          <button type="button" onClick={loadData} disabled={loading} title="Làm mới phiên bản và history" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1px solid #cbd5e1', background: '#ffffff', borderRadius: 4, color: '#334155', cursor: loading ? 'wait' : 'pointer', fontSize: 12 }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
          </button>
        </div>

        {error && <div role="alert" style={{ marginTop: 14, padding: '9px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}><AlertCircle size={15} /> {error}</div>}

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px auto', gap: 10, alignItems: 'end' }}>
          <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
            File Excel (.xlsx / .xls)
            <input type="file" accept=".xlsx,.xls" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} style={{ display: 'block', width: '100%', marginTop: 6, fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
            Version draft
            <input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="v_editor_q4_2026" style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 9px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }} />
          </label>
          <button type="button" onClick={handlePreview} disabled={!file || previewing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: 0, borderRadius: 4, background: !file || previewing ? '#cbd5e1' : '#0f766e', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: !file || previewing ? 'not-allowed' : 'pointer' }}>
            <Upload size={14} /> {previewing ? 'Đang đọc...' : 'Preview'}
          </button>
        </div>

        {preview && (
          <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
              <span><strong>{preview.totalParsed || 0}</strong> rule đọc được</span>
              <span><strong>{preview.sheets?.length || 0}</strong> sheet</span>
              <span style={{ color: preview.errors?.length ? '#b91c1c' : '#15803d' }}><strong>{preview.errors?.length || 0}</strong> lỗi</span>
              <span style={{ color: '#b45309' }}><strong>{preview.warnings?.length || 0}</strong> cảnh báo</span>
            </div>
            {(preview.errors?.length > 0 || preview.warnings?.length > 0) && <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
              {preview.errors?.length > 0 && <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', fontSize: 11, lineHeight: 1.5 }}><strong>Lỗi cần xử lý</strong>{preview.errors.slice(0, 8).map((item) => <div key={item}>{item}</div>)}</div>}
              {preview.warnings?.length > 0 && <div style={{ padding: 10, background: '#fffbeb', color: '#92400e', fontSize: 11, lineHeight: 1.5 }}><strong>Cảnh báo</strong>{preview.warnings.slice(0, 8).map((item) => <div key={item}>{item}</div>)}</div>}
            </div>}
            <div style={{ marginTop: 12, maxHeight: 220, overflow: 'auto', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={{ padding: 8 }}>Role</th><th style={{ padding: 8 }}>Task</th><th style={{ padding: 8 }}>Benchmark</th><th style={{ padding: 8 }}>Nguồn</th></tr></thead>
                <tbody>{previewRows.slice(0, 40).map((row) => <tr key={`${row.sourceSheetName}-${row.sourceRowIndex}`} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: 8 }}>{row.role}</td><td style={{ padding: 8 }}>{row.taskType}</td><td style={{ padding: 8 }}>{row.standardTime} {row.unit}</td><td style={{ padding: 8 }}>{row.sourceSheetName} : {row.sourceRowIndex}</td></tr>)}</tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={handleImport} disabled={!preview.success || !version.trim() || importing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: 0, borderRadius: 4, background: !preview.success || !version.trim() || importing ? '#cbd5e1' : '#111827', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: !preview.success || !version.trim() || importing ? 'not-allowed' : 'pointer' }}>
                <Layers size={14} /> {importing ? 'Đang lưu...' : 'Lưu bản nháp'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontSize: 13, fontWeight: 700 }}><CheckCircle2 size={16} color="#0f766e" /> Kích hoạt có kiểm soát</div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px minmax(0,1fr) auto', gap: 10, alignItems: 'end' }}>
          <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Phiên bản<select value={activationVersion} onChange={(event) => setActivationVersion(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 9px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}>{versions.map((item) => <option key={item.version} value={item.version}>{item.version} · {item.rulesCount} rules {item.active ? '· ACTIVE' : ''}</option>)}</select></label>
          <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Role<select value={activationRole} onChange={(event) => setActivationRole(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 9px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}><option value="ALL">ALL</option><option value="EDITOR">EDITOR</option><option value="CONTENT">CONTENT</option></select></label>
          <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Lý do audit<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Biên bản phê duyệt phiên bản" style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 9px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }} /></label>
          <button type="button" onClick={handleActivate} disabled={!activationVersion || !reason.trim() || activating} style={{ padding: '8px 12px', border: 0, borderRadius: 4, background: !activationVersion || !reason.trim() || activating ? '#cbd5e1' : '#b45309', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: !activationVersion || !reason.trim() || activating ? 'not-allowed' : 'pointer' }}>{activating ? 'Đang kích hoạt...' : 'Kích hoạt'}</button>
        </div>
      </div>

      <div style={{ ...panelStyle, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#334155' }}><History size={16} /> Production KPI history</div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 11 }}><thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={{ padding: 10 }}>Thời gian</th><th style={{ padding: 10 }}>User</th><th style={{ padding: 10 }}>Role</th><th style={{ padding: 10 }}>Task</th><th style={{ padding: 10 }}>Version</th><th style={{ padding: 10 }}>Status</th></tr></thead><tbody>{history.length === 0 ? <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>Chưa có execution snapshot.</td></tr> : history.map((row) => <tr key={row.id} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: 10, whiteSpace: 'nowrap' }}>{row.createdAt ? new Date(row.createdAt).toLocaleString('vi-VN') : '—'}</td><td style={{ padding: 10 }}>{row.userId || '—'}</td><td style={{ padding: 10 }}>{row.role || '—'}</td><td style={{ padding: 10 }}>{row.taskType || '—'}</td><td style={{ padding: 10 }}>{row.version || row.ruleVersion || '—'}</td><td style={{ padding: 10 }}>{row.status || '—'}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}
