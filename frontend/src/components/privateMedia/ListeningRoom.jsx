import React from 'react';
import { Users } from 'lucide-react';
import DefaultAvatar from '../DefaultAvatar';
import { SegmentedControl } from '../ui';
import { usePrivateMedia } from '../../context/PrivateMediaContext';
import { useAuth } from '../../context/AuthContext';

/**
 * PHÒNG NGHE CHUNG — who is listening right now
 *
 * Presentation only. The list comes from the server, which keys membership by
 * ACCOUNT: two tabs of the same person are one avatar, and closing one tab does
 * not make them leave. Online is implied by having a live socket, so every chip
 * here is online by definition; the green dot is the visual confirmation.
 */
export default function ListeningRoom() {
  const { user } = useAuth();
  const { room, roomMode, setRoomMode, socketConnected } = usePrivateMedia();
  const participants = room?.participants || [];
  const count = participants.length;
  const shared = roomMode === 'shared';

  return (
    <section className="pm-room" aria-label="Phòng nghe chung">
      <header className="pm-room__head">
        <h2>
          <Users size={15} aria-hidden="true" />
          Phòng nghe
        </h2>
        <span className={`pm-room__live${socketConnected ? ' is-live' : ''}`}>
          <i aria-hidden="true" />
          {count > 0 ? `${count} người đang nghe` : 'Chưa có ai'}
        </span>
      </header>

      <SegmentedControl
        ariaLabel="Chế độ nghe"
        value={roomMode}
        onChange={setRoomMode}
        options={[{ key: 'private', label: 'Nghe riêng' }, { key: 'shared', label: 'Nghe chung' }]}
      />

      <div className="pm-room__people" role="list" aria-label="Thành viên đang nghe chung">
        {participants.map((person) => {
          const mine = Number(person.id) === Number(user?.id);
          return (
            <div
              key={person.id}
              role="listitem"
              className={`pm-room__person${mine ? ' is-mine' : ''}`}
              title={`${person.name}${mine ? ' (bạn)' : ''} · đang trực tuyến`}
            >
              <span className="pm-room__avatar">
                <DefaultAvatar
                  src={person.avatarUrl}
                  name={person.name}
                  userId={person.id}
                  size={30}
                  shape="circle"
                  alt={person.name}
                />
                <i className="pm-room__dot" aria-label="Trực tuyến" />
              </span>
              <span className="pm-room__name">{mine ? 'Bạn' : person.name}</span>
            </div>
          );
        })}
        {count === 0 && (
          <p className="pm-room__empty">
            Chưa có ai trong phòng. Bật <strong>Nghe chung</strong> để mọi người thấy bạn.
          </p>
        )}
      </div>

      <p className="pm-room__note">
        {shared
          ? 'Nhạc, hàng chờ và chat dùng chung. Âm lượng chỉ áp dụng cho bạn.'
          : 'Đang nghe riêng. Chat chung vẫn hiển thị đầy đủ với mọi người.'}
      </p>
    </section>
  );
}
