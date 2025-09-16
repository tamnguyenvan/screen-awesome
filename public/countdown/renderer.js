let count = 3;
const countdownNumber = document.getElementById('countdown-number');
const countdownCircle = document.getElementById('countdown-circle');

if (countdownNumber && countdownCircle) {
  countdownNumber.textContent = count;
  
  const interval = setInterval(() => {
    count--;
    
    // Trigger number change animation
    countdownNumber.style.animation = 'none';
    countdownNumber.offsetHeight; // Trigger reflow
    countdownNumber.style.animation = 'numberChange 0.2s ease-in-out';
    
    if (count > 0) {
      setTimeout(() => {
        countdownNumber.textContent = count;
      }, 100); // Change number at the middle of animation
    } else if (count === 0) {
      setTimeout(() => {
        countdownNumber.textContent = 'Go!';
        countdownNumber.style.fontSize = '48px';
        countdownNumber.style.fontWeight = '700';
        countdownNumber.style.color = 'rgb(34, 197, 94)';
      }, 100);
    } else {
      clearInterval(interval);
      // The window is closed automatically after the countdown.
    }
  }, 1000);
}