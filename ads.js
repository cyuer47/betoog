// ads.js – Google AdSense integratie met fallback demo
// ======================================================

"use strict";

(function initAdsModule() {
  // Controleer cookie-consent
  function hasConsent() {
    try {
      return localStorage.getItem("cookie-consent") === "accepted";
    } catch {
      return false;
    }
  }

  // Laad Google AdSense script dynamisch
  function loadAdSenseScript(pubId) {
    return new Promise((resolve, reject) => {
      // Voorkom dubbel laden
      if (document.querySelector("script[data-adsense]")) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.setAttribute("data-adsense", "true");
      script.onload = () => resolve(true);
      script.onerror = () =>
        reject(new Error("AdSense script kon niet worden geladen"));
      document.head.appendChild(script);
    });
  }

  // Initialiseer alle AdSense blokken
  function pushAds() {
    try {
      const ins = document.querySelectorAll(".adsbygoogle");
      ins.forEach(() => {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      });
    } catch (e) {
      console.warn("[Ads] AdSense push mislukt:", e.message);
    }
  }

  // Verberg de ins-elementen en toon fallback
  function showFallback() {
    document.querySelectorAll(".adsbygoogle").forEach((ins) => {
      ins.style.display = "none";
    });
    document.querySelectorAll('[id^="ad-fallback-"]').forEach((fallback) => {
      fallback.removeAttribute("aria-hidden");
    });
  }

  // Verberg fallback wanneer AdSense geladen is
  function hideFallback() {
    document.querySelectorAll('[id^="ad-fallback-"]').forEach((fallback) => {
      fallback.setAttribute("aria-hidden", "true");
      fallback.style.display = "none";
    });
  }

  // Globale initialisatiefunctie (ook aanroepbaar vanuit acceptCookies)
  window.initAds = async function () {
    if (!hasConsent()) {
      showFallback();
      return;
    }

    const pubId = "ca-pub-XXXXXXXXXXXXXXXX"; // Vervang met jouw publisher ID
    // Controleer of het een echt ID is
    if (pubId.includes("XXXX")) {
      console.info(
        "[Ads] Geen geldig AdSense publisher ID – demo advertenties worden getoond.",
      );
      showFallback();
      return;
    }

    try {
      await loadAdSenseScript(pubId);
      hideFallback();
      pushAds();
    } catch (err) {
      console.warn(
        "[Ads] AdSense kon niet worden geladen – demo weergegeven.",
        err.message,
      );
      showFallback();
    }
  };

  // Start automatisch als consent al gegeven is
  if (hasConsent()) {
    // Wacht op DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", window.initAds);
    } else {
      window.initAds();
    }
  } else {
    // Toon altijd demo-advertenties als fallback tot consent
    showFallback();
  }
})();
