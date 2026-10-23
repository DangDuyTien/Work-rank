import React from 'react';
import { Trophy } from 'lucide-react';
import { songById } from '../../games/music/catalog';

/**
 * Music BXH. Separate from the WPM board on purpose: a 60-second song and a
 * 5-minute passage are not the same race, so they are not the same table.
 */
export default function MusicBoard({ rows = [], loading = false, myUserId = null }) {
  return (
    <section className="music-board">
      <div className="music-board-head">
        <div>
          <p className="arcade-kicker"><Trophy size={13} aria-hidden="true" /> BẢNG XẾP HẠNG</p>
          <h2>Giữ nhạc liền mạch nhất</h2>
        </div>
        <p className="music-board-note">Điểm = chính xác + số câu + độ liền mạch + chuỗi giữ nhịp. Máy chủ chấm lại từ lời đã gõ.</p>
      </div>

      {loading && <p className="music-board-empty">Đang tải bảng xếp hạng…</p>}
      {!loading && rows.length === 0 && (
        <p className="music-board-empty">Chưa có ai hoàn thành một bài. Bạn có thể là người đầu tiên giữ nhạc không dừng.</p>
      )}

      {rows.length > 0 && (
        <div className="music-board-table">
          <table>
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Người chơi</th>
                <th>Điểm</th>
                <th>Liền mạch</th>
                <th>Chính xác</th>
                <th>Bài</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const song = songById(row.songId);
                return (
                  <tr key={row.userId} data-me={String(row.userId) === String(myUserId) ? 'true' : 'false'}>
                    <td><span className="music-board-rank" data-top={row.rank <= 3 ? 'true' : 'false'}>{row.rank}</span></td>
                    <td>
                      <b>{row.user?.name || `Người chơi #${row.userId}`}</b>
                      {row.user?.jobTitle && <small>{row.user.jobTitle}</small>}
                    </td>
                    <td className="music-board-score">{Number(row.score || 0).toLocaleString('vi-VN')}</td>
                    <td>{Number(row.flowPct || 0)}%</td>
                    <td>{Number(row.accuracy || 0)}%</td>
                    <td>{song?.title || row.songId}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
