// Inspired by liuqingsong1528/Peek-Free-Login (https://github.com/liuqingsong1528/Peek-Free-Login)
// Ported from Vue Composition API to React + GSAP, themed for GP16 PV system design.
import gsap from 'gsap';
import { useCallback, useEffect, useRef } from 'react';
import './AnimatedCharacters.css';

interface Props {
  isTyping: boolean;
  showPassword: boolean;
  passwordLength: number;
  isPasswordGuardMode: boolean;
}

// Purple: tall building with blue glass windows, antenna, and rooftop details
const purpleStyle: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: '70px', width: '180px', height: '400px',
  backgroundColor: '#1a3a5c', borderRadius: '2px 2px 0 0', zIndex: 1,
  transformOrigin: 'bottom center', willChange: 'transform',
  overflow: 'visible',
};
// Black: battery/energy storage (rounded rectangle with terminals)
const blackStyle: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: '240px', width: '120px', height: '310px',
  backgroundColor: '#2D2D2D', borderRadius: '16px 16px 8px 8px', zIndex: 2,
  transformOrigin: 'bottom center', willChange: 'transform',
};
// Orange: solar panel array (wide flat body with tilted panels and mounting stand)
const orangeStyle: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, width: '240px', height: '200px',
  backgroundColor: 'transparent', zIndex: 3,
  transformOrigin: 'bottom center', willChange: 'transform',
};
// Yellow: solar panel character (round head + panel body)
const yellowStyle: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: '310px', width: '140px', height: '230px',
  backgroundColor: '#E8D754', borderRadius: '70px 70px 0 0', zIndex: 4,
  transformOrigin: 'bottom center', willChange: 'transform',
};
const purpleFaceStyle: React.CSSProperties = { position: 'absolute', display: 'flex', gap: '32px', left: '45px', top: '40px' };
const blackFaceStyle: React.CSSProperties = { position: 'absolute', display: 'flex', gap: '24px', left: '26px', top: '32px' };
const orangeFaceStyle: React.CSSProperties = { position: 'absolute', display: 'flex', gap: '32px', left: '82px', top: '10px' };
const yellowFaceStyle: React.CSSProperties = { position: 'absolute', display: 'flex', gap: '24px', left: '52px', top: '40px' };
const yellowMouthStyle: React.CSSProperties = {
  position: 'absolute', width: '80px', height: '4px', backgroundColor: '#2D2D2D',
  borderRadius: '9999px', left: '40px', top: '88px',
};
const smallEyeStyle: React.CSSProperties = { ...{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', willChange: 'height' }, width: '18px', height: '18px', backgroundColor: 'white' };
const blackEyeStyle: React.CSSProperties = { ...{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', willChange: 'height' }, width: '16px', height: '16px', backgroundColor: 'white' };
const smallPupilStyle: React.CSSProperties = { width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#2D2D2D', willChange: 'transform' };
const blackPupilStyle: React.CSSProperties = { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2D2D2D', willChange: 'transform' };
const dotPupilStyle: React.CSSProperties = { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#2D2D2D', willChange: 'transform' };

type QuickToFunc = gsap.QuickToFunc;
interface QuickTos {
  purpleSkew: QuickToFunc; blackSkew: QuickToFunc; orangeSkew: QuickToFunc; yellowSkew: QuickToFunc;
  purpleX: QuickToFunc; blackX: QuickToFunc; purpleHeight: QuickToFunc;
  purpleFaceLeft: QuickToFunc; purpleFaceTop: QuickToFunc; blackFaceLeft: QuickToFunc; blackFaceTop: QuickToFunc;
  orangeFaceX: QuickToFunc; orangeFaceY: QuickToFunc; yellowFaceX: QuickToFunc; yellowFaceY: QuickToFunc;
  mouthX: QuickToFunc; mouthY: QuickToFunc;
}

export function AnimatedCharacters({ isTyping, showPassword, passwordLength, isPasswordGuardMode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const purpleFaceRef = useRef<HTMLDivElement>(null);
  const blackFaceRef = useRef<HTMLDivElement>(null);
  const orangeFaceRef = useRef<HTMLDivElement>(null);
  const yellowFaceRef = useRef<HTMLDivElement>(null);
  const yellowMouthRef = useRef<HTMLDivElement>(null);

  const mouseRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef(0);
  const quickToRef = useRef<QuickTos | null>(null);
  const purpleBlinkTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const blackBlinkTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const purplePeekTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lookingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLookingRef = useRef(false);

  const isHidingPassword = passwordLength > 0 && !showPassword;
  const isShowingPassword = passwordLength > 0 && showPassword;

  const calcPos = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 3;
    const dx = mouseRef.current.x - cx;
    const dy = mouseRef.current.y - cy;
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  }, []);

  const calcEyePos = useCallback((el: HTMLElement, maxDist: number) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = mouseRef.current.x - cx;
    const dy = mouseRef.current.y - cy;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  }, []);

  const applyLookAtEachOther = useCallback(() => {
    const qt = quickToRef.current;
    if (qt) { qt.purpleFaceLeft(55); qt.purpleFaceTop(65); qt.blackFaceLeft(32); qt.blackFaceTop(12); }
    purpleRef.current?.querySelectorAll('.eyeball-pupil').forEach((p) => {
      gsap.to(p, { x: 3, y: 4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    });
    blackRef.current?.querySelectorAll('.eyeball-pupil').forEach((p) => {
      gsap.to(p, { x: 0, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    });
  }, []);

  const applyHidingPassword = useCallback(() => {
    const qt = quickToRef.current;
    if (qt) { qt.purpleFaceLeft(55); qt.purpleFaceTop(65); }
  }, []);

  const applyShowPassword = useCallback(() => {
    const qt = quickToRef.current;
    if (qt) {
      qt.purpleSkew(0); qt.blackSkew(0); qt.orangeSkew(0); qt.yellowSkew(0);
      qt.purpleX(0); qt.blackX(0); qt.purpleHeight(400);
      qt.purpleFaceLeft(20); qt.purpleFaceTop(35);
      qt.blackFaceLeft(10); qt.blackFaceTop(28);
      qt.orangeFaceX(50 - 82); qt.orangeFaceY(85 - 10);
      qt.yellowFaceX(20 - 52); qt.yellowFaceY(35 - 40);
      qt.mouthX(10 - 40); qt.mouthY(0);
    }
    purpleRef.current?.querySelectorAll('.eyeball-pupil').forEach((p) => {
      gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    });
    blackRef.current?.querySelectorAll('.eyeball-pupil').forEach((p) => {
      gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    });
    orangeRef.current?.querySelectorAll('.pupil').forEach((p) => {
      gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    });
    yellowRef.current?.querySelectorAll('.pupil').forEach((p) => {
      gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    });
  }, []);

  const applyPasswordGuardMode = useCallback(() => {
    const qt = quickToRef.current;
    if (qt) {
      qt.purpleSkew(0); qt.blackSkew(0); qt.orangeSkew(0); qt.yellowSkew(0);
      qt.purpleX(0); qt.blackX(0); qt.purpleHeight(400);
      qt.purpleFaceLeft(24); qt.purpleFaceTop(22);
      qt.blackFaceLeft(14); qt.blackFaceTop(20);
      qt.orangeFaceX(22 - 82); qt.orangeFaceY(72 - 10);
      qt.yellowFaceX(12 - 52); qt.yellowFaceY(22 - 40);
      qt.mouthX(-14); qt.mouthY(-8);
    }
    purpleRef.current?.querySelectorAll('.eyeball-pupil').forEach((p) => {
      gsap.to(p, { x: -5, y: -5, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
    });
    blackRef.current?.querySelectorAll('.eyeball-pupil').forEach((p) => {
      gsap.to(p, { x: -4, y: -4, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
    });
    orangeRef.current?.querySelectorAll('.pupil').forEach((p) => {
      gsap.to(p, { x: -5, y: -5, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
    });
    yellowRef.current?.querySelectorAll('.pupil').forEach((p) => {
      gsap.to(p, { x: -5, y: -5, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
    });
  }, []);

  const tick = useCallback(() => {
    const container = containerRef.current;
    const qt = quickToRef.current;
    if (!container || !qt) return;

    if (isPasswordGuardMode) {
      applyPasswordGuardMode();
      rafIdRef.current = requestAnimationFrame(tick);
      return;
    }

    if (purpleRef.current && !isShowingPassword) {
      const pp = calcPos(purpleRef.current);
      if (isTyping || isHidingPassword) {
        qt.purpleSkew(pp.bodySkew - 12); qt.purpleX(40); qt.purpleHeight(440);
      } else {
        qt.purpleSkew(pp.bodySkew); qt.purpleX(0); qt.purpleHeight(400);
      }
    }
    if (blackRef.current && !isShowingPassword) {
      const bp = calcPos(blackRef.current);
      if (isLookingRef.current) {
        qt.blackSkew(bp.bodySkew * 1.5 + 10); qt.blackX(20);
      } else if (isTyping || isHidingPassword) {
        qt.blackSkew(bp.bodySkew * 1.5); qt.blackX(0);
      } else {
        qt.blackSkew(bp.bodySkew); qt.blackX(0);
      }
    }
    if (orangeRef.current && !isShowingPassword) {
      const op = calcPos(orangeRef.current);
      qt.orangeSkew(op.bodySkew); qt.orangeFaceX(op.faceX); qt.orangeFaceY(op.faceY);
    }
    if (yellowRef.current && !isShowingPassword) {
      const yp = calcPos(yellowRef.current);
      qt.yellowSkew(yp.bodySkew); qt.yellowFaceX(yp.faceX); qt.yellowFaceY(yp.faceY);
      qt.mouthX(yp.faceX); qt.mouthY(yp.faceY);
    }
    if (purpleRef.current && !isShowingPassword && !isLookingRef.current) {
      const pp = calcPos(purpleRef.current);
      const fx = pp.faceX >= 0 ? Math.min(25, pp.faceX * 1.5) : pp.faceX;
      qt.purpleFaceLeft(45 + fx); qt.purpleFaceTop(40 + pp.faceY);
    }
    if (blackRef.current && !isShowingPassword && !isLookingRef.current) {
      const bp = calcPos(blackRef.current);
      qt.blackFaceLeft(26 + bp.faceX); qt.blackFaceTop(32 + bp.faceY);
    }
    if (!isShowingPassword) {
      container.querySelectorAll('.pupil').forEach((p) => {
        const el = p as HTMLElement;
        const maxDist = Number(el.dataset.maxDistance) || 5;
        const ePos = calcEyePos(el, maxDist);
        gsap.set(el, { x: ePos.x, y: ePos.y });
      });
      if (!isLookingRef.current) {
        container.querySelectorAll('.eyeball').forEach((eb) => {
          const el = eb as HTMLElement;
          const maxDist = Number(el.dataset.maxDistance) || 10;
          const pupil = el.querySelector('.eyeball-pupil') as HTMLElement | null;
          if (!pupil) return;
          const ePos = calcEyePos(el, maxDist);
          gsap.set(pupil, { x: ePos.x, y: ePos.y });
        });
      }
    }
    rafIdRef.current = requestAnimationFrame(tick);
  }, [isTyping, isHidingPassword, isShowingPassword, isPasswordGuardMode, calcPos, calcEyePos, applyPasswordGuardMode]);

  useEffect(() => {
    gsap.set('.pupil', { x: 0, y: 0 });
    gsap.set('.eyeball-pupil', { x: 0, y: 0 });

    if (!purpleRef.current || !blackRef.current || !orangeRef.current || !yellowRef.current
      || !purpleFaceRef.current || !blackFaceRef.current || !orangeFaceRef.current
      || !yellowFaceRef.current || !yellowMouthRef.current) return;

    quickToRef.current = {
      purpleSkew: gsap.quickTo(purpleRef.current, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      blackSkew: gsap.quickTo(blackRef.current, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      orangeSkew: gsap.quickTo(orangeRef.current, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      yellowSkew: gsap.quickTo(yellowRef.current, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      purpleX: gsap.quickTo(purpleRef.current, 'x', { duration: 0.3, ease: 'power2.out' }),
      blackX: gsap.quickTo(blackRef.current, 'x', { duration: 0.3, ease: 'power2.out' }),
      purpleHeight: gsap.quickTo(purpleRef.current, 'height', { duration: 0.3, ease: 'power2.out' }),
      purpleFaceLeft: gsap.quickTo(purpleFaceRef.current, 'left', { duration: 0.3, ease: 'power2.out' }),
      purpleFaceTop: gsap.quickTo(purpleFaceRef.current, 'top', { duration: 0.3, ease: 'power2.out' }),
      blackFaceLeft: gsap.quickTo(blackFaceRef.current, 'left', { duration: 0.3, ease: 'power2.out' }),
      blackFaceTop: gsap.quickTo(blackFaceRef.current, 'top', { duration: 0.3, ease: 'power2.out' }),
      orangeFaceX: gsap.quickTo(orangeFaceRef.current, 'x', { duration: 0.2, ease: 'power2.out' }),
      orangeFaceY: gsap.quickTo(orangeFaceRef.current, 'y', { duration: 0.2, ease: 'power2.out' }),
      yellowFaceX: gsap.quickTo(yellowFaceRef.current, 'x', { duration: 0.2, ease: 'power2.out' }),
      yellowFaceY: gsap.quickTo(yellowFaceRef.current, 'y', { duration: 0.2, ease: 'power2.out' }),
      mouthX: gsap.quickTo(yellowMouthRef.current, 'x', { duration: 0.2, ease: 'power2.out' }),
      mouthY: gsap.quickTo(yellowMouthRef.current, 'y', { duration: 0.2, ease: 'power2.out' }),
    };

    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove, { passive: true });
    rafIdRef.current = requestAnimationFrame(tick);

    const purpleEyeballs = purpleRef.current.querySelectorAll('.eyeball');
    const blackEyeballs = blackRef.current.querySelectorAll('.eyeball');

    const schedulePurpleBlink = () => {
      purpleBlinkTimerRef.current = setTimeout(() => {
        purpleEyeballs.forEach((el) => { gsap.to(el, { height: 2, duration: 0.08, ease: 'power2.in' }); });
        setTimeout(() => {
          purpleEyeballs.forEach((el) => {
            const size = Number((el as HTMLElement).style.width.replace('px', '')) || 18;
            gsap.to(el, { height: size, duration: 0.08, ease: 'power2.out' });
          });
          schedulePurpleBlink();
        }, 150);
      }, Math.random() * 4000 + 3000);
    };
    const scheduleBlackBlink = () => {
      blackBlinkTimerRef.current = setTimeout(() => {
        blackEyeballs.forEach((el) => { gsap.to(el, { height: 2, duration: 0.08, ease: 'power2.in' }); });
        setTimeout(() => {
          blackEyeballs.forEach((el) => {
            const size = Number((el as HTMLElement).style.width.replace('px', '')) || 16;
            gsap.to(el, { height: size, duration: 0.08, ease: 'power2.out' });
          });
          scheduleBlackBlink();
        }, 150);
      }, Math.random() * 4000 + 3000);
    };
    schedulePurpleBlink();
    scheduleBlackBlink();

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafIdRef.current);
      clearTimeout(purpleBlinkTimerRef.current);
      clearTimeout(blackBlinkTimerRef.current);
      clearTimeout(purplePeekTimerRef.current);
      clearTimeout(lookingTimerRef.current);
    };
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // React to state changes
  useEffect(() => {
    if (isPasswordGuardMode) { applyPasswordGuardMode(); }
    else if (isShowingPassword) { applyShowPassword(); }
    else if (isHidingPassword) { applyHidingPassword(); }
  }, [isHidingPassword, isShowingPassword, isPasswordGuardMode, applyPasswordGuardMode, applyShowPassword, applyHidingPassword]);

  useEffect(() => {
    if (isPasswordGuardMode) {
      clearTimeout(lookingTimerRef.current);
      isLookingRef.current = false;
      return;
    }
    if (isTyping && !isShowingPassword) {
      isLookingRef.current = true;
      applyLookAtEachOther();
      clearTimeout(lookingTimerRef.current);
      lookingTimerRef.current = setTimeout(() => {
        isLookingRef.current = false;
        purpleRef.current?.querySelectorAll('.eyeball-pupil').forEach((p) => { gsap.killTweensOf(p); });
      }, 800);
    } else {
      clearTimeout(lookingTimerRef.current);
      isLookingRef.current = false;
    }
  }, [isTyping, isShowingPassword, isPasswordGuardMode, applyLookAtEachOther]);

  // Purple peek behavior when password is shown
  useEffect(() => {
    if (isPasswordGuardMode || !isShowingPassword || passwordLength <= 0) {
      clearTimeout(purplePeekTimerRef.current);
      return;
    }
    const purpleEyePupils = purpleRef.current?.querySelectorAll('.eyeball-pupil');
    if (!purpleEyePupils?.length) return;

    const schedulePeek = () => {
      purplePeekTimerRef.current = setTimeout(() => {
        purpleEyePupils.forEach((p) => {
          gsap.to(p, { x: 4, y: 5, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        });
        const qt = quickToRef.current;
        if (qt) { qt.purpleFaceLeft(20); qt.purpleFaceTop(35); }
        setTimeout(() => {
          purpleEyePupils.forEach((p) => {
            gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
          });
          schedulePeek();
        }, 800);
      }, Math.random() * 3000 + 2000);
    };
    schedulePeek();
  }, [isShowingPassword, passwordLength, isPasswordGuardMode]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '550px', height: '400px' }}>
      {/* Purple: tall building with antenna, blue glass windows, rooftop, entrance */}
      <div ref={purpleRef} style={purpleStyle}>
        {/* Antenna / lightning rod on top */}
        <div style={{
          position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
          width: 4, height: 40, backgroundColor: '#888', borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute', top: -46, left: '50%', transform: 'translateX(-50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: 'radial-gradient(circle, #ff4444 0%, #cc0000 100%)',
          boxShadow: '0 0 6px #ff4444',
        }} />
        {/* Rooftop structure */}
        <div style={{
          position: 'absolute', top: 0, left: 10, right: 10, height: 30,
          backgroundColor: '#234b73', borderRadius: '2px 2px 0 0',
        }} />
        {/* Two columns of glass windows */}
        <div style={{ position: 'absolute', top: 45, left: 12, right: 12, bottom: 60, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                flex: 1, background: 'linear-gradient(180deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                borderRadius: 2, opacity: 0.65,
              }} />
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                flex: 1, background: 'linear-gradient(180deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                borderRadius: 2, opacity: 0.65,
              }} />
            ))}
          </div>
        </div>
        {/* Ground floor entrance */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 40, height: 50, backgroundColor: '#2d5a8a',
          borderRadius: '4px 4px 0 0',
          borderLeft: '2px solid #3b82f6', borderRight: '2px solid #3b82f6', borderTop: '2px solid #3b82f6',
        }} />
        <div ref={purpleFaceRef} style={purpleFaceStyle}>
          <div className="eyeball" data-max-distance="5" style={smallEyeStyle}>
            <div className="eyeball-pupil" style={smallPupilStyle} />
          </div>
          <div className="eyeball" data-max-distance="5" style={smallEyeStyle}>
            <div className="eyeball-pupil" style={smallPupilStyle} />
          </div>
        </div>
      </div>

      {/* Black: battery/energy storage with terminals and charge bars */}
      <div ref={blackRef} style={blackStyle}>
        {/* Top terminal */}
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          width: 36, height: 12, backgroundColor: '#555', borderRadius: '4px 4px 0 0',
        }} />
        {/* Plus/minus indicators */}
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          fontSize: 22, fontWeight: 800, color: '#ef4444', lineHeight: 1,
        }}>+</div>
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          fontSize: 22, fontWeight: 800, color: '#64748b', lineHeight: 1,
        }}>−</div>
        {/* Charge level bars */}
        <div style={{
          position: 'absolute', bottom: 70, left: 20, right: 20,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              height: 8, borderRadius: 4,
              background: i < 2 ? '#52c41a' : '#444',
            }} />
          ))}
        </div>
        <div ref={blackFaceRef} style={blackFaceStyle}>
          <div className="eyeball" data-max-distance="4" style={blackEyeStyle}>
            <div className="eyeball-pupil" style={blackPupilStyle} />
          </div>
          <div className="eyeball" data-max-distance="4" style={blackEyeStyle}>
            <div className="eyeball-pupil" style={blackPupilStyle} />
          </div>
        </div>
      </div>

      {/* Orange: solar panel array with tilted panels and mounting stand */}
      <div ref={orangeRef} style={orangeStyle}>
        {/* Mounting pole */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 8, height: 60, backgroundColor: '#888', borderRadius: 2,
        }} />
        {/* Base plate */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 60, height: 6, backgroundColor: '#666', borderRadius: 3,
        }} />
        {/* Tilted solar panel */}
        <div style={{
          position: 'absolute', bottom: 55, left: 10, right: 10, height: 110,
          backgroundColor: '#FF9B6B', borderRadius: 8,
          border: '2px solid #e88a5a',
          transform: 'perspective(300px) rotateX(8deg)',
          transformOrigin: 'bottom center',
          overflow: 'hidden',
        }}>
          {/* Panel grid lines */}
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, padding: 4 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg, rgba(30,64,175,0.35) 0%, rgba(59,130,246,0.25) 100%)',
                borderRadius: 1, border: '1px solid rgba(59,130,246,0.15)',
              }} />
            ))}
          </div>
          {/* Reflection highlight */}
          <div style={{
            position: 'absolute', top: -20, right: -20, width: 80, height: 80,
            background: 'rgba(255,255,255,0.12)', borderRadius: '50%',
            transform: 'rotate(45deg)',
          }} />
        </div>
        {/* Face sits on top of the panel */}
        <div ref={orangeFaceRef} style={{ ...orangeFaceStyle, top: 10 }}>
          <div className="pupil" data-max-distance="5" style={dotPupilStyle} />
          <div className="pupil" data-max-distance="5" style={dotPupilStyle} />
        </div>
      </div>

      {/* Yellow: solar panel character - round head with panel body below */}
      <div ref={yellowRef} style={yellowStyle}>
        {/* Solar panel grid below the round head */}
        <div style={{
          position: 'absolute', top: 110, left: 10, right: 10, bottom: 10,
          backgroundColor: '#1e40af', borderRadius: 6,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr',
          gap: 2, padding: 4,
        }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)',
            }} />
          ))}
        </div>
        <div ref={yellowFaceRef} style={yellowFaceStyle}>
          <div className="pupil" data-max-distance="5" style={dotPupilStyle} />
          <div className="pupil" data-max-distance="5" style={dotPupilStyle} />
        </div>
        <div ref={yellowMouthRef} style={yellowMouthStyle} />
      </div>
    </div>
  );
}
