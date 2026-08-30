/**
 * Case Diary marketing site
 */
import QRCode from "qrcode";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.umairbutt.legaldiary";
const IOS_APP_STORE_URL =
  "https://apps.apple.com/app/case-diary-for-lawyers/id6786853969";

const STORE_QR_URLS = {
  play: PLAY_STORE_URL,
  ios: IOS_APP_STORE_URL,
};

const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

function wireIosButtons(url) {
  const buttons = [
    document.getElementById("ios-store-btn"),
    ...document.querySelectorAll("[data-ios-mirror]"),
  ].filter(Boolean);

  for (const btn of buttons) {
    if (!url) continue;
    btn.href = url;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.classList.remove("store-btn--soon");
    btn.removeAttribute("aria-disabled");
    const small = btn.querySelector("small");
    if (small) small.textContent = "Download on the";
  }
}

wireIosButtons(IOS_APP_STORE_URL.trim());

const toggle = document.querySelector(".nav-toggle");
const mobileNav = document.getElementById("mobile-nav");

if (toggle && mobileNav) {
  toggle.addEventListener("click", () => {
    const open = mobileNav.hasAttribute("hidden") === false;
    if (open) {
      mobileNav.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    } else {
      mobileNav.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    }
  });

  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileNav.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    });
  });
}

const iosBtn = document.getElementById("ios-store-btn");
if (iosBtn && !IOS_APP_STORE_URL.trim()) {
  iosBtn.addEventListener("click", (event) => {
    event.preventDefault();
  });
}

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function initScrollReveals() {
  const revealEls = document.querySelectorAll(".reveal-on-scroll");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  revealEls.forEach((el) => observer.observe(el));
}

function initStaggerGroups() {
  document.querySelectorAll("[data-stagger]").forEach((group) => {
    [...group.children].forEach((kid, index) => {
      kid.classList.add("reveal-on-scroll");
      if (!kid.hasAttribute("data-delay")) {
        kid.setAttribute("data-delay", String((index % 4) + 1));
      }
      if (!kid.hasAttribute("data-reveal") && index % 2 === 1) {
        kid.setAttribute("data-reveal", "scale");
      }
    });
  });
}

function initHeroShotCarousel() {
  const shots = [...document.querySelectorAll("[data-hero-shot]")];
  if (shots.length < 2 || prefersReducedMotion) return;

  let index = 0;
  window.setInterval(() => {
    shots[index].classList.remove("is-active");
    index = (index + 1) % shots.length;
    shots[index].classList.add("is-active");
  }, 3200);
}

function initHeroParallax() {
  const phone = document.querySelector(".phone--hero");
  const hero = document.querySelector(".hero");
  if (!phone || !hero || prefersReducedMotion) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  let raf = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const tick = () => {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    phone.style.setProperty("--tilt-x", `${currentY.toFixed(2)}deg`);
    phone.style.setProperty("--tilt-y", `${currentX.toFixed(2)}deg`);
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    targetX = px * 8;
    targetY = py * -6;
  });

  hero.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
  });

  window.addEventListener(
    "beforeunload",
    () => cancelAnimationFrame(raf),
    { once: true }
  );
}

function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initFloatDelays() {
  document.querySelectorAll(".feature-block .phone--shot").forEach((phone, i) => {
    phone.classList.add("anim-float");
    phone.style.setProperty("--float-delay", `${(i % 3) * 0.7}s`);
  });
}

async function initStoreQrCodes() {
  const canvases = document.querySelectorAll("[data-store-qr]");
  const jobs = [...canvases].map(async (canvas) => {
    const key = canvas.getAttribute("data-store-qr");
    const url = STORE_QR_URLS[key];
    if (!url) return;

    try {
      await QRCode.toCanvas(canvas, url, {
        width: 150,
        margin: 1,
        color: {
          dark: "#0b1220",
          light: "#ffffff",
        },
      });
    } catch (error) {
      console.error("Failed to render store QR code", error);
    }
  });

  await Promise.all(jobs);
}

initStaggerGroups();
initScrollReveals();
initHeroShotCarousel();
initHeroParallax();
initHeaderScroll();
initFloatDelays();
initStoreQrCodes();
