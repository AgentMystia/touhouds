// particles.js — 轻量粒子系统。
export const particles = [];

export function burst(st, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 90;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, color, r: 2 + Math.random() * 3, type: 'dot' });
  }
}

export function sparkle(st, x, y, n = 20) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 60;
    particles.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: 0, vy: -20 - Math.random() * 30, life: 0.8 + Math.random() * 0.8, maxLife: 1.6, color: '#fff0a0', r: 2 + Math.random() * 2, type: 'star' });
  }
}

export function noteBurst(st, x, y) {
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    particles.push({ x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 20, vx: Math.cos(a) * 60, vy: -50 - Math.random() * 40, life: 1.4, maxLife: 1.4, color: ['#ffb0e0', '#c0a0ff', '#a0d0ff'][i % 3], r: 6, type: 'note', ph: i });
  }
}

export function petalRing(st, x, y) {
  // 幽香的攻击弹幕：由 updateProjectiles 处理伤害，这里生成投射物实体
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const sp = 190;
    st.projectiles.push({
      kind: 'projectile', id: 'petal', x, y, r: 10,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 2.2, dmg: 25, spin: Math.random() * 6, dead: false,
    });
    st.entities.push(st.projectiles[st.projectiles.length - 1]);
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawParticles(ctx, cam) {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const sx = p.x - cam.x, sy = p.y - cam.y;
    if (p.type === 'note') {
      ctx.font = `${p.r * 2.4}px serif`;
      ctx.fillText('♪', sx, sy + Math.sin(p.ph + p.life * 6) * 6);
    } else if (p.type === 'star') {
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
