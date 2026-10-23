import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, AlignLeft, Timer, Users, Trophy, ArrowRight, Layers, Music } from 'lucide-react';
import { PageShell, PageHeader } from '../components/ui';
import { VOCAB_STATS } from '../../../shared/arcade/vocabulary/index.mjs';

/**
 * ĐUA GÕ THEO NHẠC — một gia đình gõ phím, ba cách chơi.
 *
 * - Đua Gõ Theo Nhạc: gõ lời theo bài hát, nhạc chỉ dừng ở cuối câu (chế độ chính).
 * - Gõ Nhanh: bắt từng từ, giữ chuỗi (arcade, 60 giây).
 * - Văn bản cổ điển: đua cả đoạn văn, tính WPM — engine cũ, giữ nguyên kỷ lục.
 *
 * Trang này chỉ là cửa vào: mỗi chế độ giữ nguyên phòng, điểm, BXH và luật riêng.
 */

const MODES = [
  {
    key: 'music',
    route: '/games/typing/music',
    icon: Music,
    mark: '01',
    name: 'Đua Gõ Theo Nhạc',
    tagline: 'Gõ đúng lời · Giữ nhạc tiếp tục',
    description:
      'Nhạc chạy liên tục, lời hiện theo từng câu. Gõ kịp thì bài hát không ngắt; còn sai khi hết câu thì nhạc dừng đúng ở cuối câu đó và chạy tiếp khi bạn gõ xong.',
    meta: ['3 bài sáng tác', 'Độ liền mạch', 'Chơi cùng nhau'],
    metaIcons: [Music, Trophy, Users],
    modes: 'MỘT MÌNH · 1 CHỌI 1 · BA NGƯỜI',
    accent: '#8f4a24',
  },
  {
    key: 'words',
    route: '/games/typing/words',
    icon: Keyboard,
    mark: '02',
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
    mark: '03',
    name: 'Văn bản cổ điển',
    tagline: 'Đua cả đoạn văn · WPM',
    description:
      'Chế độ gốc: đua tốc độ trên cả đoạn văn có dấu tiếng Việt, tính WPM, độ chính xác và xếp hạng realtime theo từng ký tự.',
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
        title="Đua Gõ Theo Nhạc"
        description="Gõ đúng lời bài hát đang phát và giữ cho nhạc không phải dừng. Vẫn còn đó Gõ Nhanh và chế độ văn bản cổ điển."
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
