(() => {
  const init = () => {
    document.documentElement.classList.add('ux-ready');

    // Subtle pointer-aware depth for cards.
    document.querySelectorAll('.card, .artistcard, .panel').forEach((card) => {
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

    // Add a tiny stagger to modal children when a modal opens.
    const modalObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
        const modal = mutation.target;
        if (!modal.classList.contains('modal') || !modal.classList.contains('open')) return;
        const box = modal.querySelector('.modalbox');
        if (!box) return;
        box.querySelectorAll(':scope > *').forEach((child, index) => {
          child.style.setProperty('--ux-delay', `${Math.min(index * 45, 225)}ms`);
          child.classList.add('ux-modal-child');
        });
      });
    });
    document.querySelectorAll('.modal').forEach((modal) => modalObserver.observe(modal, { attributes: true }));

    // Keep keyboard users visually supported.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') document.documentElement.classList.add('ux-keyboard');
    }, { passive: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
