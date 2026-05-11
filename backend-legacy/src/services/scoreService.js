const calculateScore = (keystrokes, mouseClicks, activeSeconds) => {
  const activeMinutes = Math.floor(activeSeconds / 60);
  return Math.floor(keystrokes / 100) + Math.floor(mouseClicks / 20) + Math.floor(activeMinutes / 10) * 5;
};

module.exports = { calculateScore };
