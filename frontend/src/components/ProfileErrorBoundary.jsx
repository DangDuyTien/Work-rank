import React from 'react';

export default class ProfileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ProfileErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>
            Đã xảy ra lỗi hiển thị hồ sơ
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
            Vui lòng tải lại trang hoặc quay lại sau.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ minHeight: 36, border: '1px solid rgba(239,68,68,0.2)', borderRadius: 0, background: 'rgba(239,68,68,0.06)', color: '#ef4444', padding: '0 16px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
