import React, { useCallback, useEffect, useState } from 'react';
import { security } from '../services/api';

const card = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 10, padding: 18 };
const muted = { color: '#64748b', fontSize: 12, fontWeight: 600 };
const value = { color: '#0f172a', fontSize: 28, fontWeight: 800, marginTop: 8 };

function FlagList({ flags = {} }) {
  const rows = Object.entries(flags).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <div style={muted}>Không có flag nghi vấn.</div>;
  return rows.map(([flag, count]) => (
    <div key={flag} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
      <span style={{ color: '#475569', fontSize: 13 }}>{flag}</span>
      <span style={{ color: '#f87171', fontWeight: 800 }}>{count}</span>
    </div>
  ));
}

export default function Security() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anomalies, setAnomalies] = useState(null);
  const [devices, setDevices] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [a, d] = await Promise.all([security.anomalies(1), security.devices(true)]);
      setAnomalies(a.data);
      setDevices(d.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không tải được dữ liệu bảo mật');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleDevice = async (device) => {
    if (device.revokedAt) await security.restoreDevice(device.id);
    else await security.revokeDevice(device.id);
    await load();
  };

  if (loading) return <div style={{ color: '#64748b' }}>Đang tải security dashboard...</div>;
  if (error) return <div style={{ color: '#f87171' }}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, color: '#0f172a' }}>Security & Anti-cheat</h1>
        <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>Theo dõi anomaly, device secret, revoke/restore thiết bị nghi vấn.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <div style={card}><div style={muted}>Tổng events</div><div style={value}>{anomalies.totalEvents}</div></div>
        <div style={card}><div style={muted}>Events bị flag</div><div style={{ ...value, color: '#f87171' }}>{anomalies.flaggedEvents}</div></div>
        <div style={card}><div style={muted}>Điểm nghi vấn TB</div><div style={value}>{anomalies.averageSuspicionScore}</div></div>
        <div style={card}><div style={muted}>Khoảng thời gian</div><div style={value}>{anomalies.windowDays} ngày</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: 16 }}>Flag breakdown</h2>
          <FlagList flags={anomalies.flagCounts} />
        </div>

        <div style={card}>
          <h2 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: 16 }}>Device management</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>Device</th>
                  <th style={{ padding: '10px 8px' }}>User</th>
                  <th style={{ padding: '10px 8px' }}>Last sync</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                    <td style={{ padding: '10px 8px', color: '#1e293b' }}>{device.deviceName}<div style={{ color: '#64748b', fontSize: 11 }}>{device.deviceUuid}</div></td>
                    <td style={{ padding: '10px 8px', color: '#334155' }}>{device.User?.email || '—'}</td>
                    <td style={{ padding: '10px 8px', color: '#64748b' }}>{device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : '—'}</td>
                    <td style={{ padding: '10px 8px' }}><span style={{ color: device.revokedAt ? '#f87171' : '#22c55e', fontWeight: 800 }}>{device.revokedAt ? 'Revoked' : 'Active'}</span></td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <button onClick={() => toggleDevice(device)} style={{ background: device.revokedAt ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', fontWeight: 800 }}>
                        {device.revokedAt ? 'Restore' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
