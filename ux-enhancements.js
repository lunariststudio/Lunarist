(() => {
  const init = () => {
    document.documentElement.classList.add('ux-ready');

    // Add a subtle pointer-aware lift to interactive cards without hijacking clicks.
    const cards = document.querySelectorAll('.card, .artistcard, .panel');
    cards.forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        const r = card.getBoundingClientRect();
        const x = ((event.clientX - r.left) / r.width - 0.5) * 2;
        const y = ((event.clientY - r.top) / r.height - 0.5) * 2;
        card.style.setProperty('--ux-rx', `${(-y * 1.2).toFixed(2)}deg`);
        card.style.setProperty('--ux-ry', `${(x * 1.2).toFixed(2)}deg`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--ux-rx');
        card.style.removeProperty('--ux-ry');
      });
    });

    // Keep keyboard users visually supported.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') document.documentElement.classList.add('ux-keyboard');
    }, { passive: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
