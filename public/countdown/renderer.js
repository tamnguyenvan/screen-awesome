let count = 3;
const countdownEl = document.getElementById("countdown");

function updateCountdown() {
  countdownEl.textContent = count;

  // restart animation each time the number changes
  countdownEl.style.animation = "none";
  countdownEl.offsetHeight; // force reflow
  countdownEl.style.animation = null;

  if (count > 0) {
    count--;
    setTimeout(updateCountdown, 1000);
  }
}

updateCountdown();
