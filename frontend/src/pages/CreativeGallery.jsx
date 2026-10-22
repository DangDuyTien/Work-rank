import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CreativeCornerSection from '../components/CreativeCornerSection';
import { PageShell } from '../components/ui';

/**
 * Thư Viện Tranh — trang riêng cho Góc Sáng Tạo.
 *
 * Mục đích: tác phẩm mọi người vẽ xong luôn có một nơi để xem, kể cả khi admin
 * đang tắt hiển thị khu vực này trên Trang chủ (cấu hình homeVisible = false).
 */
export default function CreativeGallery() {
  return (
    <PageShell>
      <div className="creative-gallery-topbar">
        <Link to="/" className="creative-gallery-back">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Về Trang chủ</span>
        </Link>
        <Link to="/games/drawing" className="creative-gallery-draw-link">
          Mở phòng vẽ tranh
        </Link>
      </div>

      <CreativeCornerSection standalone forceVisible />
    </PageShell>
  );
}
