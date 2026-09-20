// Floating "scroll to top" button: shown once the page has scrolled past a
// threshold, hidden (and untabbable) at the top. See #134.
const SHOW_THRESHOLD_PX = 400;

export function initScrollToTop() {
    const button = document.getElementById('scrollToTopBtn');
    if (!button) {
        return;
    }

    // The scroll listener fires far more often than the browser can paint, so
    // only act on the next animation frame and drop everything in between.
    let ticking = false;

    function updateVisibility() {
        ticking = false;
        button.classList.toggle('visible', window.scrollY > SHOW_THRESHOLD_PX);
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(updateVisibility);
        }
    }, { passive: true });

    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
    });

    updateVisibility();
}
