/** Live clock + session uptime in the top-right HUD corner. */

let sessionStart = null;
let timer = null;

const dateEl = () => document.getElementById('hud-date');
const timeEl = () => document.getElementById('hud-time');
const uptimeEl = () => document.getElementById('hud-uptime');

const PAD = (n) => String(n).padStart(2, '0');

function tick() {
  const now = new Date();

  if (timeEl()) timeEl().textContent = `${PAD(now.getHours())}:${PAD(now.getMinutes())}:${PAD(now.getSeconds())}`;
  if (dateEl()) {
    dateEl().textContent = now
      .toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase();
  }

  if (sessionStart && uptimeEl()) {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    uptimeEl().textContent = `${PAD(h)}:${PAD(m)}:${PAD(s)}`;
  }
}

export function startClock() {
  sessionStart = Date.now();
  tick();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}

export function stopClock() {
  clearInterval(timer);
  timer = null;
}
