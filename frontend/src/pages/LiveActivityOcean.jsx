import React from 'react';
import LiveActivityWave from '../components/LiveActivityWave';

export default function LiveActivityOcean() {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }}>
      <LiveActivityWave defaultPeriod="today" />
    </div>
  );
}
