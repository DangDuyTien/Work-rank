import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, AlignLeft, Timer, Users, Trophy, ArrowRight, Layers } from 'lucide-react';
import { PageShell, PageHeader } from '../components/ui';
import { VOCAB_STATS } from '../../../shared/arcade/vocabulary/index.mjs';

/**
 * ĐUA GÕ CHỮ — một gia đình, hai cách chơi.
 *
 * - Gõ Nhanh: bắt từng từ, giữ chuỗi (arcade, 60 giây).
 * - Đua Gõ Chữ: đua cả đoạn văn 1 chọi 1 / 2 chọi 2 / 3 chọi 3 + luyện nhịp.
 *
 * Trang này chỉ là cửa vào: mỗi chế độ giữ nguyên phòng, điểm, BXH và luật riêng.
 */

const MODES = [
  {
    key: 'words',
    route: '/games/typing/words',
    icon: Keyboard,
    mark: '01',
    name: 'Gõ Nhanh',
    tagline: 'Từ xuất hiện · Gõ thật nhanh',
    description:
      'Từ hiện ra trên màn hình máy tính, gõ đúng để ăn điểm và nối chuỗi. Sai một ký tự là chuỗi bắt đầu lại.',
    meta: [`${VOCAB_STATS.total.toLocaleString('vi-VN')} từ`, '13 chủ đề', '60 giây'],
    metaIcons: [Layers, Timer, Trophy],
    modes: 'MỘT MÌNH · 1 CHỌI 1 · ĐỘI',
    accent: '#2f6f4f',
  },
  {
    key: 'passage',
    route: '/games/typing/passage',
    icon: AlignLeft,
    mark: '02',
    name: 'Đua Gõ Chữ',
    tagline: 'Đua cả đoạn văn · WPM',
    description:
      'Đua tốc độ trên cả đoạn văn có dấu tiếng Việt. Tính WPM, độ chính xác và xếp hạng realtime theo từng ký tự.',
    meta: ['Đoạn văn dài', 'WPM · chính xác', 'Realtime'],
    metaIcons: [AlignLeft, Timer, Trophy],
    modes: 'MỘT MÌNH · 1 CHỌI 1 · 2 CHỌI 2 · 3 CHỌI 3',
    accent: '#38506f',
  },
];

export default function TypingHub() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <PageHeader
        kicker="Đấu trường gõ phím"
        title="Đua Gõ Chữ"
        description="Chọn cách chơi: gõ từng từ để giữ chuỗi, hoặc đua cả đoạn văn với đồng đội."
      />

      <div className="typing-hub-grid">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.key}
              type="button"
              className="typing-hub-card"
              style={{ '--hub-accent': mode.accent }}
              onClick={() => navigate(mode.route)}
            >
              <div className="typing-hub-card__top">
                <span className="typing-hub-card__icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="typing-hub-card__mark">{mode.mark}</span>
              </div>

              <h2 className="typing-hub-card__name">{mode.name}</h2>
              <p className="typing-hub-card__tagline">{mode.tagline}</p>
              <p className="typing-hub-card__desc">{mode.description}</p>

              <ul className="typing-hub-card__meta">
                {mode.meta.map((item, index) => {
                  const MetaIcon = mode.metaIcons[index] || Layers;
                  return (
                    <li key={item}>
                      <MetaIcon size={12} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="typing-hub-card__footer">
                <span className="typing-hub-card__modes">
                  <Users size={12} aria-hidden="true" />
                  {mode.modes}
                </span>
                <span className="typing-hub-card__cta">
                  Chơi
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="typing-hub-note">
        Kho từ gõ nhanh: <b>{VOCAB_STATS.total.toLocaleString('vi-VN')}</b> mục ·{' '}
        {VOCAB_STATS.byLanguage.en.toLocaleString('vi-VN')} tiếng Anh ·{' '}
        {VOCAB_STATS.byLanguage.vi.toLocaleString('vi-VN')} tiếng Việt ·{' '}
        {Object.keys(VOCAB_STATS.byCategory).length} nhóm chủ đề. Không lặp từ trong cùng một trận.
      </p>
    </PageShell>
  );
}
