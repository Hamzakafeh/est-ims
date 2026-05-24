// ── THEME ──
(function() {
  if (localStorage.getItem('est-theme') === 'light')
    document.documentElement.classList.add('light');
})();

// ── DEVELOPER MODAL ──
function openDevModal() {
  document.getElementById('devOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDevModal() {
  document.getElementById('devOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
function closeDevModalOutside(e) {
  if (e.target === document.getElementById('devOverlay')) closeDevModal();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDevModal(); });

// ── TYPEWRITER LOOP ──
(function() {
  const word        = 'ALESTESHARIA';
  const el          = document.getElementById('brandText');
  const wrap        = document.getElementById('brandName');

  const typeSpeed   = 100;
  const deleteSpeed = 85;
  const pauseFull   = 2400;
  const pauseEmpty  = 550;

  wrap.style.opacity   = '0';
  wrap.style.transform = 'translateY(16px)';
  wrap.style.transition = 'opacity 0.55s ease, transform 0.55s ease';

  setTimeout(() => {
    wrap.style.opacity   = '1';
    wrap.style.transform = 'translateY(0)';

    let i = 0, deleting = false;

    function tick() {
      if (!deleting) {
        i++;
        el.textContent = word.slice(0, i);
        if (i === word.length) {
          setTimeout(() => { deleting = true; tick(); }, pauseFull);
        } else {
          setTimeout(tick, typeSpeed);
        }
      } else {
        i--;
        el.textContent = word.slice(0, i);
        if (i === 0) {
          deleting = false;
          setTimeout(tick, pauseEmpty);
        } else {
          setTimeout(tick, deleteSpeed);
        }
      }
    }
    tick();
  }, 500);
})();

// ── STEPS ──
const steps = [
  { label: 'Init',    sub: 'INITIALIZING SERVICES...', detail: 'Starting core services and dependencies.' },
  { label: 'DB',      sub: 'CONNECTING DATABASE...',   detail: 'Establishing database connection.' },
  { label: 'Cache',   sub: 'LOADING CACHE...',         detail: 'Warming up application cache.' },
  { label: 'Ready',   sub: 'ALMOST READY...',          detail: 'Performing final checks.' },
];

const dotsRow     = document.getElementById('dotsRow');
const progressFill = document.getElementById('progressFill');
const statusLabel  = document.getElementById('statusLabel');
const statusSub    = document.getElementById('statusSub');

// Build dot steps with lines between them
steps.forEach((s, i) => {
  if (i > 0) {
    const line = document.createElement('div');
    line.className = 'dot-line';
    dotsRow.appendChild(line);
  }
  const step = document.createElement('div');
  step.className = 'dot-step';
  step.innerHTML = `
    <div class="dot-circle" id="dot-${i}"></div>
    <div class="dot-label">${s.label}</div>
  `;
  dotsRow.appendChild(step);
});

let currentStep = 0;
const totalDuration = 55000; // 55s total spread across steps
const stepDurations = [10000, 15000, 15000, 15000];

function activateStep(i) {
  if (i >= steps.length) return;
  // mark previous done
  if (i > 0) {
    document.getElementById(`dot-${i-1}`).className = 'dot-circle done';
  }
  document.getElementById(`dot-${i}`).className = 'dot-circle active';
  statusLabel.textContent = steps[i].sub;
  statusSub.innerHTML = steps[i].detail + '<br>This may take up to 60 seconds.';
}

// Animate progress bar
let startTime = Date.now();
function updateProgress() {
  const elapsed = Date.now() - startTime;
  // clamp at 95% — actual redirect completes it
  const pct = Math.min(95, (elapsed / totalDuration) * 100);
  progressFill.style.width = pct + '%';

  // advance steps
  let acc = 0;
  for (let i = 0; i < stepDurations.length; i++) {
    acc += stepDurations[i];
    if (elapsed < acc && currentStep <= i) {
      if (currentStep < i) { currentStep = i; activateStep(i); }
      break;
    }
    if (i === stepDurations.length - 1 && currentStep < i) {
      currentStep = i; activateStep(i);
    }
  }

  if (pct < 95) requestAnimationFrame(updateProgress);
}

activateStep(0);
requestAnimationFrame(updateProgress);

// ── PING LOOP — redirect when server wakes ──
async function pingUntilAlive() {
  try {
    const res = await fetch('https://est-ims.onrender.com/ping', {
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      // Server is awake — fill bar and redirect
      progressFill.style.transition = 'width 0.6s ease';
      progressFill.style.width = '100%';
      // mark all done
      steps.forEach((_, i) => {
        document.getElementById(`dot-${i}`).className = 'dot-circle done';
      });
      statusLabel.textContent = 'SERVER READY ✓';
      statusSub.innerHTML = 'Redirecting you now...';
setTimeout(() => { window.location.href = '/welcome'; }, 700);
      return;
    }
  } catch (_) { /* still sleeping */ }
  setTimeout(pingUntilAlive, 4000);
}

pingUntilAlive();

// ── PARTICLES ──
(function() {
  const canvas = document.getElementById('particleCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [], mouse = { x: -999, y: -999 };
  const isLight = () => document.documentElement.classList.contains('light');

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }

  function Particle() {
    this.x     = Math.random() * W;
    this.y     = Math.random() * H;
    this.vx    = (Math.random() - 0.5) * 0.35;
    this.vy    = (Math.random() - 0.5) * 0.35;
    this.r     = Math.random() * 1.6 + 0.4;
    this.alpha = Math.random() * 0.4 + 0.08;
  }

  Particle.prototype.update = function() {
    this.x += this.vx; this.y += this.vy;
    if (this.x < 0) this.x = W; if (this.x > W) this.x = 0;
    if (this.y < 0) this.y = H; if (this.y > H) this.y = 0;
    const dx = this.x - mouse.x, dy = this.y - mouse.y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d < 110) { this.x += dx/d*1.4; this.y += dy/d*1.4; }
  };

  function init() {
    resize(); particles = [];
    const n = Math.floor((W * H) / 13000);
    for (let i = 0; i < n; i++) particles.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const light = isLight();
    const dc = light ? 'rgba(37,99,235,' : 'rgba(59,130,246,';
    const lc = light ? 'rgba(37,99,235,' : 'rgba(59,130,246,';
    const md = 135;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.update();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = dc + p.alpha + ')'; ctx.fill();
      for (let j = i+1; j < particles.length; j++) {
        const q  = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < md) {
          const a = (1 - d/md) * 0.15 * (light ? 1 : 0.65);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = lc + a + ')'; ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', init);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });
  init(); draw();
})();
