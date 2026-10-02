import React from 'react';
import { BookOpen, Flag, Building, Sparkles, CreditCard, Gift, Trophy, Clock, Skull, X } from 'lucide-react';

export default function GameRulesModal({ onClose }) {
  return (
    <div
      className="modal-backdrop-enter"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="modal-dialog-enter"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid rgba(15,23,42,0.15)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(56,189,248,0.2)',
                border: '1.5px solid #38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <BookOpen size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25, margin: 0 }}>Luật Chơi Cờ Tỷ Phú 3winmedia</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Phiên bản Capital Board V1</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Rules Content */}
        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontSize: 13,
            lineHeight: 1.6,
            color: '#334155',
          }}
        >
          {/* Rule item 1 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(34,197,94,0.1)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Flag size={16} />
            </div>
            <div>
              <strong style={{ color: '#0f172a', fontSize: 14 }}>1. Tiền Khởi Điểm & Vòng Bàn Cờ</strong>
              <p style={{ margin: '4px 0 0' }}>
                Mỗi người chơi bắt đầu trận đấu với <strong>$1,500 tiền mặt</strong>. Khi hoàn thành 1 vòng quanh 28 ô và đi qua
                hoặc dừng lại ở ô <strong>Khởi Hành</strong>, bạn nhận ngay <strong>+$200 thưởng vòng</strong>.
              </p>
            </div>
          </div>

          {/* Rule item 2 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(56,189,248,0.1)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Building size={16} />
            </div>
            <div>
              <strong style={{ color: '#0f172a', fontSize: 14 }}>2. Mua Bất Động Sản & Thu Tiền Thuê</strong>
              <p style={{ margin: '4px 0 0' }}>
                Bàn cờ có 18 ô bất động sản thuộc 6 nhóm màu (Media Hub, Công Nghệ, Hậu Cần, Sinh Thái, Tài Chính, Trung Tâm).
                Khi dừng ở ô đất trống, bạn có thể chi tiền mua sở hữu. Khi đối thủ dừng lại trên đất của bạn, họ phải{' '}
                <strong>trả tiền thuê tự động</strong> cho bạn.
              </p>
            </div>
          </div>

          {/* Rule item 3 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(168,85,247,0.1)',
                color: '#9333ea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <strong style={{ color: '#0f172a', fontSize: 14 }}>3. Ô Cơ Hội, Thuế & Kho Báu</strong>
              <p style={{ margin: '4px 0 0' }}>
                • <strong>Ô Cơ Hội</strong>: Rút ngẫu nhiên thẻ sự kiện bất ngờ (hợp đồng tài trợ, viral top 1, bảo trì máy chủ...).
                <br />• <strong>Ô Thuế & Phí</strong>: Đóng phí dịch vụ / thuế doanh nghiệp ($80 - $100).
                <br />• <strong>Kho Báu & Thưởng</strong>: Nhận thưởng dự án ngay lập tức (+$100 - +$150).
              </p>
            </div>
          </div>

          {/* Rule item 4 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Skull size={16} />
            </div>
            <div>
              <strong style={{ color: '#0f172a', fontSize: 14 }}>4. Phá Sản & Điều Kiện Thắng</strong>
              <p style={{ margin: '4px 0 0' }}>
                Nếu bạn không đủ tiền mặt để trả tiền thuê hoặc thuế, bạn sẽ bị <strong>Phá Sản</strong> và toàn bộ tài sản được giải
                phóng về đất trống. Người chơi còn lại cuối cùng hoặc người có <strong>Tổng Tài Sản</strong> cao nhất khi hết số lượt
                sẽ giành ngôi vị <strong>Quán Quân</strong>!
              </p>
            </div>
          </div>

          {/* Rule item 5 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(234,179,8,0.15)',
                color: '#ca8a04',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Trophy size={16} />
            </div>
            <div>
              <strong style={{ color: '#0f172a', fontSize: 14 }}>5. Phần Thưởng Career Money & BXH</strong>
              <p style={{ margin: '4px 0 0' }}>
                Kết thúc trận đấu, người chơi nhận phần thưởng Career Money (Hạng 1: +1,000$, Hạng 2: +600$, Hạng 3: +300$, Hạng 4: +150$)
                được ghi nhận vào Bảng Xếp Hạng Cờ Tỷ Phú 3winmedia.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(15,23,42,0.02)',
            borderTop: '1px solid rgba(15,23,42,0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
