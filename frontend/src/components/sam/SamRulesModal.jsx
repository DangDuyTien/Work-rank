import React from 'react';
import { Club, ShieldCheck, Flame, Zap, Award } from 'lucide-react';
import { AnimatedModal, Button } from '../ui';

export default function SamRulesModal({ isOpen, onClose }) {
  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Luật Chơi Sâm Lốc WorkRank"
      maxWidth={640}
      actions={
        <Button variant="primary" onClick={onClose} style={{ background: '#b45309', borderColor: '#b45309' }}>
          Đã hiểu
        </Button>
      }
    >
      <div style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Club size={16} color="#b45309" /> 1. Bộ bài và Độ mạnh quân bài
        </h3>
        <p style={{ margin: '0 0 12px' }}>
          Sử dụng bộ bài 52 lá tiêu chuẩn. Độ mạnh quân bài tăng dần:
          <br />
          <strong>3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; 2</strong>
          <br />
          Trong Sâm Lốc, <strong>không phân biệt chất bài</strong> (♠, ♣, ♦, ♥ chặn ngang nhau). Muốn chặn phải có quân cùng loại mang rank lớn hơn.
        </p>

        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={16} color="var(--info)" /> 2. Các bộ bài hợp lệ
        </h3>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
          <li><strong>Rác (1 lá):</strong> Quân bài lẻ bất kỳ.</li>
          <li><strong>Đôi (2 lá):</strong> 2 lá cùng rank (ví dụ đôi 7, đôi K).</li>
          <li><strong>Sám (3 lá):</strong> 3 lá cùng rank (ví dụ ba quân J).</li>
          <li><strong>Tứ quý (4 lá):</strong> 4 lá cùng rank. <em>Tứ quý chặt được 1 con 2 và chặt Tứ quý nhỏ hơn!</em></li>
          <li><strong>Sảnh (từ 3 lá trở lên):</strong> Các lá bài có rank liên tiếp. Sảnh nhỏ nhất là <strong>A-2-3</strong>. Sảnh lớn nhất kết thúc bằng A (ví dụ J-Q-K-A).</li>
        </ul>

        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={16} color="#d97706" /> 3. Luật Báo Sâm (Xin Sâm)
        </h3>
        <p style={{ margin: '0 0 12px' }}>
          Sau khi chia bài, người chơi có 10 giây để quyết định <strong>Báo Sâm</strong>. Nếu bạn báo Sâm và đánh hết 10 lá mà không ai chặn được, bạn <strong>Thắng Sâm</strong> (+20 điểm từ mỗi người chơi). Nếu bị ai chặn dù chỉ 1 lượt, bạn <strong>Đền Sâm</strong> (phạt 20 điểm x số đối thủ).
        </p>

        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Flame size={16} color="#dc2626" /> 4. Luật Báo 1 & Thối 2
        </h3>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
          <li><strong>Báo 1:</strong> Khi người chơi chỉ còn đúng 1 lá bài, hệ thống phát tín hiệu cảnh báo. Người ngồi trước phải đánh quân to nhất để chặn.</li>
          <li><strong>Thối 2:</strong> Không được để quân 2 (hoặc tứ quý) ở lượt đánh cuối cùng để hết bài. Nếu về bằng quân 2 sẽ bị xử <strong>Thối 2</strong> và bị phạt điểm.</li>
          <li><strong>Cóng (Cháy):</strong> Người chơi chưa đánh được lá bài nào khi người khác đã hết bài bị phạt điểm.</li>
        </ul>

        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            fontSize: 12,
            color: '#92400e',
          }}
        >
          <strong>Lưu ý:</strong> Điểm số trong game là <em>WorkRank Game Points</em> nội bộ dành cho giải trí thi đua lành mạnh giữa các thành viên.
        </div>
      </div>
    </AnimatedModal>
  );
}
