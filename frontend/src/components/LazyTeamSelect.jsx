import React, { useMemo, useState } from 'react';

/**
 * WR-AUDIT-006 — Select đội cho từng kênh YouTube.
 *
 * Bảng có ~107 kênh; render toàn bộ ~255 team option cho mỗi row tạo ra hơn
 * 27.000 <option> và 33.000 DOM node. Component này chỉ render option của row
 * đang được mở, giữ nguyên hành vi native select và thêm nhãn accessibility.
 */
export default function LazyTeamSelect({
  value,
  teams,
  onChange,
  disabled = false,
  ariaLabel,
  style,
  emptyLabel = '-- Chưa gán đội (Độc lập) --',
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = useMemo(
    () => (teams || []).find((team) => String(team.id) === String(value)),
    [teams, value],
  );

  return (
    <select
      value={value || ''}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      style={style}
      onFocus={() => setExpanded(true)}
      onPointerDown={() => setExpanded(true)}
      onMouseDown={() => setExpanded(true)}
    >
      <option value="">{emptyLabel}</option>
      {selected && (
        <option value={selected.id}>{selected.name} ({selected.department})</option>
      )}
      {expanded && (teams || [])
        .filter((team) => String(team.id) !== String(value))
        .map((team) => (
          <option key={team.id} value={team.id}>{team.name} ({team.department})</option>
        ))}
    </select>
  );
}
