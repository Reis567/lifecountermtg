// ===== Gráfico de vida =====
// Monta a série de vida de cada jogador a partir do log de eventos (ordem
// cronológica) e desenha em SVG (telas) ou em canvas (imagem compartilhável).
// events em ordem CRONOLÓGICA. startingLife: vida inicial.
export function buildLifeSeries(events, players, startingLife) {
    const series = new Map();
    players.forEach((p) => series.set(p.id, { id: p.id, name: p.name, color: p.color, points: [{ x: 0, life: startingLife, turn: 1 }], eliminatedAt: null }));
    const turns = [{ x: 0, turn: 1 }];
    let x = 0;
    let lastTurn = 1;
    for (const ev of events) {
        x++;
        const t = ev.turn ?? lastTurn;
        if (t !== lastTurn) {
            turns.push({ x, turn: t });
            lastTurn = t;
        }
        const s = series.get(ev.playerId);
        if (!s)
            continue;
        if ((ev.type === 'life_change' || ev.type === 'commander_damage') && typeof ev.details?.newValue === 'number') {
            const life = ev.type === 'commander_damage'
                ? (s.points[s.points.length - 1].life - (ev.details.amount || 0))
                : ev.details.newValue;
            s.points.push({ x, life, turn: t });
        }
        else if (ev.type === 'player_eliminated') {
            s.eliminatedAt = x;
            s.points.push({ x, life: Math.min(0, s.points[s.points.length - 1].life), turn: t });
        }
        else if (ev.type === 'revive') {
            s.eliminatedAt = null;
            s.points.push({ x, life: Math.max(1, s.points[s.points.length - 1].life), turn: t });
        }
    }
    // Estende todas as séries até o fim.
    series.forEach((s) => { const last = s.points[s.points.length - 1]; if (last.x < x)
        s.points.push({ x, life: last.life, turn: lastTurn }); });
    return { series: Array.from(series.values()), maxX: Math.max(1, x), turns };
}
function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// SVG responsivo (viewBox) com linhas por jogador, marcas de turno e legenda.
export function lifeChartSvg(data, opts = {}) {
    const W = opts.width ?? 640;
    const H = opts.height ?? 260;
    const padL = 34, padR = 12, padT = 12, padB = 40;
    const allLives = data.series.flatMap(s => s.points.map(p => p.life));
    const maxLife = Math.max(opts.startingLife ?? 40, ...allLives, 1);
    const minLife = Math.min(0, ...allLives);
    const px = (x) => padL + (x / data.maxX) * (W - padL - padR);
    const py = (life) => padT + (1 - (life - minLife) / (maxLife - minLife || 1)) * (H - padT - padB);
    const gridVals = [0, Math.round(maxLife / 4), Math.round(maxLife / 2), Math.round(maxLife * 3 / 4), maxLife];
    const grid = gridVals.map(v => `<line x1="${padL}" y1="${py(v)}" x2="${W - padR}" y2="${py(v)}" stroke="rgba(255,255,255,0.08)"/><text x="${padL - 6}" y="${py(v) + 4}" font-size="10" fill="#888" text-anchor="end">${v}</text>`).join('');
    const turnMarks = data.turns.filter((t, i) => i === 0 || data.turns.length <= 24 || i % Math.ceil(data.turns.length / 24) === 0)
        .map(t => `<line x1="${px(t.x)}" y1="${padT}" x2="${px(t.x)}" y2="${H - padB}" stroke="rgba(255,255,255,0.06)"/><text x="${px(t.x)}" y="${H - padB + 14}" font-size="9" fill="#777" text-anchor="middle">T${t.turn}</text>`).join('');
    const lines = data.series.map(s => {
        const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.life).toFixed(1)}`).join(' ');
        const last = s.points[s.points.length - 1];
        const skull = s.eliminatedAt !== null ? `<text x="${px(s.eliminatedAt)}" y="${py(0) - 4}" font-size="12" text-anchor="middle">💀</text>` : '';
        return `<path d="${d}" fill="none" stroke="${esc(s.color)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="${s.eliminatedAt !== null ? 0.6 : 1}"/>
            <circle cx="${px(last.x)}" cy="${py(last.life)}" r="3.5" fill="${esc(s.color)}"/>${skull}`;
    }).join('');
    const legend = data.series.map((s, i) => {
        const last = s.points[s.points.length - 1];
        return `<g transform="translate(${padL + i * ((W - padL - padR) / Math.max(1, data.series.length))}, ${H - 12})"><rect width="10" height="10" rx="2" fill="${esc(s.color)}"/><text x="14" y="9" font-size="10" fill="#ccc">${esc(s.name)} · ${last.life}</text></g>`;
    }).join('');
    return `<svg class="life-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${grid}${turnMarks}${lines}${legend}</svg>`;
}
// Desenha no canvas (imagem compartilhável). Mesma lógica do SVG.
export function drawLifeChart(ctx, data, x0, y0, W, H, startingLife = 40) {
    const padL = 30, padR = 8, padT = 8, padB = 18;
    const allLives = data.series.flatMap(s => s.points.map(p => p.life));
    const maxLife = Math.max(startingLife, ...allLives, 1);
    const minLife = Math.min(0, ...allLives);
    const px = (x) => x0 + padL + (x / data.maxX) * (W - padL - padR);
    const py = (life) => y0 + padT + (1 - (life - minLife) / (maxLife - minLife || 1)) * (H - padT - padB);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x0, y0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.fillStyle = '#999';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    [0, Math.round(maxLife / 2), maxLife].forEach(v => {
        ctx.beginPath();
        ctx.moveTo(x0 + padL, py(v));
        ctx.lineTo(x0 + W - padR, py(v));
        ctx.stroke();
        ctx.fillText(String(v), x0 + padL - 4, py(v) + 3);
    });
    ctx.textAlign = 'center';
    data.turns.forEach((t, i) => {
        if (data.turns.length > 16 && i % Math.ceil(data.turns.length / 16) !== 0)
            return;
        ctx.fillText(`T${t.turn}`, px(t.x), y0 + H - 4);
    });
    data.series.forEach(s => {
        ctx.beginPath();
        s.points.forEach((p, i) => { if (i === 0)
            ctx.moveTo(px(p.x), py(p.life));
        else
            ctx.lineTo(px(p.x), py(p.life)); });
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = s.eliminatedAt !== null ? 0.6 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        const last = s.points[s.points.length - 1];
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px(last.x), py(last.life), 3.5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}
//# sourceMappingURL=chart.js.map