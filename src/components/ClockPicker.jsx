import { useEffect, useRef, useState } from 'react';

const SIZE = 240;
const CX = SIZE / 2,
  CY = SIZE / 2,
  R = 96;

function pad(n) {
  return String(n).padStart(2, '0');
}

function angleToVal(angle, total) {
  let v = Math.round((angle / (Math.PI * 2)) * total);
  return ((v % total) + total) % total;
}
function valueToAngle(val, total) {
  return (val / total) * Math.PI * 2 - Math.PI / 2;
}

export default function ClockPicker({ value, onChange }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('h');
  const [manualH, setManualH] = useState('');
  const [manualM, setManualM] = useState('');
  const dragging = useRef(false);

  const h = value ? parseInt(value.split(':')[0]) : 9;
  const m = value ? parseInt(value.split(':')[1]) : 0;

  useEffect(() => {
    draw();
  }, [h, m, phase]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    // background
    ctx.beginPath();
    ctx.arc(CX, CY, R + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();

    if (phase === 'h') {
      // 24h mode: outer ring 0-11, inner ring 12-23
      for (let i = 0; i < 24; i++) {
        const isOuter = i >= 12;
        const r = isOuter ? R : R * 0.6;
        const angle = valueToAngle(i % 12, 12); // beide Ringe 12 Positionen
        const x = CX + r * Math.cos(angle);
        const y = CY + r * Math.sin(angle);
        const isActive = i === h;

        if (isActive) {
          ctx.beginPath();
          ctx.arc(x, y, 16, 0, Math.PI * 2);
          ctx.fillStyle = 'oklch(65% 0.25 290)';
          ctx.fill();
          ctx.fillStyle = '#fff';
        } else {
          ctx.fillStyle = isOuter ? 'oklch(70% 0 0)' : 'oklch(55% 0 0)';
        }

        if (isActive) {
          ctx.beginPath();
          ctx.moveTo(CX, CY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = 'oklch(65% 0.25 290)';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.3;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.font = `${isActive ? '600' : '400'} 12px 'DM Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pad(i), x, y);
      }
    } else {
      // numbers at 5-minute intervals
      for (let i = 0; i < 12; i++) {
        const val = i * 5;
        const angle = valueToAngle(val, 60);
        const x = CX + R * 0.78 * Math.cos(angle);
        const y = CY + R * 0.78 * Math.sin(angle);
        const isActive = m >= val && m < val + 5;
        ctx.fillStyle = isActive ? '#fff' : 'oklch(70% 0 0)';
        ctx.font = `${isActive ? '600' : '400'} 11px 'DM Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pad(val), x, y);
      }

      // hand to exact minute
      const handAngle = valueToAngle(m, 60);
      const hx = CX + R * Math.cos(handAngle);
      const hy = CY + R * Math.sin(handAngle);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = 'oklch(65% 0.25 290)';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // active dot
      ctx.beginPath();
      ctx.arc(hx, hy, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'oklch(65% 0.25 290)';
      ctx.fill();
    }

    // center dot
    ctx.beginPath();
    ctx.arc(CX, CY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'oklch(65% 0.25 290)';
    ctx.fill();
  }

  function getAngle(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const dx = src.clientX - rect.left - CX;
    const dy = src.clientY - rect.top - CY;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    return angle;
  }

  function handleInteract(e, finalize = false) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const angle = getAngle(e, canvas);

    if (phase === 'h') {
      // determine inner vs outer ring by distance from center
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      const dx = src.clientX - rect.left - CX;
      const dy = src.clientY - rect.top - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isOuter = dist > R * 0.8;

      let newH = angleToVal(angle, 12);
      if (isOuter) {
        newH = newH + 12; // outer: 12-23, 0→12, 1→13 etc.
        if (newH === 24) newH = 12;
      } else {
        // inner: 0-11, bleibt wie es ist
      }
      newH = Math.min(23, Math.max(0, newH));
      onChange(`${pad(newH)}:${pad(m)}`);
      if (finalize) setPhase('m');
    } else {
      const newM = angleToVal(angle, 60);
      onChange(`${pad(h)}:${pad(newM)}`);
    }
  }

  function onDown(e) {
    dragging.current = true;
    handleInteract(e);
  }
  function onMove(e) {
    if (dragging.current) handleInteract(e);
  }
  function onUp(e) {
    if (dragging.current) {
      handleInteract(e, true);
      dragging.current = false;
    }
  }

  // Manual input handlers
  function handleManualH(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setManualH(val);
    const num = parseInt(val);
    if (val.length === 2 && num >= 0 && num <= 23) {
      onChange(`${pad(num)}:${pad(m)}`);
      setManualH('');
    }
  }

  function handleManualM(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setManualM(val);
    const num = parseInt(val);
    if (val.length === 2 && num >= 0 && num <= 59) {
      onChange(`${pad(h)}:${pad(num)}`);
      setManualM('');
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* display + manual input */}
      <div className="flex items-center gap-1 text-3xl font-mono font-medium">
        <input
          type="text"
          inputMode="numeric"
          className={`w-14 text-center bg-transparent border-b-2 outline-none transition-colors ${phase === 'h' ? 'border-primary text-primary' : 'border-base-content/20 text-base-content'}`}
          value={manualH !== '' ? manualH : pad(h)}
          onChange={handleManualH}
          onFocus={() => {
            setPhase('h');
            setManualH('');
          }}
          onBlur={() => setManualH('')}
        />
        <span className="text-base-content/30 select-none">:</span>
        <input
          type="text"
          inputMode="numeric"
          className={`w-14 text-center bg-transparent border-b-2 outline-none transition-colors ${phase === 'm' ? 'border-primary text-primary' : 'border-base-content/20 text-base-content'}`}
          value={manualM !== '' ? manualM : pad(m)}
          onChange={handleManualM}
          onFocus={() => {
            setPhase('m');
            setManualM('');
          }}
          onBlur={() => setManualM('')}
        />
      </div>

      {/* phase toggle */}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setPhase('h')}
          className={`btn btn-xs ${phase === 'h' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Stunde
        </button>
        <button
          type="button"
          onClick={() => setPhase('m')}
          className={`btn btn-xs ${phase === 'm' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Minute
        </button>
      </div>

      {/* clock */}
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE, cursor: 'pointer' }}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => {
          dragging.current = false;
        }}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
      />
    </div>
  );
}
