// ============================================================================
// MUNCHIES - MAIN JAVASCRIPT (3D PAGE TRANSITIONS, SVG CENTER ARROWS, & 3D POPUP)
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // ==========================================================================
  // 0. OTOMATIS GANTI SEMUA TANDA PANAH & TOMBOL SILANG MENJADI IKON SVG CENTER!
  //    (Memperbaiki panah di index.html, menu.html, dan franchise.html sekaligus)
  // ==========================================================================
  const SVG_CHEVRON_LEFT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  const SVG_CHEVRON_RIGHT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  const SVG_CHEVRON_DOWN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  const SVG_CLOSE_X =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  document.querySelectorAll('.slider-arrow.prev, .modal-side-btn.prev').forEach((btn) => {
    btn.innerHTML = SVG_CHEVRON_LEFT;
  });
  document.querySelectorAll('.slider-arrow.next, .modal-side-btn.next').forEach((btn) => {
    btn.innerHTML = SVG_CHEVRON_RIGHT;
  });
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.innerHTML = SVG_CLOSE_X;
  });
  document.querySelectorAll('.franchise-arrow-btn').forEach((btn) => {
    btn.innerHTML = SVG_CHEVRON_DOWN;
  });

  // Pastikan tidak ada badge "Klik 3 Varian" yang tersisa
  document.querySelectorAll('.menu-3d-badge').forEach((b) => b.remove());

  // ==========================================================================
  // 1. ANIMASI 3D SAAT GANTI HALAMAN (3D PERSPECTIVE PAGE TRANSITION)
  // ==========================================================================
  const mainSections = document.querySelectorAll('section, footer');
  mainSections.forEach((sec) => sec.classList.add('page-3d-stage'));

  // Pastikan saat tombol Back browser ditekan, halaman tetap tampil normal
  window.addEventListener('pageshow', () => {
    document.body.classList.remove('is-leaving-3d');
  });

  const navbarLinks = document.querySelectorAll('.navbar-link');
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  navbarLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Tangani klik pindah halaman dengan animasi 3D Exit yang mulus
  document.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || this.target === '_blank' || href.startsWith('mailto:') || href.startsWith('http')) {
        return;
      }

      // Jika anchor menuju #outlet di halaman yang sama (index.html)
      if (href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const navbar = document.querySelector('.navbar');
          const navbarHeight = navbar ? navbar.offsetHeight : 80;
          window.scrollTo({
            top: target.offsetTop - navbarHeight,
            behavior: 'smooth'
          });
        }
        return;
      }

      // Jika mengklik link halaman yang sedang aktif saat ini (tanpa hash), scroll ke atas
      const targetPageOnly = href.split('#')[0];
      if (targetPageOnly === currentPage && !href.includes('#')) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Jalankan animasi 3D Page Exit sebelum pindah halaman
      e.preventDefault();
      document.body.classList.add('is-leaving-3d');
      setTimeout(() => {
        window.location.href = href;
      }, 250);
    });
  });

  // ==========================================================================
  // 2. MESIN 3D TILT, PARALLAX, & SPOTLIGHT GLARE (UNTUK HERO & KARTU)
  // ==========================================================================
  function attach3DTiltEffect(elements, options = {}) {
    if (isTouchDevice) return;
    const maxTilt = options.maxTilt || 7;
    const parallaxShift = options.parallax || 10;

    elements.forEach((el) => {
      el.classList.add('has-3d-tilt');

      const glareContainer = el.querySelector('.menu-card-bg') || el;
      if (!glareContainer.querySelector('.glare-3d-layer')) {
        const glare = document.createElement('div');
        glare.className = 'glare-3d-layer';
        glareContainer.appendChild(glare);
      }

      let targetRX = 0;
      let targetRY = 0;
      let currentRX = 0;
      let currentRY = 0;
      let targetPX = 0;
      let targetPY = 0;
      let currentPX = 0;
      let currentPY = 0;
      let rafId = null;

      function updateTiltFrame() {
        currentRX += (targetRX - currentRX) * 0.14;
        currentRY += (targetRY - currentRY) * 0.14;
        currentPX += (targetPX - currentPX) * 0.14;
        currentPY += (targetPY - currentPY) * 0.14;

        el.style.setProperty('--rx', `${currentRX.toFixed(2)}deg`);
        el.style.setProperty('--ry', `${currentRY.toFixed(2)}deg`);
        el.style.setProperty('--px', `${currentPX.toFixed(1)}px`);
        el.style.setProperty('--py', `${currentPY.toFixed(1)}px`);

        if (
          Math.abs(targetRX - currentRX) > 0.02 ||
          Math.abs(targetRY - currentRY) > 0.02 ||
          Math.abs(targetPX - currentPX) > 0.1
        ) {
          rafId = requestAnimationFrame(updateTiltFrame);
        } else {
          rafId = null;
        }
      }

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;

        const normX = (relX - 0.5) * 2;
        const normY = (relY - 0.5) * 2;

        targetRY = normX * maxTilt;
        targetRX = -normY * maxTilt;
        targetPX = normX * parallaxShift;
        targetPY = normY * parallaxShift;

        el.style.setProperty('--gx', `${(relX * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(relY * 100).toFixed(1)}%`);

        if (!rafId) {
          rafId = requestAnimationFrame(updateTiltFrame);
        }
      });

      el.addEventListener('mouseleave', () => {
        targetRX = 0;
        targetRY = 0;
        targetPX = 0;
        targetPY = 0;
        if (!rafId) {
          rafId = requestAnimationFrame(updateTiltFrame);
        }
      });
    });
  }

  attach3DTiltEffect(document.querySelectorAll('.hero-slider-wrapper'), { maxTilt: 3.5, parallax: 14 });
  attach3DTiltEffect(document.querySelectorAll('.outlet-item'), { maxTilt: 4.5, parallax: 8 });
  attach3DTiltEffect(document.querySelectorAll('.menu-card'), { maxTilt: 11.0, parallax: 14 });
  attach3DTiltEffect(document.querySelectorAll('.franchise-card'), { maxTilt: 5.0, parallax: 8 });

  // ==========================================================================
  // 3. ANIMASI SCROLL-REVEAL 3D (SAAT HALAMAN DIGULIR KE BAWAH)
  // ==========================================================================
  const revealTargets = document.querySelectorAll(
    '.outlet-item, .menu-card, .franchise-card, .franchise-sim-cta-outside'
  );

  if ('IntersectionObserver' in window && revealTargets.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed-3d');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -30px 0px' }
    );

    revealTargets.forEach((item, idx) => {
      item.classList.add('reveal-3d-item');
      item.style.transitionDelay = `${(idx % 3) * 0.09}s`;
      revealObserver.observe(item);
    });
  }

  // ==========================================================================
  // 4. SEAMLESS INFINITE HERO SLIDER + GLASS PAGINATION PILLS
  // ==========================================================================
  const heroSliderWrapper = document.querySelector('.hero-slider-wrapper');
  const heroSlider = document.querySelector('.hero-slider');
  const origSlides = Array.from(document.querySelectorAll('.hero-slide'));
  const prevBtn = document.querySelector('.slider-arrow.prev');
  const nextBtn = document.querySelector('.slider-arrow.next');

  if (heroSlider && origSlides.length > 1) {
    const realCount = origSlides.length;

    // Buat Indikator Pill Minimalis di Bawah Tengah Slider
    let pillDots = [];
    if (heroSliderWrapper && !heroSliderWrapper.querySelector('.hero-pagination-pills')) {
      const pillsWrap = document.createElement('div');
      pillsWrap.className = 'hero-pagination-pills';
      for (let i = 0; i < realCount; i++) {
        const dot = document.createElement('button');
        dot.className = `hero-pill-dot${i === 0 ? ' active' : ''}`;
        dot.setAttribute('aria-label', `Slide ${i + 1}`);
        pillsWrap.appendChild(dot);
        pillDots.push(dot);
      }
      heroSliderWrapper.appendChild(pillsWrap);
    }

    const firstClone = origSlides[0].cloneNode(true);
    const lastClone = origSlides[realCount - 1].cloneNode(true);
    firstClone.dataset.clone = 'first';
    lastClone.dataset.clone = 'last';

    heroSlider.insertBefore(lastClone, origSlides[0]);
    heroSlider.appendChild(firstClone);

    const allSlides = Array.from(heroSlider.querySelectorAll('.hero-slide'));
    const totalTrackCount = allSlides.length;

    heroSlider.style.width = `${totalTrackCount * 100}%`;
    allSlides.forEach((sl) => {
      sl.style.width = `${100 / totalTrackCount}%`;
    });

    let trackIndex = 1;
    let isTransitioning = false;
    let autoSlideInterval = null;
    let safetyTimer = null;

    const SLIDE_TRANSITION = 'transform 0.72s cubic-bezier(0.22, 1, 0.36, 1)';

    function syncActiveStates() {
      const realIdx = (trackIndex - 1 + realCount) % realCount;
      allSlides.forEach((sl, idx) => {
        sl.classList.toggle('is-active-slide', idx === trackIndex);
      });
      pillDots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === realIdx);
      });
    }

    function setTrackPosition(withAnimation = true) {
      heroSlider.style.transition = withAnimation ? SLIDE_TRANSITION : 'none';
      const offsetPct = -(trackIndex * (100 / totalTrackCount));
      heroSlider.style.transform = `translate3d(${offsetPct}%, 0, 0)`;
      syncActiveStates();
    }

    function snapIfOnClone() {
      clearTimeout(safetyTimer);
      if (trackIndex >= totalTrackCount - 1) {
        trackIndex = 1;
        setTrackPosition(false);
        void heroSlider.offsetWidth;
      } else if (trackIndex <= 0) {
        trackIndex = realCount;
        setTrackPosition(false);
        void heroSlider.offsetWidth;
      }
      isTransitioning = false;
    }

    function moveNextSlide() {
      if (isTransitioning) snapIfOnClone();
      isTransitioning = true;
      trackIndex++;
      setTrackPosition(true);
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(snapIfOnClone, 760);
    }

    function movePrevSlide() {
      if (isTransitioning) snapIfOnClone();
      isTransitioning = true;
      trackIndex--;
      setTrackPosition(true);
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(snapIfOnClone, 760);
    }

    heroSlider.addEventListener('transitionend', (e) => {
      if (e.target === heroSlider) snapIfOnClone();
    });

    function startAutoSlide() {
      clearInterval(autoSlideInterval);
      autoSlideInterval = setInterval(moveNextSlide, 5000);
    }

    function stopAutoSlide() {
      clearInterval(autoSlideInterval);
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveNextSlide();
        startAutoSlide();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        movePrevSlide();
        startAutoSlide();
      });
    }

    pillDots.forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isTransitioning) snapIfOnClone();
        trackIndex = idx + 1;
        setTrackPosition(true);
        startAutoSlide();
      });
    });

    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
      heroSection.addEventListener('mouseenter', stopAutoSlide);
      heroSection.addEventListener('mouseleave', startAutoSlide);
    }

    let touchStartX = 0;
    let touchDiffX = 0;
    heroSlider.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchDiffX = 0;
          stopAutoSlide();
        }
      },
      { passive: true }
    );

    heroSlider.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 1) {
          touchDiffX = e.touches[0].clientX - touchStartX;
        }
      },
      { passive: true }
    );

    heroSlider.addEventListener('touchend', () => {
      if (Math.abs(touchDiffX) > 45) {
        if (touchDiffX < 0) moveNextSlide();
        else movePrevSlide();
      }
      startAutoSlide();
    });

    allSlides.forEach((slide) => {
      slide.style.cursor = 'pointer';
      slide.addEventListener('click', function () {
        if (Math.abs(touchDiffX) < 12) {
          document.body.classList.add('is-leaving-3d');
          setTimeout(() => {
            window.location.href = 'menu.html';
          }, 240);
        }
      });
    });

    setTrackPosition(false);
    startAutoSlide();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        movePrevSlide();
        startAutoSlide();
      }
      if (e.key === 'ArrowRight') {
        moveNextSlide();
        startAutoSlide();
      }
    });
  }

  // ==========================================================================
  // 5. MENU PAGE & MODAL POPUP 3D (DENGAN 9 FILE .PNG TRANSPARAN BARU)
  // ==========================================================================
  const menuCards = document.querySelectorAll('.menu-card');
  const modalOverlay = document.querySelector('.modal-overlay');
  const modalContent = document.querySelector('.modal-content');
  const modalClose = document.querySelector('.modal-close');
  const modalNavPrev = document.querySelector('.modal-side-btn.prev');
  const modalNavNext = document.querySelector('.modal-side-btn.next');
  const modalImage = document.querySelector('.modal-image');
  const modalTitle = document.querySelector('.modal-title');
  const modalDescription = document.querySelector('.modal-description');
  const modalBody = document.querySelector('.modal-body');

  let variantPillsContainer = null;
  if (modalBody) {
    variantPillsContainer = document.createElement('div');
    variantPillsContainer.className = 'modal-variant-pills';
    modalBody.appendChild(variantPillsContainer);
  }

  let currentModalData = null;
  let currentVariantIndex = 0;
  let isModalSwitching = false;

  const modalData = {
    'pisang-goreng': {
      titleBase: 'Pisang Goreng',
      variants: [
        {
          name: 'Original',
          desc: 'Pisang goreng yang luarnya kriuk-kriuk, dalemnya lembut, ditabur palm sugar yang wangi dan meleleh.',
          image: 'pg_original.png',
          glowColor: 'rgba(170, 118, 65, 0.48)',
          titleParts: [{ text: 'Original', color: '#AA7641' }]
        },
        {
          name: 'Coklat Regal',
          desc: 'Pisang goreng yang luarnya kriuk-kriuk, dalemnya lembut, disiram coklat lumer, dan remahan regal yang buaanyaaak.',
          image: 'pg_regal.png',
          glowColor: 'rgba(180, 51, 0, 0.44)',
          titleParts: [
            { text: 'Coklat', color: '#B43300' },
            { text: 'Regal', color: '#D79577' }
          ]
        },
        {
          name: 'Chocomaltine Cheese',
          desc: 'Pisang goreng yang luarnya kriuk-kriuk, dalemnya lembut, dikasih chocomaltine yang lumer manis, dan keju parut berlimpah.',
          image: 'pg_chocomaltine.png',
          glowColor: 'rgba(104, 59, 13, 0.48)',
          titleParts: [
            { text: 'Chocomaltine', color: '#683B0D' },
            { text: 'Cheese', color: '#e09943' }
          ]
        }
      ]
    },
    'roti-bakar': {
      titleBase: 'Roti Bakar',
      variants: [
        {
          name: 'Choco Crunchy',
          desc: 'Roti bakar dengan lapisan luar renyah dan lapisan dalam yang lembut, diolesi coklat cair yang dicampur malt crunchy di setiap gigitan.',
          image: 'rb_choco.png',
          glowColor: 'rgba(82, 54, 26, 0.48)',
          titleParts: [{ text: 'Choco Crunchy', color: '#52361A' }]
        },
        {
          name: 'Srikaya',
          desc: 'Roti bakar dengan lapisan luar renyah dan lapisan dalam yang lembut, serta olesan srikaya yang lumer.',
          image: 'rb_srikaya.png',
          glowColor: 'rgba(248, 146, 43, 0.46)',
          titleParts: [{ text: 'Srikaya', color: '#F8922B' }]
        },
        {
          name: 'Keju',
          desc: 'Roti bakar dengan lapisan luar renyah dan lapisan dalam yang lembut, lalu ditaburi keju parut berlimpah.',
          image: 'rb_keju.png',
          glowColor: 'rgba(240, 168, 75, 0.50)',
          titleParts: [{ text: 'Keju', color: '#e09943' }]
        }
      ]
    },
    'pancong-lumer': {
      titleBase: 'Pancong Lumer',
      variants: [
        {
          name: 'Choco Crunchy',
          desc: 'Pancong lumer yang lembut dengan topping coklat cair yang dicampur malt crunchy di setiap gigitan.',
          image: 'pl_choco.png',
          glowColor: 'rgba(82, 54, 26, 0.48)',
          titleParts: [{ text: 'Choco Crunchy', color: '#52361A' }]
        },
        {
          name: 'Tiramisu',
          desc: 'Pancong lumer yang lembut dengan topping tiramisu yang creamy.',
          image: 'pl_tiramisu.png',
          glowColor: 'rgba(215, 166, 107, 0.50)',
          titleParts: [{ text: 'Tiramisu', color: '#c48b45' }]
        },
        {
          name: 'Coklat Keju',
          desc: 'Pancong lumer yang lembut dengan topping coklat cair dan keju parut di atasnya.',
          image: 'pl_coklat_keju.png',
          glowColor: 'rgba(180, 51, 0, 0.45)',
          titleParts: [
            { text: 'Coklat', color: '#B43300' },
            { text: 'Keju', color: '#e09943' }
          ]
        }
      ]
    }
  };

  function openModal(menuType, variantIndex = 0) {
    const data = modalData[menuType];
    if (!data || !modalOverlay) return;

    currentModalData = data;
    currentVariantIndex = variantIndex;
    updateModalContent();

    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentModalData = null;
  }

  function updateModalContent() {
    if (!currentModalData || !modalImage || !modalTitle || !modalDescription) return;

    const variant = currentModalData.variants[currentVariantIndex];
    modalImage.src = variant.image;
    modalImage.alt = variant.name;

    if (modalContent && variant.glowColor) {
      modalContent.style.setProperty('--flavor-glow', variant.glowColor);
    }

    modalTitle.innerHTML = '';
    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.flexDirection = 'column';
    titleContainer.style.gap = '4px';

    const baseTitle = document.createElement('span');
    baseTitle.className = 'word-3d-pop';
    baseTitle.textContent = currentModalData.titleBase;
    baseTitle.style.color = '#AA7641';
    baseTitle.style.fontWeight = '800';
    titleContainer.appendChild(baseTitle);

    const variantTitle = document.createElement('span');
    variantTitle.style.display = 'flex';
    variantTitle.style.flexWrap = 'wrap';
    variantTitle.style.gap = '8px';
    variantTitle.style.fontWeight = '800';
    variantTitle.style.fontSize = '1.65rem';

    variant.titleParts.forEach((part, idx) => {
      const span = document.createElement('span');
      span.className = 'word-3d-pop';
      span.style.animationDelay = `${(idx + 1) * 0.08}s`;
      span.textContent = part.text;
      span.style.color = part.color;
      variantTitle.appendChild(span);
    });

    titleContainer.appendChild(variantTitle);
    modalTitle.appendChild(titleContainer);
    modalDescription.textContent = variant.desc;

    if (variantPillsContainer) {
      variantPillsContainer.innerHTML = '';
      currentModalData.variants.forEach((vItem, vIdx) => {
        const pill = document.createElement('button');
        pill.className = `variant-pill-btn${vIdx === currentVariantIndex ? ' active' : ''}`;
        pill.textContent = vItem.name;
        pill.addEventListener('click', () => {
          if (vIdx !== currentVariantIndex) {
            switchToVariantIndex(vIdx);
          }
        });
        variantPillsContainer.appendChild(pill);
      });
    }

    if (modalNavPrev) modalNavPrev.style.display = 'flex';
    if (modalNavNext) modalNavNext.style.display = 'flex';
  }

  function switchToVariantIndex(targetIdx, customDir = null) {
    if (!currentModalData || isModalSwitching) return;
    const totalV = currentModalData.variants.length;
    const wrappedIdx = (targetIdx + totalV) % totalV;
    if (wrappedIdx === currentVariantIndex) return;

    const dir = customDir !== null ? customDir : (wrappedIdx > currentVariantIndex ? 1 : -1);
    isModalSwitching = true;
    const animClass = dir > 0 ? 'modal-3d-switching-next' : 'modal-3d-switching-prev';
    if (modalContent) modalContent.classList.add(animClass);

    setTimeout(() => {
      currentVariantIndex = wrappedIdx;
      updateModalContent();
      if (modalContent) modalContent.classList.remove(animClass);
      setTimeout(() => {
        isModalSwitching = false;
      }, 220);
    }, 180);
  }

  function navigateModal(direction) {
    if (!currentModalData) return;
    switchToVariantIndex(currentVariantIndex + direction, direction);
  }

  menuCards.forEach((card) => {
    card.addEventListener('click', function () {
      const menuType = this.dataset.menu;
      if (menuType) openModal(menuType, 0);
    });
  });

  if (modalContent && modalImage && !isTouchDevice) {
    modalContent.addEventListener('mousemove', (e) => {
      const rect = modalContent.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

      modalContent.style.setProperty('--mBoxRY', `${(nx * 5.0).toFixed(2)}deg`);
      modalContent.style.setProperty('--mBoxRX', `${(-ny * 5.0).toFixed(2)}deg`);
      modalImage.style.setProperty('--mry', `${(nx * 14.0).toFixed(2)}deg`);
      modalImage.style.setProperty('--mrx', `${(-ny * 14.0).toFixed(2)}deg`);
      modalImage.style.setProperty('--mScale', '1.14');
      modalContent.style.setProperty('--shX', `${(-nx * 18).toFixed(1)}px`);
      modalContent.style.setProperty('--shY', `${(18 - ny * 14).toFixed(1)}px`);
    });

    modalContent.addEventListener('mouseleave', () => {
      modalContent.style.setProperty('--mBoxRY', '0deg');
      modalContent.style.setProperty('--mBoxRX', '0deg');
      modalImage.style.setProperty('--mry', '0deg');
      modalImage.style.setProperty('--mrx', '0deg');
      modalImage.style.setProperty('--mScale', '1.06');
      modalContent.style.setProperty('--shX', '0px');
      modalContent.style.setProperty('--shY', '18px');
    });
  }

  if (modalContent) {
    let modalTouchX = 0;
    let modalSwipeDX = 0;
    modalContent.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          modalTouchX = e.touches[0].clientX;
          modalSwipeDX = 0;
        }
      },
      { passive: true }
    );
    modalContent.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 1) {
          modalSwipeDX = e.touches[0].clientX - modalTouchX;
        }
      },
      { passive: true }
    );
    modalContent.addEventListener('touchend', () => {
      if (Math.abs(modalSwipeDX) > 45) {
        if (modalSwipeDX < 0) navigateModal(1);
        else navigateModal(-1);
      }
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalNavPrev) modalNavPrev.addEventListener('click', () => navigateModal(-1));
  if (modalNavNext) modalNavNext.addEventListener('click', () => navigateModal(1));

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!modalOverlay || !modalOverlay.classList.contains('active')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') navigateModal(-1);
    if (e.key === 'ArrowRight') navigateModal(1);
  });

  // ==========================================================================
  // 6. FRANCHISE DROPDOWN ACCORDION
  // ==========================================================================
  const franchiseArrowBtns = document.querySelectorAll('.franchise-arrow-btn');

  franchiseArrowBtns.forEach((btn) => {
    btn.addEventListener('click', function () {
      const card = this.closest('.franchise-card');
      const details = card ? card.querySelector('.franchise-details') : null;
      if (!details) return;

      const listItems = details.querySelectorAll('li');
      listItems.forEach((li, idx) => {
        li.style.transitionDelay = `${idx * 0.04}s`;
      });

      const isOpen = details.classList.contains('open');
      if (isOpen) {
        details.classList.remove('open');
        this.classList.remove('rotated');
      } else {
        details.classList.add('open');
        this.classList.add('rotated');
      }
    });
  });

  // ==========================================================================
  // 7. EFEK BAYANGAN NAVBAR SAAT DI-SCROLL
  // ==========================================================================
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 6px 24px rgba(80, 52, 24, 0.2)';
      } else {
        navbar.style.boxShadow = '0 4px 18px rgba(80, 52, 24, 0.14)';
      }
    });
  }
});