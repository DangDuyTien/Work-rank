import React from 'react';
import { Building, DollarSign, User, ShieldCheck, Tag, X } from 'lucide-react';
import { AnimatedModal } from '../ui';

export default function PropertyDetailModal({
  isOpen,
  onClose,
  tile,
  property,
  owner,
  players = [],
}) {
  if (!tile) return null;

  const isProperty = tile.type === 'PROPERTY';
  const propPrice = property?.price || tile.price || 0;
  const propRent = property?.rent || tile.rent || 0;
  const groupName = tile.groupName || tile.group || 'Khu vực';
  const groupColor = tile.color || '#38bdf8';

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title={isProperty ? 'Thông Tin Bất Động Sản' : 'Chi Tiết Ô Bàn Cờ'}
      maxWidth={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header Ribbon / Color Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${groupColor} 0%, ${groupColor}dd 100%)`,
            color: 'var(--surface)',
            padding: '16px 18px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
              {isProperty ? groupName : `Ô #${tile.index}`}
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--surface)' }}>
              {tile.name}
            </h3>
          </div>

          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--surface)',
            }}
          >
            <Building size={22} />
          </div>
        </div>

        {/* Pricing / Economics Info */}
        {isProperty && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div
              style={{
                background: 'rgba(15,23,42,0.03)',
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Giá Mua Đất
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: 'var(--info)',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 2,
                }}
              >
                ${propPrice}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(15,23,42,0.03)',
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Tiền Thuê Lượt
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#16a34a',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 2,
                }}
              >
                ${propRent}
              </div>
            </div>
          </div>
        )}

        {/* Ownership Status */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(15,23,42,0.1)',
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
            Tình Trạng Sở Hữu
          </div>

          {owner ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: owner.color || '#38bdf8',
                  color: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {owner.user?.name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {owner.user?.name || `Người chơi ${owner.seatIndex + 1}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Đã sở hữu tài sản này. Người chơi khác đi vào ô này sẽ phải trả ${propRent} tiền thuê.
                </div>
              </div>
            </div>
          ) : isProperty ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' }}>
              <ShieldCheck size={18} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Đất trống — Sẵn sàng để mua với giá ${propPrice} khi dừng lại tại đây.
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {tile.type === 'START' && 'Nhận +$200 thưởng vòng mỗi khi đi qua hoặc dừng lại ô Khởi Hành.'}
              {tile.type === 'REST' && 'Khu vực nghỉ dưỡng an toàn — Không bị tính thuế hay trừ tiền.'}
              {tile.type === 'TAX' && `Ô Phí / Thuế — Đóng khoản phí $${tile.taxAmount || 100} cho quỹ công ty.`}
              {tile.type === 'BONUS' && `Ô Kho Báu Doanh Nghiệp — Nhận ngay tiền thưởng +$${tile.bonus || 150}.`}
              {tile.type === 'EVENT' && 'Ô Cơ Hội — Rút 1 thẻ sự kiện bất ngờ với cơ hội nhận thưởng hoặc chi phí phát sinh.'}
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--text-primary)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
