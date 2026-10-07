import React from 'react';
import { Building, DollarSign, User, ShieldCheck, Tag, X, Crown, Sparkles, Flag, Gift, Coffee, ShieldAlert, CreditCard } from 'lucide-react';
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
      title={isProperty ? 'Bằng Khoán Bất Động Sản' : 'Chi Tiết Ô Bàn Cờ'}
      maxWidth={460}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title Deed Card Header Ribbon */}
        <div
          style={{
            background: isProperty
              ? `linear-gradient(135deg, ${groupColor} 0%, ${groupColor}dd 100%)`
              : tile.type === 'START'
              ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
              : tile.type === 'BONUS'
              ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
              : tile.type === 'TAX'
              ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
              : 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
            color: '#ffffff',
            padding: '18px 20px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 6px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.95 }}>
              {isProperty ? `NHÓM: ${groupName}` : `Ô ĐẶC BIỆT #${tile.index}`}
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
              {tile.name}
            </h3>
          </div>

          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {isProperty ? <Building size={24} /> : tile.type === 'START' ? <Flag size={24} /> : tile.type === 'BONUS' ? <Gift size={24} /> : tile.type === 'TAX' ? <ShieldAlert size={24} /> : <Sparkles size={24} />}
          </div>
        </div>

        {/* Pricing / Rent Breakdown Grid */}
        {isProperty && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div
              style={{
                background: 'rgba(56,189,248,0.06)',
                border: '1.5px solid rgba(56,189,248,0.25)',
                borderRadius: 10,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Giá Mua Sở Hữu
              </div>
              <div
                style={{
                  fontSize: 22,
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
                background: 'rgba(34,197,94,0.06)',
                border: '1.5px solid rgba(34,197,94,0.25)',
                borderRadius: 10,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Tiền Thuê Lượt
              </div>
              <div
                style={{
                  fontSize: 22,
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

        {/* Ownership Status Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(15,23,42,0.1)',
            borderRadius: 10,
            padding: 14,
            boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tình Trạng Sở Hữu
          </div>

          {owner ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: owner.color || '#38bdf8',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 900,
                  border: '2.5px solid #ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                {owner.user?.name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {owner.user?.name || `Người chơi ${owner.seatIndex + 1}`} (Vị trí P{owner.seatIndex + 1})
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Đã xây dựng tài sản này. Đối thủ khi đi vào ô sẽ tự động thanh toán <strong>${propRent}</strong> tiền thuê.
                </div>
              </div>
            </div>
          ) : isProperty ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#16a34a', background: 'rgba(34,197,94,0.08)', padding: '10px 12px', borderRadius: 8 }}>
              <ShieldCheck size={22} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
                Đất trống — Bạn có thể mua sở hữu tài sản này với giá <strong>${propPrice}</strong> ngay khi dừng lại tại đây!
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {tile.type === 'START' && 'Nhận +$200 tiền thưởng vòng mỗi khi đi qua hoặc dừng lại ô Khởi Hành.'}
              {tile.type === 'REST' && 'Khu vực nghỉ dưỡng an toàn — Bạn được nghỉ ngơi không mất tiền.'}
              {tile.type === 'TAX' && `Ô Thuế / Phí — Nộp khoản tiền $${tile.taxAmount || 100} cho quỹ công ty.`}
              {tile.type === 'BONUS' && `Ô Kho Báu Doanh Nghiệp — Nhận ngay phần thưởng nóng +$${tile.bonus || 150}.`}
              {tile.type === 'EVENT' && 'Ô Cơ Hội — Rút 1 thẻ sự kiện bất ngờ với phần thưởng tài chính hoặc chi phí phát sinh.'}
            </div>
          )}
        </div>

        {/* Monopoly Strategy Tip */}
        {isProperty && (
          <div
            style={{
              background: 'rgba(168,85,247,0.06)',
              border: '1px dashed rgba(168,85,247,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#7e22ce',
            }}
          >
            <Sparkles size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Mẹo chiến lược:</strong> Sở hữu trọn bộ 3 bất động sản nhóm <strong>{groupName}</strong> để kiểm soát toàn bộ khu vực!
            </span>
          </div>
        )}

        {/* Footer Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--text-primary)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 22px',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(15,23,42,0.15)',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

