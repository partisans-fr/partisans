// Animations de la maquette, par l'API Web Animations : entrées à l'écran (data-anim), coche des
// cases, « ✓ Suivi » qui se retourne. Tant que le script ne les a pas posées, tout est visible à
// sa place : aucune règle de la feuille ne cache un élément en attente d'animation.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// delay : départ du premier élément ; step : décalage de chacun des suivants, dans l'ordre de lecture.
const ENTRANCES = {
  rise: { keyframes: [{ translate: '0 75%' }, { translate: '0 -3%', offset: 0.8 }, { translate: '0 0' }], duration: 700, easing: 'cubic-bezier(.2,.8,.3,1)', delay: 100, step: 0 },
  line: { keyframes: [{ transform: 'translateY(110%)' }, { transform: 'none' }], duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)', delay: 220, step: 110 },
  drop: { keyframes: [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)', delay: 0, step: 90 },
  sweep: { keyframes: [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }], duration: 560, easing: 'cubic-bezier(.7,0,.3,1)', delay: 260, step: 0 },
};

// Le poing et les lignes de titre partent hors de leur découpe (overflow: hidden) : l'observateur
// ne les verrait jamais à 20 %, il surveille donc leur parent.
const triggerOf = (element) => (['rise', 'line'].includes(element.dataset.anim) ? element.parentElement : element);

let observer = null;

// Pose chaque entrée à son état de départ, en pause, et la joue une fois, quand son déclencheur
// entre à l'écran. fill: 'backwards' rend la main à la feuille une fois l'animation finie (le
// soulèvement des cartes au survol reste possible).
export function revealOnEntry(root) {
  observer?.disconnect();
  if (reducedMotion.matches) return;
  const pending = new Map();
  for (const element of root.querySelectorAll('[data-anim]')) {
    const entrance = ENTRANCES[element.dataset.anim];
    if (!entrance) continue;
    const animation = element.animate(entrance.keyframes, { duration: entrance.duration, easing: entrance.easing, delay: entrance.delay, fill: 'backwards' });
    animation.pause();
    const trigger = triggerOf(element);
    pending.set(trigger, [...(pending.get(trigger) ?? []), { element, animation, entrance }]);
  }
  observer = new IntersectionObserver((entries) => {
    const entered = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
    const rank = {};
    for (const { target } of entered) {
      for (const { element, animation, entrance } of pending.get(target) ?? []) {
        const kind = element.dataset.anim;
        rank[kind] = (rank[kind] ?? -1) + 1;
        animation.effect.updateTiming({ delay: entrance.delay + rank[kind] * entrance.step });
        animation.play();
      }
      pending.delete(target);
      observer.unobserve(target);
    }
  }, { threshold: 0.2 });
  for (const trigger of pending.keys()) observer.observe(trigger);
}

// Pose l'ancien aspect d'un élément refait, sans transition, avant de le laisser glisser vers le nouveau.
export function startFrom(element, applyOldLook) {
  element.style.transition = 'none';
  applyOldLook();
  element.getBoundingClientRect();
  element.style.transition = '';
}

// Case cochée ou décochée : le fond glisse depuis l'ancien état, la coche apparaît en tampon.
export function playToggle(label) {
  if (!label || reducedMotion.matches) return;
  startFrom(label, () => label.classList.add('bascule'));
  label.classList.remove('bascule');
  label.querySelector('.coche')?.animate([{ transform: 'scale(1.8) rotate(-12deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 140, easing: 'cubic-bezier(.3,1.4,.5,1)' });
}

// « ✓ Suivi » se retourne quand il remplace « Suivre ».
export function playFollowed(row) {
  if (!row || reducedMotion.matches) return;
  row.querySelector('.suivi')?.animate([{ transform: 'perspective(200px) rotateX(90deg)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
