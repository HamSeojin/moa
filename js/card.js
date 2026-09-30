// 모아 — 오늘 카드 PNG 렌더러 (1080×1350, 4:5)
// 종이 다이어리 무드: 일러스트는 흰 테두리 사진처럼, 글자는 캔버스로 정확히 합성.
// (AI에게 한글을 그리게 하지 않음 — 오탈자 방지)
const W = 1080, H = 1350;
const PAPER = '#FBF6EE';
const INK = '#3B3436';
const INK_SOFT = 'rgba(59,52,54,.72)';
const INK_FAINT = 'rgba(59,52,54,.45)';
const ACCENT = '#C0564F';
const WHITE = '#FFFCF6';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapLines(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        lines.push(line); line = ch;
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

export async function renderDayCardPNG({ dateLabel, summary, highlights, recordCount, illustDataUrl }) {
  try {
    await document.fonts.load('700 44px "Gowun Batang"');
    await document.fonts.load('400 46px "Gowun Batang"');
    await document.fonts.load('400 36px "Gowun Batang"');
  } catch (_) {}

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // 종이 배경
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  let y = 84;

  // 일러스트: 흰 테두리 사진처럼 살짝 기울여 붙이기
  if (illustDataUrl) {
    try {
      const img = await loadImage(illustDataUrl);
      const pw = 920, ph = 690, bw = 26;
      ctx.save();
      ctx.translate(W / 2, y + ph / 2 + bw);
      ctx.rotate(-0.021);
      ctx.shadowColor = 'rgba(59,52,54,.16)';
      ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      roundRect(ctx, -pw / 2 - bw, -ph / 2 - bw, pw + bw * 2, ph + bw * 2, 6);
      ctx.fillStyle = WHITE; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.save();
      roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 2); ctx.clip();
      const s = Math.max(pw / img.width, ph / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      ctx.restore();
      y += ph + bw * 2 + 64;
    } catch (_) { /* 일러스트 실패 시 텍스트만 */ }
  } else {
    ctx.fillStyle = ACCENT;
    ctx.font = '400 64px "Gowun Batang"';
    ctx.textAlign = 'center';
    ctx.fillText('✿', W / 2, y + 90);
    y += 170;
  }

  // 날짜 도장
  ctx.fillStyle = INK;
  ctx.font = '700 44px "Gowun Batang"';
  ctx.textAlign = 'center';
  ctx.fillText(dateLabel, W / 2, y + 44);
  y += 44 + 30;

  // 빨간 줄
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2 - 280, y); ctx.lineTo(W / 2 + 280, y); ctx.stroke();
  y += 52;

  // 요약
  ctx.fillStyle = INK;
  ctx.font = '400 46px "Gowun Batang"';
  const sumLines = wrapLines(ctx, summary, 880).slice(0, 3);
  for (const ln of sumLines) { ctx.fillText(ln, W / 2, y + 46); y += 46 * 1.55; }
  y += 18;

  // 하이라이트
  ctx.fillStyle = INK_SOFT;
  ctx.font = '400 36px "Gowun Batang"';
  for (const h of (highlights || []).slice(0, 3)) {
    const hLines = wrapLines(ctx, '✿ ' + h, 840).slice(0, 2);
    for (const ln of hLines) { ctx.fillText(ln, W / 2, y + 38); y += 38 * 1.5; }
    y += 10;
  }

  // 푸터 (하단 고정)
  ctx.fillStyle = INK_FAINT;
  ctx.font = '400 30px "Gowun Batang"';
  ctx.fillText(`기록 ${recordCount}개로 만든 카드 · 모아`, W / 2, H - 64);

  return cv;
}

export function canvasToDataURL(canvas) {
  return canvas.toDataURL('image/png');
}

export async function shareCanvas(canvas, filename) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: '모아 오늘 카드' });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  }
}
