import React from 'react';
import { BookOpen, Flag, Building, Sparkles, CreditCard, Gift, Trophy, Clock, Skull, CheckCircle2 } from 'lucide-react';
import { AnimatedModal } from '../ui';

export default function GameRulesModal({ isOpen = true, onClose }) {
  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Luật Chơi Cờ Tỷ Phú WorkRank"
      maxWidth={640}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
        }}
      >
        {/* Rule item 1 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(34,197,94,0.1)',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Flag size={18} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>1. Khởi Đầu & Tiền Thưởng Vòng</strong>
            <p style={{ margin: '4px 0 0' }}>
              Mỗi người chơi bắt đầu trận đấu với <strong>$1,500 tiền mặt</strong>. Khi đi qua hoặc dừng lại ở ô <strong>Khởi Hành</strong>, bạn nhận ngay <strong>+$200 thưởng vòng</strong>.
            </p>
          </div>
        </div>

        {/* Rule item 2 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--info-soft)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Building size={18} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>2. Mua Bất Động Sản & Thu Tiền Thuê</strong>
            <p style={{ margin: '4px 0 0' }}>
              Bàn cờ có 18 ô bất động sản thuộc 6 nhóm màu (Media Hub, Công Nghệ, Hậu Cần, Sinh Thái, Tài Chính, Trung Tâm).
              Khi dừng ở ô đất trống, bạn có thể chi tiền mua sở hữu. Khi đối thủ dừng lại trên đất của bạn, hệ thống sẽ tự động thu tiền thuê từ đối thủ và chuyển cho bạn.
            </p>
          </div>
        </div>

        {/* Rule item 3 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(168,85,247,0.1)',
              color: '#9333ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>3. Ô Cơ Hội, Thuế & Kho Báu</strong>
            <p style={{ margin: '4px 0 0' }}>
              • <strong>Ô Cơ Hội</strong>: Rút ngẫu nhiên thẻ sự kiện bất ngờ (hợp đồng tài trợ, viral top 1, bảo trì máy chủ...).
              <br />• <strong>Ô Thuế & Phí</strong>: Đóng phí dịch vụ / thuế doanh nghiệp ($80 - $100).
              <br />• <strong>Kho Báu Doanh Nghiệp</strong>: Nhận thưởng nóng dự án (+$100 - +$150).
            </p>
          </div>
        </div>

        {/* Rule item 4 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Skull size={18} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>4. Phá Sản & Điều Kiện Thắng</strong>
            <p style={{ margin: '4px 0 0' }}>
              Nếu bạn không đủ tiền mặt để thanh toán tiền thuê hoặc thuế, bạn sẽ bị <strong>Phá Sản</strong> và rời khỏi ván đấu. Toàn bộ tài sản được trả về đất trống. Người chơi còn lại cuối cùng hoặc người có <strong>Tổng Tài Sản</strong> cao nhất khi hết số lượt sẽ giành ngôi vị <strong>Quán Quân</strong>!
            </p>
          </div>
        </div>

        {/* Rule item 5 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(234,179,8,0.15)',
              color: '#ca8a04',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trophy size={18} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>5. Phần Thưởng Career Money & BXH</strong>
            <p style={{ margin: '4px 0 0' }}>
              Kết thúc trận đấu, người chơi nhận phần thưởng Career Money (Hạng 1: +1,000$, Hạng 2: +600$, Hạng 3: +300$, Hạng 4: +150$) tích lũy vào Bảng Xếp Hạng Cờ Tỷ Phú WorkRank.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--text-primary)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={15} />
            <span>Đã Hiểu</span>
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
