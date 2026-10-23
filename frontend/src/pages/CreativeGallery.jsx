import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Palette, Sparkles } from 'lucide-react';
import CreativeCornerSection from '../components/CreativeCornerSection';
import { PageShell } from '../components/ui';
import '../components/arcade/gallery-wall.css';

/**
 * THƯ VIỆN TRANH — phòng trưng bày của Work Rank Arcade.
 *
 * Mục đích: tác phẩm mọi người vẽ xong luôn có một nơi để xem, kể cả khi admin
 * đang tắt hiển thị khu vực này trên Trang chủ (cấu hình homeVisible = false).
 */
export default function CreativeGallery() {
  return (
    <PageShell className="gallery-page">
      <header className="gallery-hero">
        <div className="gallery-hero__copy">
          <p className="gallery-kicker"><Sparkles size={12} aria-hidden="true" /> WORK RANK ARCADE · PHÒNG NGHỆ THUẬT</p>
          <h1>Thư viện tranh</h1>
          <p>
            Mỗi bức tranh là một khoảnh khắc ai đó dừng lại giữa giờ làm và vẽ.
            Thả tim, tải về, hoặc mở Xưởng Vẽ để treo thêm một tác phẩm của bạn.
          </p>
        </div>
        <div className="gallery-hero__actions">
          <Link to="/games/drawing" className="gallery-cta is-primary">
            <Palette size={16} aria-hidden="true" />
            <span>Vào Xưởng Vẽ</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link to="/" className="gallery-cta">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Về Trang chủ</span>
          </Link>
        </div>
      </header>

      <div className="gallery-wall">
        <CreativeCornerSection standalone forceVisible />
      </div>
    </PageShell>
  );
}
