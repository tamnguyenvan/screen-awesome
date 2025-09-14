let count = 3;
const countdownNumber = document.getElementById('countdown-number');
if (countdownNumber) {
  countdownNumber.textContent = count;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
    } else if (count === 0) {
      countdownNumber.textContent = 'Go!';
    } else {
      clearInterval(interval);
      // The window is closed automatically after the countdown.
    }
  }, 1000);
}