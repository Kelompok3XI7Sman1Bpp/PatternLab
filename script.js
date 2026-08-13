/* ==========================================================================
   PATTERNLAB — MAIN SCRIPT
   Semua interaktivitas: navbar, animasi, materi, video, simulasi, quiz,
   dan progres diatur dari file ini. Setiap fungsi memeriksa dulu apakah
   elemen terkait ada di halaman sebelum dijalankan, sehingga satu file ini
   aman dipakai di seluruh halaman (login, index, materi, video, simulasi,
   quiz, lkpd, progres).
   ========================================================================== */

/* --------------------------------------------------------------------------
   -1. SERVICE WORKER (dukungan mode offline / PWA)
   Didaftarkan di sini karena script.js dimuat di seluruh halaman, sehingga
   cukup satu kali penambahan untuk mengaktifkan cache offline di semua
   halaman PatternLab. Pendaftaran dibungkus feature-detection dan try/catch
   agar browser lama yang tidak mendukung Service Worker tetap berjalan
   normal tanpa error.
   -------------------------------------------------------------------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("service-worker.js").catch(function (err) {
      console.warn("[PatternLab] Pendaftaran service worker gagal:", err);
    });
  });
}

/* --------------------------------------------------------------------------
   0. SISTEM LOGIN + PROGRESS TERPUSAT (localStorage)
   Satu sumber data yang dipakai oleh SELURUH halaman (navbar, materi, video,
   simulasi, lkpd, quiz, progres) agar tidak ada progress yang tercampur
   atau tidak sinkron antar halaman. Identitas pengguna = Nama + Kelas,
   dinormalisasi (huruf kecil, spasi dirapikan) supaya "Yas" dan "yas"
   dianggap pengguna yang sama, tanpa mengubah nama asli yang ditampilkan.
   -------------------------------------------------------------------------- */
var PatternLabProgress = (function () {
  var CURRENT_USER_KEY = "patternlab_current_user";
  var PROGRESS_PREFIX = "patternLabProgress_";

  function normalize(str) {
    return (str || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  }

  function progressKey(name, className) {
    return PROGRESS_PREFIX + normalize(name) + "_" + normalize(className);
  }

  function defaultProgress() {
    return {
      tujuan: false,
      petaKonsep: false,
      materi: false,
      video1: false,
      video2: false,
      simulasi: false,
      lkpd: false,
      quiz: { completed: false, score: 0, total: 0, percentage: 0 },
      glosarium: false
    };
  }

  function getCurrentUser() {
    try {
      var raw = localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function setCurrentUser(name, className) {
    var user = { name: (name || "").trim(), className: (className || "").trim() };
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (err) {
      /* localStorage tidak tersedia — abaikan dengan tenang */
    }
    return user;
  }

  function clearCurrentUser() {
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch (err) {
      /* abaikan */
    }
  }

  function loadProgress() {
    var user = getCurrentUser();
    var base = defaultProgress();
    if (!user) return base;

    try {
      var raw = localStorage.getItem(progressKey(user.name, user.className));
      if (!raw) return base;
      var parsed = JSON.parse(raw);
      for (var key in parsed) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) base[key] = parsed[key];
      }
      return base;
    } catch (err) {
      return base;
    }
  }

  function saveProgress(progress) {
    var user = getCurrentUser();
    if (!user) return;
    try {
      localStorage.setItem(progressKey(user.name, user.className), JSON.stringify(progress));
    } catch (err) {
      /* abaikan jika localStorage tidak tersedia (mis. mode privat) */
    }
  }

  function updateProgress(key, value) {
    var progress = loadProgress();
    progress[key] = value;
    saveProgress(progress);
    return progress;
  }

  // --- Penghubung data Simulasi AI -> LKPD ---
  // Menyimpan ringkasan singkat percobaan yang baru saja dilakukan pengguna
  // di halaman Simulasi (objek yang diuji, tahapan yang dipilih, hasilnya)
  // memakai mekanisme localStorage yang SAMA (per pengguna) dengan sistem
  // progress di atas, supaya halaman LKPD bisa menawarkan data tersebut
  // sebagai referensi awal — tanpa menghilangkan opsi mengisi manual.
  var SIMDATA_PREFIX = "patternLabSimData_";

  function simDataKey(name, className) {
    return SIMDATA_PREFIX + normalize(name) + "_" + normalize(className);
  }

  function loadSimResults() {
    var user = getCurrentUser();
    if (!user) return [];
    try {
      var raw = localStorage.getItem(simDataKey(user.name, user.className));
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveSimResult(entry) {
    var user = getCurrentUser();
    if (!user) return;
    try {
      var list = loadSimResults();
      list.push(entry);
      if (list.length > 5) list = list.slice(list.length - 5);
      localStorage.setItem(simDataKey(user.name, user.className), JSON.stringify(list));
    } catch (err) {
      /* abaikan jika localStorage tidak tersedia */
    }
  }

  // Sembilan tahap utama yang dihitung untuk persentase keseluruhan:
  // Tujuan Pembelajaran, Peta Konsep, Materi, Video 1, Video 2,
  // Simulasi AI, LKPD, Quiz, Glosarium.
  function overallStats(progress) {
    progress = progress || loadProgress();
    var flags = [
      !!progress.tujuan,
      !!progress.petaKonsep,
      !!progress.materi,
      !!progress.video1,
      !!progress.video2,
      !!progress.simulasi,
      !!progress.lkpd,
      !!(progress.quiz && progress.quiz.completed),
      !!progress.glosarium
    ];
    var done = flags.filter(Boolean).length;
    var total = flags.length;
    return {
      done: done,
      total: total,
      percent: Math.round((done / total) * 100)
    };
  }

  return {
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    clearCurrentUser: clearCurrentUser,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    updateProgress: updateProgress,
    overallStats: overallStats,
    loadSimResults: loadSimResults,
    saveSimResult: saveSimResult
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  initThemeToggle();
  initSoundEffects();
  initNavUser();
  initPreloader();
  initNavbar();
  initSidebar();
  initRevealOnScroll();
  initNeuralCanvas();
  initLearningFlow();
  initMateriPage();
  initGlossary();
  initConceptMap();
  initVideoPage();
  initAppliedVideoObserver();
  initSimulasiPage();
  initQuizPage();
  initProgresPage();
  initLkpdPage();
  initLoginPage();
  initFooterYear();
});

/* --------------------------------------------------------------------------
   1. PRELOADER
   Menyembunyikan layar loading sesaat setelah halaman selesai dimuat, agar
   transisi terasa halus alih-alih tiba-tiba.
   -------------------------------------------------------------------------- */
function initPreloader() {
  var preloader = document.querySelector(".preloader");
  if (!preloader) return;

  window.addEventListener("load", function () {
    setTimeout(function () {
      preloader.classList.add("hidden");
    }, 400);
  });

  // Jaga-jaga: jika event load tidak terpicu (mis. dibuka dari cache),
  // paksa sembunyikan preloader setelah 1.5 detik.
  setTimeout(function () {
    preloader.classList.add("hidden");
  }, 1500);
}

/* --------------------------------------------------------------------------
   2. NAVBAR: efek scroll + menu mobile
   -------------------------------------------------------------------------- */
function initNavbar() {
  var navbar = document.querySelector(".navbar");
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.querySelector(".nav-menu");

  if (navbar) {
    var handleScroll = function () {
      if (window.scrollY > 24) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      toggle.classList.toggle("open");
      menu.classList.toggle("open");
    });

    // Tutup menu mobile ketika salah satu link diklik
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggle.classList.remove("open");
        menu.classList.remove("open");
      });
    });
  }
}

/* --------------------------------------------------------------------------
   2a-2. SIDEBAR NAVIGASI (menggantikan navbar atas)
   Off-canvas drawer di mobile (dibuka lewat hamburger di mobile-topbar,
   ditutup lewat overlay/klik link), serta collapse/expand di desktop yang
   preferensinya disimpan di localStorage supaya konsisten antar halaman.
   Elemen lama (.navbar/.nav-toggle/.nav-menu) sudah tidak ada di markup
   sehingga initNavbar() di atas akan diam saja (no-op) — fungsi ini berdiri
   sendiri agar tidak perlu mengubah initNavbar().
   -------------------------------------------------------------------------- */
function initSidebar() {
  var sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  var hamburger = document.getElementById("sidebarHamburger");
  var overlay = document.getElementById("sidebarOverlay");
  var collapseBtn = document.getElementById("sidebarCollapseBtn");
  var STORAGE_KEY = "patternlab_sidebar_collapsed";

  function openMobileSidebar() {
    sidebar.classList.add("open");
    if (overlay) overlay.classList.add("open");
    if (hamburger) hamburger.classList.add("open");
  }

  function closeMobileSidebar() {
    sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    if (hamburger) hamburger.classList.remove("open");
  }

  if (hamburger) {
    hamburger.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeMobileSidebar);
  }

  sidebar.querySelectorAll(".sidebar-menu a").forEach(function (link) {
    link.addEventListener("click", closeMobileSidebar);
  });

  // Collapse/expand sidebar di desktop, preferensi disimpan agar konsisten
  // saat berpindah halaman.
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      document.body.classList.add("sidebar-collapsed");
    }
  } catch (e) {}

  if (collapseBtn) {
    collapseBtn.addEventListener("click", function () {
      var collapsed = document.body.classList.toggle("sidebar-collapsed");
      try {
        localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      } catch (e) {}
    });
  }

  // Tutup drawer mobile otomatis jika layar diperbesar melewati breakpoint.
  window.addEventListener("resize", function () {
    if (window.innerWidth > 900) closeMobileSidebar();
  });
}

/* --------------------------------------------------------------------------
   2b. DARK MODE / LIGHT MODE TOGGLE
   Preferensi tersimpan di localStorage ("patternlab_theme") sehingga tetap
   konsisten saat berpindah halaman atau membuka kembali website. Kelas
   [data-theme="dark"] pada <html> sudah diterapkan lebih awal lewat script
   inline kecil di <head> agar tidak ada "kedipan" tampilan terang sesaat
   sebelum berubah ke gelap.
   -------------------------------------------------------------------------- */
function initThemeToggle() {
  var toggle = document.getElementById("themeToggle");
  var STORAGE_KEY = "patternlab_theme";

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // Sinkronkan tampilan tombol dengan tema yang sedang aktif (sudah
  // diterapkan lebih dulu oleh script inline di <head>).
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyTheme(saved);
  } catch (err) {
    /* localStorage tidak tersedia — lanjut dengan Light Mode default */
  }

  if (!toggle) return;

  toggle.addEventListener("click", function () {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      /* abaikan jika localStorage tidak tersedia (mis. mode privat) */
    }
  });
}

/* --------------------------------------------------------------------------
   2c. SOUND EFFECT UI (klik, jawaban benar, jawaban salah, quiz selesai)
   Menggunakan elemen <audio> yang sama untuk setiap jenis suara (bukan
   membuat instance baru setiap kali) agar suara tidak menumpuk saat tombol
   diklik berkali-kali secara cepat. Suara HANYA diputar setelah interaksi
   pengguna (klik), sehingga tidak melanggar kebijakan autoplay browser.
   -------------------------------------------------------------------------- */
function initSoundEffects() {
  var soundFiles = {
    click: "assets/sounds/click.mp3",
    correct: "assets/sounds/correct.mp3",
    wrong: "assets/sounds/wrong.mp3",
    complete: "assets/sounds/complete.mp3"
  };

  var sounds = {};
  Object.keys(soundFiles).forEach(function (key) {
    var audio = new Audio(soundFiles[key]);
    audio.preload = "auto";
    audio.volume = key === "complete" ? 0.55 : 0.4;
    sounds[key] = audio;
  });

  function play(name) {
    var audio = sounds[name];
    if (!audio) return;
    try {
      audio.currentTime = 0;
      var playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          /* diblokir kebijakan autoplay browser — abaikan dengan tenang */
        });
      }
    } catch (err) {
      /* abaikan jika file audio belum tersedia/gagal dimuat */
    }
  }

  // Diekspos secara global agar modul lain (mis. Quiz) bisa memicu suara
  // correct/wrong/complete pada momen yang tepat.
  window.PatternLabSound = { play: play };

  // Delegasi klik untuk suara klik umum: tombol (.btn), menu navbar,
  // navigasi topik Materi, dan kartu tahap Alur Pembelajaran. Elemen
  // .quiz-option sengaja TIDAK termasuk di sini karena sudah punya suara
  // correct/wrong sendiri — supaya suara tidak bertumpuk.
  document.addEventListener("click", function (e) {
    var target = e.target.closest(
      ".btn, .nav-menu a, .materi-nav-item, .flow-card, .theme-toggle"
    );
    if (target) play("click");
  });
}

/* --------------------------------------------------------------------------
   2d. NAVBAR: identitas pengguna yang sedang login + Ganti Pengguna
   Elemen #navUser bersifat opsional — hanya dijalankan jika markup-nya ada
   di halaman (tidak ada di login.html). Progress user TIDAK dihapus saat
   "Ganti Pengguna", hanya sesi aktifnya saja yang dibersihkan.
   -------------------------------------------------------------------------- */
function initNavUser() {
  var wrap = document.getElementById("navUser");
  if (!wrap) return;

  var label = document.getElementById("navUserLabel");
  var switchBtn = document.getElementById("navUserSwitch");
  var user = PatternLabProgress.getCurrentUser();

  if (user && user.name) {
    if (label) {
      label.textContent = user.name + (user.className ? " · " + user.className : "");
    }
    wrap.style.display = "flex";
  } else {
    wrap.style.display = "none";
  }

  if (switchBtn) {
    switchBtn.addEventListener("click", function () {
      PatternLabProgress.clearCurrentUser();
      window.location.href = "login.html";
    });
  }
}

/* --------------------------------------------------------------------------
   2e. HALAMAN LOGIN
   -------------------------------------------------------------------------- */
function initLoginPage() {
  var form = document.getElementById("loginForm");
  if (!form) return;

  var nameInput = document.getElementById("loginName");
  var classInput = document.getElementById("loginClass");
  var errorEl = document.getElementById("loginError");

  // Jika sudah pernah login sebelumnya, isi otomatis agar tidak perlu
  // mengetik ulang (tetap bisa diedit untuk ganti pengguna dari sini juga).
  var existing = PatternLabProgress.getCurrentUser();
  if (existing) {
    if (nameInput) nameInput.value = existing.name || "";
    if (classInput) classInput.value = existing.className || "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameInput ? nameInput.value.trim() : "";
    var className = classInput ? classInput.value.trim() : "";

    if (!name || !className) {
      if (errorEl) {
        errorEl.textContent = "Nama dan kelas wajib diisi ya.";
        errorEl.style.display = "block";
      }
      return;
    }

    if (errorEl) errorEl.style.display = "none";
    PatternLabProgress.setCurrentUser(name, className);
    window.location.href = "index.html";
  });
}

function initRevealOnScroll() {
  var elements = document.querySelectorAll(".reveal");
  if (!elements.length) return;

  if (!("IntersectionObserver" in window)) {
    elements.forEach(function (el) {
      el.classList.add("in-view");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  elements.forEach(function (el) {
    observer.observe(el);
  });
}

/* --------------------------------------------------------------------------
   4. ILUSTRASI NEURAL NETWORK DI HERO (Canvas)
   Titik-titik (node) bergerak pelan dan saling terhubung dengan garis tipis
   ketika berdekatan — merepresentasikan jaringan saraf tiruan yang menjadi
   dasar pengenalan pola citra & suara.
   -------------------------------------------------------------------------- */
function initNeuralCanvas() {
  var canvas = document.getElementById("neuralCanvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var wrap = canvas.parentElement;
  var nodes = [];
  var NODE_COUNT = 42;
  var MAX_DIST = 130;
  var width, height;

  function resize() {
    width = wrap.clientWidth;
    height = wrap.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function createNodes() {
    nodes = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 1.2
      });
    }
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    // Update posisi
    nodes.forEach(function (n) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    });

    // Gambar garis penghubung antar node yang berdekatan
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          var opacity = 1 - dist / MAX_DIST;
          ctx.strokeStyle = "rgba(34, 211, 238, " + (opacity * 0.35) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Gambar node
    nodes.forEach(function (n) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(124, 138, 255, 0.85)";
      ctx.fill();
    });

    requestAnimationFrame(step);
  }

  resize();
  createNodes();
  requestAnimationFrame(step);

  window.addEventListener("resize", function () {
    resize();
    createNodes();
  });
}

/* --------------------------------------------------------------------------
   4b. HOME: Modal panduan detail untuk section "Alur Pembelajaran" (7 tahap)
   -------------------------------------------------------------------------- */
function initLearningFlow() {
  var overlay = document.getElementById("flowModalOverlay");
  var cards = document.querySelectorAll(".flow-card");
  if (!overlay || !cards.length) return;

  var closeBtn = document.getElementById("flowModalClose");
  var numberEl = document.getElementById("flowModalNumber");
  var eyebrowEl = document.getElementById("flowModalEyebrow");
  var titleEl = document.getElementById("flowModalTitle");
  var introEl = document.getElementById("flowModalIntro");
  var todoEl = document.getElementById("flowModalTodo");
  var menuEl = document.getElementById("flowModalMenu");
  var goalEl = document.getElementById("flowModalGoal");
  var ctaEl = document.getElementById("flowModalCta");

  // Data panduan lengkap untuk setiap dari 7 tahap pembelajaran. Ditulis
  // dengan bahasa yang santai dan ramah agar mudah dipahami siswa SMA.
  var flowSteps = {
    1: {
      title: "📖 Belajar Materi",
      intro: "Yuk mulai dari sini dulu! Buka menu Materi dan pahami konsep dasar pengenalan pola citra & suara sebelum lanjut ke tahap praktik.",
      todo: [
        "Buka menu Materi.",
        "Pilih topik yang tersedia di sidebar.",
        "Baca dan pahami penjelasannya pelan-pelan.",
        "Perhatikan contoh-contoh yang diberikan.",
        "Pastikan kamu sudah paham sebelum lanjut ke tahap berikutnya."
      ],
      menu: "Menu Materi",
      goal: "Membekali kamu dengan pemahaman dasar sebelum praktik langsung menggunakan AI.",
      ctaText: "Buka Menu Materi",
      ctaLink: "materi.html"
    },
    2: {
      title: "🎥 Menonton Video",
      intro: "Setelah baca materi, sekarang saatnya lihat konsepnya secara visual lewat video edukasi.",
      todo: [
        "Buka menu Video.",
        "Pilih video pembelajaran yang ingin ditonton.",
        "Tonton videonya sampai selesai.",
        "Perhatikan penjelasan dan contoh yang ditampilkan.",
        "Tonton ulang bagian yang belum kamu pahami."
      ],
      menu: "Menu Video",
      goal: "Memperkuat pemahaman konsep sebelum kamu mencoba Simulasi AI.",
      ctaText: "Buka Menu Video",
      ctaLink: "video.html"
    },
    3: {
      title: "🤖 Mencoba Simulasi AI",
      intro: "Saatnya praktik langsung! Coba lihat bagaimana AI mengenali pola dari gambar yang kamu berikan.",
      todo: [
        "Buka menu Simulasi AI.",
        "Baca instruksi simulasi terlebih dahulu.",
        "Berikan input (upload gambar atau gunakan kamera).",
        "Jalankan simulasinya.",
        "Amati hasil prediksi dan tingkat keyakinan (confidence) dari AI.",
        "Catat hasilnya — kamu akan membutuhkannya di tahap Penelitian."
      ],
      menu: "Menu Simulasi AI",
      goal: "Memberi kamu pengalaman langsung tentang cara AI mengenali pola.",
      ctaText: "Buka Menu Simulasi AI",
      ctaLink: "simulasi.html"
    },
    4: {
      title: "🔬 Melakukan Penelitian",
      intro: "Setelah dapat hasil dari simulasi, sekarang giliran kamu meneliti hasil tersebut lebih dalam — tahap ini terpisah dari Simulasi AI ya!",
      todo: [
        "Ikuti instruksi penelitian dari guru/pembimbingmu.",
        "Gunakan hasil simulasi sebelumnya sebagai data awal.",
        "Lakukan pengamatan terhadap hasil tersebut.",
        "Kumpulkan dan catat data yang kamu temukan.",
        "Analisis hasil penelitianmu.",
        "Tarik kesimpulan berdasarkan hasil yang kamu peroleh."
      ],
      menu: "Hasil Simulasi AI (sebagai bahan penelitian)",
      goal: "Menghubungkan teori dan simulasi AI dengan proses penelitian secara langsung.",
      ctaText: "Kembali ke Simulasi AI",
      ctaLink: "simulasi.html"
    },
    5: {
      title: "📝 Membuat LKPD",
      intro: "Hasil penelitianmu tadi jangan sampai berhenti begitu saja — sekarang susun jadi LKPD (Lembar Kerja Peserta Didik) berdasarkan hasil penelitian tersebut.",
      todo: [
        "Buka menu LKPD.",
        "Gunakan hasil penelitian sebagai dasar penyusunan.",
        "Masukkan data atau hasil pengamatan yang relevan.",
        "Susun pertanyaan atau kegiatan pembelajaran berdasarkan penelitianmu.",
        "Lengkapi LKPD sesuai instruksi yang diberikan.",
        "Periksa kembali LKPD sebelum menyelesaikannya."
      ],
      menu: "Menu LKPD (berdasarkan hasil Penelitian)",
      goal: "Menghasilkan LKPD yang mengintegrasikan materi, Simulasi AI, dan hasil penelitianmu.",
      ctaText: "Buka Menu LKPD",
      ctaLink: "lkpd.html"
    },
    6: {
      title: "✅ Mengerjakan Quiz",
      intro: "Semua tahap belajar, praktik, dan penelitian sudah kamu lewati — sekarang uji pemahamanmu lewat Quiz!",
      todo: [
        "Buka menu Quiz.",
        "Baca setiap pertanyaan dengan teliti.",
        "Pilih jawaban yang menurutmu paling tepat.",
        "Selesaikan seluruh pertanyaan sampai akhir.",
        "Kirim jawabanmu.",
        "Lihat hasil dan skor akhirmu."
      ],
      menu: "Menu Quiz",
      goal: "Mengukur pemahamanmu setelah mengikuti seluruh rangkaian pembelajaran.",
      ctaText: "Buka Menu Quiz",
      ctaLink: "quiz.html"
    },
    7: {
      title: "📊 Melihat Progress",
      intro: "Terakhir, cek Progres untuk melihat sejauh mana perjalanan belajarmu di PatternLab.",
      todo: [
        "Buka menu Progres.",
        "Lihat materi yang sudah kamu pelajari.",
        "Cek video yang sudah kamu tonton.",
        "Lihat aktivitas Simulasi AI-mu.",
        "Cek progress Penelitian/LKPD (jika tersedia).",
        "Lihat hasil Quiz dan progress belajar keseluruhanmu."
      ],
      menu: "Menu Progres",
      goal: "Membantu kamu mengetahui perkembangan dan hasil belajarmu secara menyeluruh.",
      ctaText: "Buka Progres",
      ctaLink: "progres.html"
    }
  };

  function openModal(stepNum) {
    var data = flowSteps[stepNum];
    if (!data) return;

    if (numberEl) numberEl.textContent = "0" + stepNum;
    if (eyebrowEl) eyebrowEl.textContent = "Tahap " + stepNum + " dari 7";
    if (titleEl) titleEl.textContent = data.title;
    if (introEl) introEl.textContent = data.intro;
    if (menuEl) menuEl.textContent = data.menu;
    if (goalEl) goalEl.textContent = data.goal;

    if (todoEl) {
      todoEl.innerHTML = "";
      data.todo.forEach(function (item) {
        var li = document.createElement("li");
        li.textContent = item;
        todoEl.appendChild(li);
      });
    }

    if (ctaEl) {
      ctaEl.innerHTML = data.ctaText + ' <i class="fa-solid fa-arrow-right"></i>';
      ctaEl.setAttribute("href", data.ctaLink);
    }

    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      openModal(card.getAttribute("data-step"));
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("active")) {
      closeModal();
    }
  });

  /* ------------------------------------------------------------------------
     Indikator status "✓ Selesai" pada tiap kartu tahap, berdasarkan progress
     pengguna yang sedang login. Ditambahkan secara subtle lewat JS tanpa
     mengubah markup/layout dasar kartu — badge hanya muncul jika PatternLabProgress tersedia.
     ------------------------------------------------------------------------ */
  if (typeof PatternLabProgress !== "undefined") {
    var progress = PatternLabProgress.loadProgress();
    var quizInfo = progress.quiz || { completed: false };
    var videoDone = (progress.video1 ? 1 : 0) + (progress.video2 ? 1 : 0);

    var statusByStep = {
      1: progress.materi === true,
      2: videoDone > 0 ? "video" : false,
      3: progress.simulasi === true,
      4: progress.simulasi === true, // 04 Penelitian mengikuti hasil Simulasi AI
      5: progress.lkpd === true, // 05 Membuat LKPD
      6: quizInfo.completed === true
    };

    cards.forEach(function (card) {
      var step = card.getAttribute("data-step");
      var status = statusByStep[step];
      if (!status) return;

      var badge = document.createElement("span");
      badge.className = "flow-card-status";
      if (status === "video") {
        badge.textContent = "✓ " + videoDone + "/2 Selesai";
      } else {
        badge.textContent = "✓ Selesai";
      }
      card.appendChild(badge);
    });
  }
}

/* --------------------------------------------------------------------------
   5. HALAMAN MATERI: data topik + navigasi sidebar/dropdown
   -------------------------------------------------------------------------- */
function initMateriPage() {
  var contentArea = document.getElementById("materiContent");
  if (!contentArea) return;

  var materiData = {
    pengertian: {
      icon: "fa-lightbulb",
      tag: "Konsep Dasar",
      title: "Pengertian Pengenalan Pola",
      body: `
        <p class="materi-summary">Pengenalan pola (<em>Pattern Recognition</em>) adalah proses mengenali, mengelompokkan, atau mengidentifikasi keteraturan dalam data — baik secara manual maupun dengan bantuan komputer dan Kecerdasan Buatan (Artificial Intelligence). Ketika diterapkan pada citra dan suara, komputer diajarkan untuk "melihat" dan "mendengar" layaknya pancaindra manusia.</p>

        <p>Sebelum masuk lebih jauh, ada baiknya kita memecah istilah ini menjadi dua bagian agar lebih mudah dipahami. Kata <em>pattern</em> berarti "pola", yaitu susunan ciri atau keteraturan yang muncul berulang pada suatu data — misalnya bentuk bulat dan warna oranye yang selalu muncul pada jeruk, atau nada tinggi-rendah tertentu yang khas dari suara seseorang. Sementara itu, kata <em>recognition</em> berarti "pengenalan", yaitu kemampuan untuk mencocokkan sesuatu yang baru dengan pola yang sudah pernah dipelajari sebelumnya. Jika digabungkan, <em>pattern recognition</em> berarti kemampuan mengenali sesuatu berdasarkan pola atau ciri khas yang dimilikinya, bukan berdasarkan hafalan satu per satu.</p>

        <p>Manusia sebenarnya melakukan pengenalan pola setiap hari tanpa disadari. Saat kamu melihat sebuah benda bulat berwarna oranye dengan tekstur kulit yang khas, otakmu secara otomatis membandingkannya dengan pola-pola yang sudah pernah kamu lihat sebelumnya, lalu menyimpulkan "itu jeruk". Kamu tidak perlu mengingat satu per satu jeruk yang pernah kamu lihat sepanjang hidup — cukup mengenali polanya. Nah, komputer bekerja dengan prinsip yang mirip, hanya saja "pola" yang dipelajarinya berupa angka-angka hasil pengolahan data citra atau suara.</p>

        <h3>Mengapa Komputer Perlu Mengenali Pola?</h3>
        <p>Komputer pada dasarnya hanya memahami angka. Sebuah foto bagi komputer bukanlah "gambar kucing yang lucu", melainkan kumpulan jutaan angka yang mewakili warna setiap piksel. Begitu pula sebuah rekaman suara, yang bagi komputer hanyalah deretan angka yang menggambarkan getaran gelombang suara dari waktu ke waktu. Tanpa kemampuan pengenalan pola, komputer tidak akan bisa memaknai angka-angka tersebut menjadi informasi yang berguna, seperti "ini adalah wajah manusia" atau "ini adalah kata 'halo'".</p>
        <p>Di sinilah pentingnya pengenalan pola: ia menjadi jembatan yang mengubah data mentah (berupa angka) menjadi informasi yang bermakna dan dapat digunakan untuk mengambil keputusan. Kemampuan inilah yang mendasari banyak teknologi AI modern, mulai dari kamera yang bisa mendeteksi wajah, aplikasi yang bisa menerjemahkan suara menjadi teks, hingga mobil yang bisa mengenali rambu lalu lintas secara otomatis.</p>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-bullseye"></i></span>
          <div class="materi-highlight-body">
            <strong>🎯 Inti Materi</strong>
            <p>Komputer belajar mengenali suatu pola dari data yang telah diberikan (data latih / <em>training data</em>), kemudian dapat mengidentifikasi data baru yang memiliki karakteristik serupa.</p>
          </div>
        </div>

        <h3>Hubungan Data, Pola, dan Klasifikasi</h3>
        <p>Proses pengenalan pola pada dasarnya mengikuti alur sederhana: <strong>data → pola → klasifikasi</strong>. Semuanya dimulai dari <strong>data</strong>, yaitu kumpulan contoh yang diberikan kepada komputer, misalnya ratusan foto kucing dan anjing. Dari data tersebut, komputer mencoba menemukan <strong>pola</strong>, yaitu ciri-ciri khas yang membedakan satu kategori dengan kategori lainnya — misalnya bentuk telinga, ukuran tubuh, atau tekstur bulu. Setelah pola tersebut dipelajari, komputer dapat melakukan <strong>klasifikasi</strong>, yaitu menentukan kategori dari data baru yang belum pernah dilihat sebelumnya berdasarkan pola yang sudah dikenalinya.</p>
        <p>Alur inilah yang menjadi dasar dari hampir seluruh sistem pengenalan pola, baik untuk citra maupun suara, dan akan kamu temui berulang kali pada topik-topik selanjutnya di modul ini — mulai dari Pengenalan Pola Citra, Pengenalan Pola Suara, hingga Cara Kerja AI.</p>

        <h3>Tujuan Pembelajaran</h3>
        <p>Setelah mempelajari materi ini, kamu diharapkan mampu:</p>
        <ul>
          <li>Memahami pengertian pengenalan pola (<em>Pattern Recognition</em>).</li>
          <li>Menjelaskan pengenalan pola citra (<em>Image Pattern Recognition</em>).</li>
          <li>Menjelaskan pengenalan pola suara (<em>Voice/Audio Pattern Recognition</em>).</li>
          <li>Mengetahui penerapan teknologi pengenalan pola dalam kehidupan sehari-hari.</li>
          <li>Memahami dan mempraktikkan pembuatan model AI sederhana menggunakan Teachable Machine.</li>
        </ul>

        <h3>Contoh Sederhana dalam Kehidupan Sehari-hari</h3>
        <div class="materi-example-grid">
          <div class="materi-example-card">
            <span class="materi-example-emoji">🙂</span>
            <h4>Mengenali Wajah</h4>
            <p>Mengenali wajah seseorang atau teman dari sebuah foto.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">✍️</span>
            <h4>Tulisan Tangan</h4>
            <p>Mengenali tulisan tangan dan mengubahnya menjadi teks digital.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🎙️</span>
            <h4>Perintah Vokal</h4>
            <p>Mengenali suara manusia dan perintah vokal yang diucapkan.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🐾</span>
            <h4>Jenis Hewan</h4>
            <p>Mengidentifikasi jenis hewan tertentu melalui foto.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🔒</span>
            <h4>Sidik Jari</h4>
            <p>Sistem verifikasi sidik jari pada smartphone.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🤖</span>
            <h4>Otomatisasi AI</h4>
            <p>Menjadi dasar berbagai sistem AI modern di sekitar kita.</p>
          </div>
        </div>

        <h3>Hubungan Pattern Recognition dengan Kecerdasan Buatan</h3>
        <p>Pengenalan pola adalah salah satu cabang penting dalam Kecerdasan Buatan (AI). Bisa dikatakan, pengenalan pola adalah "kemampuan indra" dari AI — bagian yang memungkinkan komputer menangkap dan memahami dunia di sekitarnya melalui data citra maupun suara. Tanpa kemampuan ini, AI hanya akan menjadi program yang bisa menghitung, tetapi tidak bisa "melihat" atau "mendengar" seperti yang kita kenal pada asisten virtual, kamera pintar, maupun aplikasi pengenalan wajah saat ini.</p>
        <p>Setelah memahami konsep dasar ini, kamu siap melangkah ke pembahasan yang lebih spesifik: bagaimana sebenarnya komputer mengenali pola pada gambar (Pengenalan Pola Citra), dan bagaimana komputer mengenali pola pada suara (Pengenalan Pola Suara). Kedua topik tersebut akan menunjukkan penerapan konsep "data → pola → klasifikasi" yang baru saja kamu pelajari, tetapi dengan jenis data yang berbeda.</p>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-lightbulb"></i></span>
          <div class="materi-highlight-body">
            <strong>💡 Tahukah Kamu?</strong>
            <p>Materi pengenalan pola juga melatih kemampuan Berpikir Komputasional (KKA) — mulai dari analisis pola, logika klasifikasi, hingga penarikan kesimpulan. Kemampuan ini akan dibahas lebih dalam pada topik "Cara Kerja AI".</p>
          </div>
        </div>
      `
    },

    "pola-citra": {
      icon: "fa-image",
      tag: "Computer Vision",
      title: "Pengenalan Pola Citra (Image Pattern Recognition)",
      body: `
        <p class="materi-summary">Pengenalan pola citra adalah proses membaca piksel gambar untuk menganalisis dan mengenali objek, wajah, bentuk, warna, tekstur, posisi objek, atau struktur visual di dalam gambar digital secara otomatis. Bidang ini dikenal luas sebagai <strong>Computer Vision</strong>.</p>

        <p>Bagi manusia, "melihat" terasa seperti hal yang sangat sederhana — kita tinggal membuka mata dan langsung memahami apa yang ada di depan kita. Namun bagi komputer, proses ini jauh lebih rumit. Sebuah gambar digital sebenarnya tersusun dari jutaan kotak kecil yang disebut piksel, dan setiap piksel hanya menyimpan angka yang mewakili warna pada titik tersebut. Komputer tidak "melihat" kucing atau mobil secara langsung; ia hanya melihat kumpulan angka. Tugas dari pengenalan pola citra adalah mengubah kumpulan angka tersebut menjadi informasi yang bermakna, seperti "ini adalah wajah manusia" atau "ini adalah rambu berhenti".</p>

        <p>Agar bisa melakukan hal tersebut, komputer perlu melewati serangkaian tahapan yang sistematis. Keempat tahapan ini bekerja secara berurutan, di mana hasil dari satu tahap akan menjadi bahan untuk tahap berikutnya — mirip seperti jalur produksi di pabrik, di mana setiap tahap punya tugas khusus sebelum produk akhirnya jadi.</p>

        <h3>Cara Kerja / Tahapan Proses</h3>
        <p>Secara sederhana, alur kerjanya dapat digambarkan sebagai berikut: <strong>Kamera → Gambar → Preprocessing → Ekstraksi Fitur → Klasifikasi → Hasil</strong>. Berikut penjelasan setiap tahapnya secara lebih rinci.</p>

        <div class="materi-steps">
          <div class="materi-step">
            <span class="materi-step-num">1</span>
            <div class="materi-step-body">
              <h4>Akuisisi Citra (Image Acquisition)</h4>
              <p>Mengambil gambar dari kamera, sensor, atau pemindai (scanner). Tahap ini adalah pintu masuk data visual ke dalam sistem — kualitas gambar yang diambil pada tahap ini akan sangat memengaruhi hasil akhir. Semakin jelas dan fokus gambar yang diambil, semakin mudah pula tahap-tahap selanjutnya dalam mengenali objek di dalamnya.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">2</span>
            <div class="materi-step-body">
              <h4>Pra-pemrosesan (Preprocessing)</h4>
              <p>Gambar hasil akuisisi seringkali belum dalam kondisi "siap pakai" — bisa jadi terlalu gelap, mengandung bintik-bintik gangguan (noise), atau berukuran terlalu besar untuk diproses dengan cepat. Preprocessing bertujuan untuk membersihkan dan merapikan gambar tersebut, misalnya dengan menghilangkan noise, mengubah ukuran gambar agar seragam, atau mengubahnya menjadi skala abu-abu (grayscale) supaya proses analisis warna menjadi lebih sederhana. Tanpa tahap ini, gangguan-gangguan kecil pada gambar bisa membuat komputer salah mengenali objek pada tahap berikutnya.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">3</span>
            <div class="materi-step-body">
              <h4>Ekstraksi Ciri (Feature Extraction)</h4>
              <p>Setelah gambar bersih dan rapi, komputer perlu mengambil ciri-ciri penting yang membedakan satu objek dengan objek lainnya. Ciri-ciri ini bisa berupa tepi dan garis (batas antar objek), warna dan tekstur (variasi intensitas piksel pada permukaan objek), maupun bentuk (geometri keseluruhan objek). Proses ini mirip seperti saat kita mendeskripsikan sebuah benda kepada orang lain menggunakan ciri-cirinya — "bentuknya bulat, warnanya oranye, permukaannya sedikit kasar" — hanya saja komputer melakukannya dalam bentuk angka-angka.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">4</span>
            <div class="materi-step-body">
              <h4>Klasifikasi (Classification)</h4>
              <p>Pada tahap terakhir, ciri-ciri yang sudah diekstraksi tadi dibandingkan dan dicocokkan dengan pola-pola yang sudah dipelajari komputer sebelumnya dari data pelatihan (training data). Berdasarkan kecocokan tersebut, sistem akan menentukan identitas objek — misalnya memutuskan apakah gambar yang diproses menunjukkan seekor kucing, seekor anjing, atau objek lainnya, lengkap dengan tingkat keyakinan (confidence) atas keputusan tersebut.</p>
            </div>
          </div>
        </div>

        <h3>Metode yang Digunakan</h3>
        <p>Untuk melakukan ekstraksi ciri dan klasifikasi tersebut, terdapat beberapa metode atau pendekatan yang bisa digunakan, mulai dari yang sederhana hingga yang paling canggih.</p>
        <div class="materi-chip-row">
          <span class="materi-chip"><i class="fa-solid fa-shapes"></i> Template Matching</span>
          <span class="materi-chip"><i class="fa-solid fa-robot"></i> Machine Learning</span>
          <span class="materi-chip"><i class="fa-solid fa-brain"></i> Deep Learning (CNN)</span>
        </div>

        <p>Di antara ketiganya, metode <strong>Convolutional Neural Network (CNN)</strong> adalah yang paling populer digunakan saat ini untuk pengenalan pola citra. Secara sederhana, CNN bekerja dengan cara "memindai" gambar sedikit demi sedikit menggunakan filter-filter kecil, mirip seperti kita menyorotkan senter ke berbagai bagian sebuah gambar untuk mengamati detail-detailnya satu per satu. Pada lapisan-lapisan awal, CNN mengenali pola-pola sederhana seperti garis dan sudut. Pada lapisan yang lebih dalam, pola-pola sederhana tersebut digabungkan menjadi bentuk yang lebih kompleks, misalnya mata atau telinga, hingga akhirnya CNN dapat mengenali objek secara utuh, seperti wajah manusia. Cara kerja bertingkat inilah yang membuat CNN sangat efektif dan menjadi standar utama dalam berbagai teknologi pengenalan citra modern, termasuk yang digunakan pada fitur Simulasi AI di website ini.</p>

        <h3>Contoh Penerapan Nyata</h3>
        <p>Konsep-konsep di atas mungkin terdengar abstrak, tetapi sebenarnya sudah sangat dekat dengan kehidupan sehari-harimu. Berikut beberapa contoh penerapan pengenalan pola citra yang mungkin sudah sering kamu gunakan tanpa disadari.</p>
        <div class="materi-example-grid">
          <div class="materi-example-card">
            <span class="materi-example-emoji">📱</span>
            <h4>Face ID / Face Unlock</h4>
            <p>Membuka smartphone dan sistem absensi otomatis.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🔍</span>
            <h4>Google Lens</h4>
            <p>Mengenali objek, teks, dan tempat lewat kamera.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🚓</span>
            <h4>Deteksi Plat Nomor (ETLE)</h4>
            <p>Mendeteksi pelanggaran lalu lintas secara otomatis.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🏥</span>
            <h4>Pencitraan Medis</h4>
            <p>Diagnosis penyakit lewat foto rontgen (X-ray) atau MRI.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">📷</span>
            <h4>Kamera Pintar</h4>
            <p>Mengenali wajah objek secara otomatis saat memotret.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">📄</span>
            <h4>OCR</h4>
            <p>Membaca teks dari tulisan tangan atau dokumen cetak.</p>
          </div>
        </div>

        <h3>Kelebihan & Kekurangan</h3>
        <p>Seperti teknologi lainnya, pengenalan pola citra memiliki sisi kelebihan sekaligus keterbatasan yang penting untuk dipahami, terutama agar kita bisa menggunakannya secara bijak dan tahu kapan hasilnya bisa diandalkan sepenuhnya, dan kapan perlu diverifikasi ulang oleh manusia.</p>
        <div class="materi-proscons-grid">
          <div class="materi-proscons-card pros">
            <h4>✅ Kelebihan</h4>
            <ul>
              <li>Cepat mengenali objek dalam gambar.</li>
              <li>Sangat akurat jika memiliki banyak data latih.</li>
              <li>Membantu otomatisasi pekerjaan manusia.</li>
            </ul>
          </div>
          <div class="materi-proscons-card cons">
            <h4>❌ Kekurangan</h4>
            <ul>
              <li>Membutuhkan data pelatihan dalam jumlah besar.</li>
              <li>Bisa salah mengenali jika gambar buram atau resolusi rendah.</li>
              <li>Sensitif terhadap kondisi pencahayaan yang buruk.</li>
            </ul>
          </div>
        </div>

        <p>Menariknya, sebagian besar kekurangan di atas berakar dari satu masalah yang sama: kualitas gambar yang menjadi input. Ketika pencahayaan minim atau gambar buram, nilai-nilai piksel yang seharusnya kontras menjadi tidak jelas, sehingga tahap ekstraksi ciri kesulitan menemukan garis tepi dan bentuk objek secara akurat. Inilah sebabnya tahap preprocessing yang sudah kamu pelajari sebelumnya menjadi sangat penting — proses tersebut membantu meminimalkan dampak dari kondisi gambar yang kurang ideal sebelum masuk ke tahap analisis berikutnya. Setelah memahami bagaimana komputer "melihat" gambar, pada topik selanjutnya kamu akan mempelajari bagaimana komputer "mendengar" dan memahami suara.</p>
      `
    },

    "pola-suara": {
      icon: "fa-microphone",
      tag: "Speech Recognition",
      title: "Pengenalan Pola Suara (Voice/Audio Pattern Recognition)",
      body: `
        <p class="materi-summary">Pengenalan pola suara adalah teknologi yang memungkinkan komputer mengenali, menganalisis gelombang frekuensi audio, dan memahami suara manusia — baik kata-kata yang diucapkan maupun identitas pembicara — lalu mengubahnya menjadi informasi yang dapat dipahami.</p>

        <p>Jika pada pengenalan pola citra komputer bekerja dengan piksel, maka pada pengenalan pola suara komputer bekerja dengan <strong>gelombang</strong>. Setiap kali kita berbicara, pita suara kita menghasilkan getaran udara yang merambat sebagai gelombang suara. Gelombang inilah yang ditangkap oleh mikrofon dan diubah menjadi sinyal digital berupa deretan angka yang menggambarkan naik-turunnya getaran tersebut dari waktu ke waktu. Sama seperti pada citra, komputer tidak "mendengar" suara secara langsung — ia hanya memproses angka-angka tersebut untuk mengenali pola di dalamnya.</p>

        <p>Ada beberapa karakteristik suara yang menjadi "ciri khas" yang dianalisis komputer, di antaranya frekuensi (tinggi-rendahnya nada), intonasi (naik-turunnya nada saat berbicara), kecepatan bicara, serta karakteristik vokal yang unik dari setiap orang — mirip seperti sidik jari, namun dalam bentuk suara.</p>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-waveform-lines"></i></span>
          <div class="materi-highlight-body">
            <strong>📌 Poin Penting</strong>
            <p>Komputer mengenali karakteristik suara seperti Frekuensi, Intonasi, Nada, Kecepatan Bicara, dan Karakteristik Vokal setiap pembicara.</p>
          </div>
        </div>

        <h3>Cara Kerja / Tahapan Proses</h3>
        <p>Secara garis besar, tahapan pengenalan pola suara memiliki pola yang serupa dengan pengenalan pola citra: mulai dari menangkap data mentah, membersihkannya, mengambil ciri-ciri pentingnya, hingga akhirnya mengambil keputusan. Berikut penjelasan setiap tahapnya.</p>

        <div class="materi-steps">
          <div class="materi-step">
            <span class="materi-step-num">1</span>
            <div class="materi-step-body">
              <h4>Perekaman Audio (Akuisisi)</h4>
              <p>Mengubah gelombang suara analog menjadi sinyal digital melalui mikrofon. Proses ini disebut sampling, yaitu mengambil "potret" gelombang suara secara berulang dalam interval waktu yang sangat singkat, sehingga terbentuk deretan angka yang mewakili bentuk gelombang tersebut secara utuh.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">2</span>
            <div class="materi-step-body">
              <h4>Pra-pemrosesan (Preprocessing)</h4>
              <p>Rekaman suara mentah biasanya masih bercampur dengan suara-suara lain yang tidak diinginkan, misalnya suara kipas angin, kendaraan, atau percakapan orang lain di latar belakang. Tahap ini bertugas menghilangkan suara bising tersebut (noise reduction), memotong bagian yang hening di awal/akhir rekaman, serta menormalisasi volume sinyal agar konsisten. Sama seperti pada citra, tahap ini sangat menentukan seberapa akurat hasil pengenalan pada tahap-tahap berikutnya.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">3</span>
            <div class="materi-step-body">
              <h4>Ekstraksi Ciri (Feature Extraction)</h4>
              <p>Setelah sinyal suara bersih, komputer perlu mengubahnya menjadi representasi angka yang lebih ringkas dan bermakna. Salah satu teknik yang paling umum digunakan adalah <strong>MFCC (Mel-Frequency Cepstral Coefficients)</strong>, yaitu teknik yang mengubah gelombang suara menjadi sekumpulan angka yang meniru cara telinga manusia mempersepsikan frekuensi. Dengan kata lain, MFCC membantu komputer "mendengar" suara dengan cara yang mirip dengan pendengaran manusia, sehingga lebih peka terhadap frekuensi yang penting bagi ucapan manusia.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">4</span>
            <div class="materi-step-body">
              <h4>Klasifikasi & Pencocokan Pola</h4>
              <p>Pola frekuensi hasil ekstraksi ciri tadi kemudian dicocokkan dengan pola-pola yang sudah dipelajari sistem sebelumnya. Pada sistem Speech Recognition, pola ini dikirim ke model bahasa untuk diterjemahkan menjadi teks — misalnya mengenali bahwa yang diucapkan adalah kata "halo". Sementara pada sistem Speaker Recognition, pola vokal tersebut dianalisis untuk mengenali identitas pemilik suara, bukan isi ucapannya.</p>
            </div>
          </div>
        </div>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-circle-question"></i></span>
          <div class="materi-highlight-body">
            <strong>❓ Speech Recognition vs Speaker Recognition</strong>
            <p><strong>Speech Recognition</strong> berfokus pada <em>apa</em> yang dikatakan — mengubah ucapan menjadi teks, seperti pada fitur voice typing. <strong>Speaker Recognition</strong> berfokus pada <em>siapa</em> yang berbicara — mengenali identitas seseorang dari karakteristik vokalnya, seperti pada fitur Voice Unlock. Kedua sistem ini sama-sama memproses suara, tetapi dengan tujuan analisis yang berbeda.</p>
          </div>
        </div>

        <h3>Metode yang Digunakan</h3>
        <p>Untuk melakukan klasifikasi dan pencocokan pola suara, terdapat beberapa metode yang umum digunakan, mulai dari pendekatan statistik klasik hingga pendekatan Deep Learning modern.</p>
        <div class="materi-chip-row">
          <span class="materi-chip"><i class="fa-solid fa-diagram-project"></i> Hidden Markov Model (HMM)</span>
          <span class="materi-chip"><i class="fa-solid fa-brain"></i> Neural Network</span>
          <span class="materi-chip"><i class="fa-solid fa-layer-group"></i> Deep Learning (RNN, LSTM)</span>
        </div>

        <p><strong>Hidden Markov Model (HMM)</strong> adalah model statistik klasik yang selama bertahun-tahun menjadi andalan dalam sistem pengenalan suara sebelum era Deep Learning, dengan cara memodelkan peluang perubahan dari satu bunyi ke bunyi berikutnya. Sementara itu, pendekatan modern lebih banyak memanfaatkan Neural Network, khususnya <strong>RNN (Recurrent Neural Network)</strong> dan pengembangannya yaitu <strong>LSTM</strong>. Kedua arsitektur ini dirancang khusus untuk memproses data yang bersifat berurutan (sekuensial) seperti suara, karena mampu "mengingat" konteks dari bunyi-bunyi sebelumnya saat menganalisis bunyi yang sedang diproses — kemampuan yang sangat penting mengingat makna sebuah kata seringkali bergantung pada kata-kata di sekitarnya.</p>

        <h3>Contoh Penerapan Nyata</h3>
        <p>Teknologi pengenalan pola suara sudah menjadi bagian dari keseharian kita, meskipun terkadang kita tidak menyadarinya. Berikut beberapa contoh penerapannya yang paling umum dijumpai.</p>
        <div class="materi-example-grid">
          <div class="materi-example-card">
            <span class="materi-example-emoji">🗣️</span>
            <h4>Voice Assistant</h4>
            <p>Google Assistant, Siri, dan Alexa memahami perintah suara.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">⌨️</span>
            <h4>Speech-to-Text</h4>
            <p>Voice typing dan transkripsi otomatis (caption YouTube/TikTok).</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">☎️</span>
            <h4>Call Center Otomatis</h4>
            <p>Menandai suara penelepon pada sistem layanan otomatis.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🔐</span>
            <h4>Voice Unlock</h4>
            <p>Autentikasi biometrik suara pada smartphone dan perbankan.</p>
          </div>
        </div>

        <h3>Kelebihan & Kekurangan</h3>
        <p>Sama seperti pengenalan pola citra, teknologi ini juga memiliki sisi kelebihan dan keterbatasan yang perlu dipahami agar penggunaannya bisa lebih optimal.</p>
        <div class="materi-proscons-grid">
          <div class="materi-proscons-card pros">
            <h4>✅ Kelebihan</h4>
            <ul>
              <li>Memudahkan penggunaan perangkat secara hands-free.</li>
              <li>Sangat membantu penyandang disabilitas.</li>
              <li>Fleksibel digunakan di berbagai perangkat.</li>
            </ul>
          </div>
          <div class="materi-proscons-card cons">
            <h4>❌ Kekurangan</h4>
            <ul>
              <li>Sulit mengenali suara di lingkungan ramai/bising.</li>
              <li>Dipengaruhi oleh aksen dan cara berbicara.</li>
              <li>Berpotensi disalahgunakan jika keamanan biometrik rendah.</li>
            </ul>
          </div>
        </div>
        <p>Kendala utama dalam pengenalan pola suara umumnya berasal dari lingkungan sekitar, terutama noise latar (background noise) yang bercampur dengan suara utama yang ingin dianalisis. Inilah sebabnya tahap preprocessing pada pengenalan suara sangat menekankan pada pembersihan sinyal — semakin bising lingkungan tempat suara direkam, semakin besar pula tantangan bagi sistem untuk mengenalinya secara akurat.</p>

        <h3>Perbandingan Pola Citra vs Pola Suara</h3>
        <p>Setelah mempelajari kedua jenis pengenalan pola secara terpisah, akan lebih mudah memahami perbedaan sekaligus persamaan keduanya melalui tabel perbandingan berikut. Meskipun keduanya menggunakan alur kerja yang mirip (akuisisi → preprocessing → ekstraksi fitur → klasifikasi), jenis data dan cara analisisnya cukup berbeda.</p>
        <div class="materi-table-wrap">
          <table class="materi-table">
            <thead>
              <tr>
                <th>Kategori Perbandingan</th>
                <th>Pengenalan Pola Citra</th>
                <th>Pengenalan Pola Suara</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Data Utama</td>
                <td>Menggunakan gambar / visual</td>
                <td>Menggunakan suara / gelombang audio</td>
              </tr>
              <tr>
                <td>Bentuk Input</td>
                <td>Foto, bingkai video, citra digital</td>
                <td>Rekaman suara, sinyal audio mikrofon</td>
              </tr>
              <tr>
                <td>Fokus Pengenalan</td>
                <td>Mengenali objek, wajah, bentuk, tulisan</td>
                <td>Mengenali ucapan (kata) atau identitas pembicara</td>
              </tr>
              <tr>
                <td>Perangkat Input Utama</td>
                <td>Kamera, pemindai (scanner), sensor optik</td>
                <td>Mikrofon, sensor audio</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Meskipun berbeda jenis data, keduanya sama-sama menjadi bagian penting dari kemampuan "pancaindra" AI, dan seringkali digunakan bersamaan dalam satu sistem — misalnya pada mobil otonom yang menggunakan kamera (citra) sekaligus mikrofon (suara) untuk memahami lingkungan sekitarnya secara lebih menyeluruh. Pada topik selanjutnya, kita akan membahas lebih dalam bagaimana AI sebenarnya "belajar" dari data hingga bisa melakukan seluruh proses pengenalan pola yang sudah kamu pelajari ini.</p>
      `
    },

    "cara-kerja-ai": {
      icon: "fa-brain",
      tag: "Machine Learning",
      title: "Cara Kerja AI dalam Mengenali Pola",
      body: `
        <p class="materi-summary">AI membantu komputer belajar dari banyak contoh data sehingga mampu mengenali wajah, mengenali suara, mengklasifikasikannya, dan memberikan keputusan secara otomatis. Semakin banyak data yang dipelajari, tingkat akurasinya akan semakin tinggi.</p>

        <p>Setelah mempelajari tahapan pengenalan pola citra dan suara secara terpisah pada topik sebelumnya, kini saatnya kita melihat gambaran yang lebih menyeluruh: bagaimana sebenarnya AI "belajar" hingga bisa melakukan seluruh proses tersebut? Berbeda dengan program komputer biasa yang dijalankan berdasarkan aturan yang ditulis manual oleh manusia (misalnya "jika suhu di atas 30°C, nyalakan kipas"), AI — khususnya cabang yang disebut <strong>Machine Learning</strong> — justru belajar aturannya sendiri dari data. Programmer tidak menuliskan aturan "wajah manusia punya dua mata dan satu hidung", tetapi cukup memberikan ribuan contoh foto wajah, dan AI akan menemukan sendiri pola-pola yang menjadi ciri khas sebuah wajah.</p>

        <h3>Alur Kerja AI Mengenali Pola</h3>
        <p>Proses belajar ini terjadi melalui lima tahapan utama yang saling berkaitan. Kelima tahap ini pada dasarnya adalah versi yang lebih umum dari tahapan yang sudah kamu pelajari pada topik Pengenalan Pola Citra dan Pola Suara sebelumnya — hanya kali ini kita melihatnya dari sudut pandang bagaimana AI "belajar", bukan hanya bagaimana ia "mengenali".</p>

        <div class="materi-steps">
          <div class="materi-step">
            <span class="materi-step-num">1</span>
            <div class="materi-step-body">
              <h4>Training Data</h4>
              <p>Segala sesuatu bermula dari data. Sistem diberi contoh data citra/suara dalam jumlah besar beserta labelnya — misalnya ribuan foto yang masing-masing sudah diberi keterangan "kucing" atau "anjing". Label inilah yang menjadi "kunci jawaban" yang akan digunakan AI untuk belajar. Tanpa label yang benar, AI tidak akan tahu apakah tebakannya sudah tepat atau belum.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">2</span>
            <div class="materi-step-body">
              <h4>Belajar Pola</h4>
              <p>Model mempelajari keteraturan dan karakteristik yang membedakan setiap kelas data. Pada tahap ini, AI mencoba menemukan pola secara berulang-ulang — melihat data, membuat tebakan, membandingkan tebakan dengan label sebenarnya, lalu memperbaiki dirinya sedikit demi sedikit jika tebakannya salah. Proses "coba-dan-perbaiki" ini dilakukan ribuan bahkan jutaan kali hingga model menjadi cukup baik dalam mengenali pola.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">3</span>
            <div class="materi-step-body">
              <h4>Ekstraksi Fitur</h4>
              <p>Data mentah diubah menjadi angka-angka penting (fitur) yang mewakili ciri khasnya. Sama seperti yang sudah dibahas pada topik sebelumnya, fitur ini bisa berupa tepi dan bentuk pada citra, atau frekuensi dan nada pada suara. Bedanya, pada Deep Learning modern seperti CNN, fitur-fitur ini tidak perlu ditentukan secara manual oleh manusia — AI menemukan sendiri fitur mana yang paling penting selama proses belajar berlangsung.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">4</span>
            <div class="materi-step-body">
              <h4>Klasifikasi</h4>
              <p>Fitur dicocokkan dengan pola yang telah dipelajari untuk menentukan kelas/kategori. Setelah model selesai belajar, ia sudah memiliki semacam "peta" tentang ciri-ciri khas dari setiap kategori data, sehingga siap digunakan untuk mengenali data baru yang belum pernah dilihat sebelumnya.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">5</span>
            <div class="materi-step-body">
              <h4>Prediksi</h4>
              <p>Sistem menghasilkan hasil akhir berupa label dan tingkat keyakinan (confidence). Tingkat keyakinan ini penting untuk diperhatikan — sebuah prediksi dengan confidence 95% menunjukkan model sangat yakin dengan jawabannya, sedangkan confidence 55% menunjukkan model masih ragu-ragu, dan hasilnya perlu diperlakukan dengan lebih hati-hati.</p>
            </div>
          </div>
        </div>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-bullseye"></i></span>
          <div class="materi-highlight-body">
            <strong>🎯 Inti Materi</strong>
            <p>Semakin banyak dan beragam data yang dipelajari, semakin tinggi pula tingkat akurasi model AI dalam mengenali pola baru.</p>
          </div>
        </div>

        <h3>Peran Dataset terhadap Akurasi</h3>
        <p>Kualitas dan jumlah data pelatihan (dataset) adalah salah satu faktor paling menentukan keberhasilan sebuah model AI. Bayangkan jika seorang anak hanya pernah melihat kucing berwarna oranye sepanjang hidupnya — ketika ia melihat kucing berwarna hitam, ia mungkin akan ragu apakah itu benar-benar kucing. Hal yang sama berlaku pada AI: jika dataset yang digunakan terlalu sedikit atau kurang beragam, model akan kesulitan mengenali variasi data baru yang berbeda dari contoh yang pernah dipelajarinya.</p>
        <p>Sebaliknya, dataset yang besar dan beragam — mencakup berbagai sudut pandang, pencahayaan, warna, aksen, maupun kondisi lingkungan — akan membuat model lebih "berpengalaman" dan mampu mengenali pola dengan lebih akurat pada situasi yang bervariasi. Inilah sebabnya perusahaan-perusahaan teknologi besar mengumpulkan dataset dalam jumlah sangat besar untuk melatih sistem AI mereka, mulai dari asisten suara hingga mobil otonom.</p>

        <h3>Hubungan dengan KKA (Berpikir Komputasional)</h3>
        <p>Menariknya, proses berpikir yang dilakukan AI di atas sebenarnya sangat mirip dengan kerangka Berpikir Komputasional (KKA) yang mungkin sudah kamu pelajari di mata pelajaran Informatika. Dalam KKA, materi pengenalan pola melatih beberapa kemampuan kunci berikut:</p>
        <ul>
          <li><strong>Analisis Pola</strong> — mengamati kesamaan karakteristik pada data.</li>
          <li><strong>Logika Klasifikasi</strong> — mengelompokkan data berdasarkan kategori tertentu.</li>
          <li><strong>Kemampuan Membedakan Ciri</strong> — mengetahui perbedaan mendasar antar variabel.</li>
          <li><strong>Penarikan Kesimpulan</strong> — memprediksi/menentukan hasil berdasarkan aturan pola.</li>
        </ul>
        <p>Dengan kata lain, belajar tentang cara kerja AI bukan hanya mengajarkanmu tentang teknologi, tetapi juga melatih cara berpikir yang sistematis dan logis — kemampuan yang berguna bahkan di luar konteks pemrograman maupun kecerdasan buatan.</p>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-lightbulb"></i></span>
          <div class="materi-highlight-body">
            <strong>💡 Tahukah Kamu?</strong>
            <p>Contoh soal KKA yang berkaitan dengan materi ini misalnya: menentukan pola gambar selanjutnya, membedakan pola suara tinggi/rendah, atau mengklasifikasikan objek berdasarkan ciri khasnya.</p>
          </div>
        </div>
      `
    },

    metode: {
      icon: "fa-diagram-project",
      tag: "Teknik & Algoritma",
      title: "Metode dalam Pengenalan Pola",
      body: `
        <p class="materi-summary">Terdapat berbagai metode yang digunakan dalam pengenalan pola, mulai dari pendekatan klasik yang sederhana hingga pendekatan modern berbasis Deep Learning yang jauh lebih kompleks.</p>

        <p>Pada topik-topik sebelumnya, kamu sudah beberapa kali menemukan istilah seperti Template Matching, Machine Learning, CNN, HMM, dan RNN disebutkan sekilas. Pada bagian ini, kita akan mengumpulkan dan membahasnya secara lebih terstruktur sebagai satu kesatuan "kotak peralatan" (toolbox) yang digunakan dalam pengenalan pola, baik untuk citra maupun suara. Memahami metode-metode ini penting agar kamu tahu bahwa tidak ada satu metode yang selalu terbaik — setiap metode memiliki kelebihan tersendiri tergantung jenis data dan kebutuhan sistem.</p>

        <p>Secara umum, metode pengenalan pola dapat dikelompokkan menjadi tiga pendekatan besar, mulai dari yang paling sederhana hingga yang paling canggih:</p>

        <div class="materi-example-grid cols-3">
          <div class="materi-example-card">
            <span class="materi-example-emoji">📌</span>
            <h4>Template Matching</h4>
            <p>Mencocokkan gambar/data baru dengan pola contoh (template) yang sudah tersimpan sebelumnya.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🤖</span>
            <h4>Machine Learning</h4>
            <p>Model belajar dari fitur-fitur data untuk mengenali pola tanpa aturan yang ditulis secara eksplisit.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🧠</span>
            <h4>Deep Learning</h4>
            <p>Menggunakan jaringan saraf tiruan berlapis-lapis untuk mempelajari pola yang jauh lebih kompleks.</p>
          </div>
        </div>

        <p><strong>Template Matching</strong> adalah pendekatan paling klasik dan paling mudah dipahami: sistem hanya membandingkan data baru dengan satu atau beberapa "contoh cetakan" (template) yang sudah disimpan, lalu mencari kecocokan paling mirip. Metode ini sederhana dan cepat, tetapi memiliki kelemahan besar — ia sangat kaku dan mudah gagal jika data baru sedikit berbeda dari template, misalnya karena perbedaan sudut, ukuran, atau pencahayaan.</p>

        <p><strong>Machine Learning</strong> hadir untuk mengatasi keterbatasan tersebut. Alih-alih membandingkan langsung dengan template tetap, sistem belajar mengenali pola dari fitur-fitur data secara lebih fleksibel, sehingga mampu mengenali variasi yang lebih luas — misalnya wajah yang sama meskipun difoto dari sudut yang berbeda-beda. Namun, pada pendekatan Machine Learning klasik, fitur-fitur penting biasanya masih perlu ditentukan secara manual oleh manusia.</p>

        <p><strong>Deep Learning</strong> merupakan pengembangan lebih lanjut dari Machine Learning, dengan menggunakan struktur jaringan saraf tiruan (neural network) yang berlapis-lapis — semakin banyak lapisannya, semakin "dalam" jaringan tersebut, sehingga disebut Deep Learning. Keunggulan utama Deep Learning adalah kemampuannya menemukan fitur-fitur penting secara otomatis dari data mentah, tanpa perlu ditentukan manual oleh manusia. Inilah yang membuat Deep Learning menjadi pendekatan paling populer dan paling akurat untuk pengenalan pola citra maupun suara di masa kini, termasuk yang digunakan pada Google Teachable Machine yang akan kamu pelajari dan coba langsung pada topik selanjutnya.</p>

        <h3>Algoritma Populer di Balik Deep Learning</h3>
        <p>Di dalam Deep Learning sendiri, terdapat beberapa arsitektur jaringan saraf yang dirancang khusus untuk jenis data tertentu. Berikut beberapa arsitektur yang paling sering digunakan dalam pengenalan pola citra dan suara.</p>
        <div class="materi-example-grid">
          <div class="materi-example-card">
            <span class="materi-example-emoji">🖼️</span>
            <h4>CNN (Convolutional Neural Network)</h4>
            <p>Arsitektur deep learning yang sangat efektif untuk mengenali pola pada citra/gambar.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🔊</span>
            <h4>HMM (Hidden Markov Model)</h4>
            <p>Model probabilistik yang umum digunakan pada pengenalan pola suara/ucapan.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🔁</span>
            <h4>RNN (Recurrent Neural Network)</h4>
            <p>Cocok untuk data berurutan (sekuensial) seperti sinyal suara dan teks.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">⏳</span>
            <h4>LSTM</h4>
            <p>Pengembangan dari RNN yang mampu "mengingat" konteks dalam jangka waktu lebih panjang.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🕸️</span>
            <h4>Neural Network</h4>
            <p>Fondasi dasar dari berbagai arsitektur AI modern, meniru cara kerja neuron otak manusia.</p>
          </div>
        </div>

        <p>Perbedaan mendasar antara CNN dengan RNN/LSTM terletak pada jenis data yang paling cocok diolahnya. CNN dirancang untuk data berbentuk "grid" atau matriks seperti gambar, di mana hubungan antar-piksel yang berdekatan menjadi informasi penting. Sebaliknya, RNN dan LSTM dirancang untuk data yang bersifat berurutan seperti suara atau teks, di mana urutan kemunculan data — bunyi apa yang muncul sebelum dan sesudahnya — menjadi informasi yang sama pentingnya dengan datanya itu sendiri.</p>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-thumbtack"></i></span>
          <div class="materi-highlight-body">
            <strong>📌 Poin Penting</strong>
            <p>CNN umumnya dipilih untuk mengolah data citra, sedangkan HMM, RNN, dan LSTM lebih cocok untuk data suara atau data yang berurutan (sekuensial). Pemilihan metode selalu disesuaikan dengan jenis data, jumlah data, dan tingkat akurasi yang dibutuhkan.</p>
          </div>
        </div>

        <p>Dengan memahami berbagai metode ini, kamu akan lebih siap untuk melihat penerapannya secara nyata pada topik selanjutnya — mulai dari penerapan pengenalan pola di berbagai bidang kehidupan, hingga mencoba melatih model AI-mu sendiri menggunakan Google Teachable Machine.</p>
      `
    },

    penerapan: {
      icon: "fa-rocket",
      tag: "Studi Kasus",
      title: "Penerapan Pengenalan Pola di Kehidupan Sehari-hari",
      body: `
        <p class="materi-summary">Pengenalan pola citra dan suara telah diterapkan secara luas di berbagai bidang kehidupan. Berikut pengelompokan penerapannya berdasarkan bidang.</p>

        <p>Setelah memahami konsep, tahapan, dan metode di balik pengenalan pola pada topik-topik sebelumnya, kini saatnya kita melihat bagaimana seluruh teori tersebut benar-benar diterapkan dalam kehidupan sehari-hari. Kamu mungkin akan terkejut mengetahui bahwa teknologi ini sudah jauh lebih dekat dengan kesehatanmu daripada yang kamu bayangkan — mulai dari saat kamu membuka kunci smartphone di pagi hari, hingga saat kamu meminta asisten virtual memutar lagu favoritmu.</p>

        <p>Penerapan pengenalan pola dapat kita temukan hampir di setiap bidang kehidupan modern. Berikut adalah beberapa bidang utama beserta contoh penerapannya masing-masing.</p>

        <div class="materi-field-grid">
          <div class="materi-field-card">
            <span class="materi-field-emoji">🎓</span>
            <h4>Pendidikan</h4>
            <p>Absensi otomatis berbasis wajah dan koreksi tulisan tangan otomatis.</p>
          </div>
          <div class="materi-field-card">
            <span class="materi-field-emoji">🏥</span>
            <h4>Kesehatan</h4>
            <p>Membantu dokter mendeteksi penyakit lewat citra X-ray dan MRI.</p>
          </div>
          <div class="materi-field-card">
            <span class="materi-field-emoji">🚓</span>
            <h4>Keamanan</h4>
            <p>CCTV pintar, Face Recognition untuk akses ruangan, dan Voice Verification.</p>
          </div>
          <div class="materi-field-card">
            <span class="materi-field-emoji">🚗</span>
            <h4>Transportasi</h4>
            <p>Mobil tanpa pengemudi (Autonomous Vehicle) serta deteksi rambu dan pelanggaran lalu lintas.</p>
          </div>
          <div class="materi-field-card">
            <span class="materi-field-emoji">📱</span>
            <h4>Smartphone</h4>
            <p>Face ID / Face Unlock dan Voice Unlock untuk membuka kunci perangkat.</p>
          </div>
          <div class="materi-field-card">
            <span class="materi-field-emoji">💰</span>
            <h4>Perbankan</h4>
            <p>Autentikasi biometrik suara untuk transaksi dan layanan perbankan yang lebih aman.</p>
          </div>
          <div class="materi-field-card">
            <span class="materi-field-emoji">🏠</span>
            <h4>Smart Home</h4>
            <p>Asisten suara mengenali ucapan pengguna untuk mengendalikan lampu, AC, dan TV.</p>
          </div>
        </div>

        <p>Di bidang <strong>pendidikan</strong>, teknologi ini membantu sekolah dan kampus mengotomatiskan proses administratif seperti absensi, sekaligus membantu proses digitalisasi dokumen melalui koreksi tulisan tangan otomatis. Di bidang <strong>kesehatan</strong>, kemampuan AI dalam menganalisis pola pada citra medis seperti X-ray dan MRI membantu tenaga medis mendeteksi kelainan atau penyakit dengan lebih cepat, meskipun keputusan akhir tetap berada di tangan dokter sebagai ahli medis.</p>

        <p>Di bidang <strong>keamanan</strong> dan <strong>transportasi</strong>, pengenalan pola menjadi tulang punggung dari sistem CCTV pintar, kendaraan otonom, hingga deteksi pelanggaran lalu lintas secara otomatis — semuanya mengandalkan kemampuan komputer "melihat" dan menganalisis lingkungan sekitarnya secara real-time. Sementara pada perangkat yang lebih personal seperti <strong>smartphone</strong> dan layanan <strong>perbankan</strong>, pengenalan pola citra dan suara digunakan sebagai lapisan keamanan biometrik yang jauh lebih sulit dipalsukan dibandingkan kata sandi biasa. Terakhir, di rumah, sistem <strong>Smart Home</strong> memanfaatkan pengenalan pola suara agar penghuni rumah bisa mengendalikan berbagai perangkat elektronik hanya dengan perintah suara.</p>

        <p>Jika diperhatikan, hampir seluruh contoh di atas menggunakan kombinasi dari konsep-konsep yang sudah kamu pelajari sebelumnya: akuisisi data, preprocessing, ekstraksi fitur, hingga klasifikasi — baik itu diterapkan pada citra maupun suara. Ini menunjukkan bahwa satu kerangka konsep dasar pengenalan pola dapat diadaptasi untuk menyelesaikan berbagai masalah yang sangat beragam di dunia nyata.</p>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-lightbulb"></i></span>
          <div class="materi-highlight-body">
            <strong>💡 Tahukah Kamu?</strong>
            <p>Semakin banyak bidang yang mengadopsi teknologi ini, semakin besar pula peluang dan kebutuhan generasi muda untuk memahami dasar-dasar Artificial Intelligence sejak dini.</p>
          </div>
        </div>

        <p>Setelah melihat betapa luasnya penerapan pengenalan pola dalam kehidupan sehari-hari, pada topik terakhir kamu akan mendapat kesempatan untuk mencoba membuat model AI sederhana milikmu sendiri menggunakan Google Teachable Machine — sebuah alat yang akan membantumu memahami seluruh konsep di modul ini secara lebih nyata dan interaktif.</p>
      `
    },

    "teachable-machine": {
      icon: "fa-cubes",
      tag: "Praktik Langsung",
      title: "Mengenal Google Teachable Machine",
      body: `
        <p class="materi-summary"><strong>Teachable Machine</strong> adalah platform berbasis web buatan Google yang dirancang untuk memperkenalkan konsep Machine Learning secara cepat, mudah, dan visual tanpa perlu menulis kode pemrograman (<em>no-code</em>). Alat ini sangat cocok untuk mempraktikkan pengenalan pola citra, suara, maupun pose tubuh secara langsung di browser.</p>

        <p>Sepanjang modul ini, kamu sudah mempelajari banyak konsep teoritis — mulai dari pengertian pengenalan pola, tahapan pengenalan pola citra dan suara, cara kerja AI dalam belajar dari data, hingga berbagai metode dan algoritma yang digunakan. Semua itu mungkin masih terasa abstrak jika hanya dibaca sebagai teori. Di sinilah Teachable Machine berperan penting: alat ini memungkinkanmu benar-benar <em>mempraktikkan</em> proses "training data" hingga "klasifikasi" yang sudah kamu pelajari, tanpa perlu keahlian pemrograman sama sekali.</p>

        <p>Konsep <em>no-code</em> yang diusung Teachable Machine berarti kamu tidak perlu menulis satu baris kode pun untuk melatih model AI-mu sendiri. Seluruh proses dilakukan melalui antarmuka visual yang tinggal klik dan seret (drag-and-drop), sehingga siapa pun — termasuk siswa SMA yang baru pertama kali belajar AI — dapat langsung mencoba dan memahami bagaimana rasanya "melatih" sebuah model machine learning dari nol.</p>

        <div class="materi-highlight">
          <span class="materi-highlight-icon"><i class="fa-solid fa-lightbulb"></i></span>
          <div class="materi-highlight-body">
            <strong>💡 Tahukah Kamu?</strong>
            <p>Teachable Machine bisa langsung dicoba di browser tanpa perlu instalasi apa pun — cukup buka <strong>teachablemachine.withgoogle.com</strong>.</p>
          </div>
        </div>

        <h3>Jenis Project yang Dapat Dibuat</h3>
        <p>Teachable Machine menyediakan tiga jenis proyek yang bisa dipilih sesuai dengan jenis data yang ingin kamu latih. Ketiganya menggunakan prinsip dasar yang sama — mengumpulkan data, melatih model, lalu mengujinya — namun diterapkan pada jenis input yang berbeda.</p>
        <div class="materi-example-grid cols-3">
          <div class="materi-example-card">
            <span class="materi-example-emoji">🖼️</span>
            <h4>Image Project</h4>
            <p>Melatih model mengenali objek/ekspresi dari gambar atau webcam, misalnya membedakan masker dan tanpa masker.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🎧</span>
            <h4>Audio Project</h4>
            <p>Melatih model mengenali kata atau suara tertentu dari mikrofon, misalnya siulan atau tepuk tangan.</p>
          </div>
          <div class="materi-example-card">
            <span class="materi-example-emoji">🕺</span>
            <h4>Pose Project</h4>
            <p>Melatih model mengenali posisi atau gerakan tubuh manusia, misalnya berdiri, duduk, atau mengangkat tangan.</p>
          </div>
        </div>
        <p><strong>Image Project</strong> paling erat kaitannya dengan materi Pengenalan Pola Citra yang sudah kamu pelajari — cocok digunakan untuk melatih model mengenali objek, ekspresi wajah, atau kategori gambar tertentu, persis seperti fitur Simulasi AI pada website PatternLab ini yang dilatih untuk mengenali lima jenis buah. <strong>Audio Project</strong> berkaitan dengan materi Pengenalan Pola Suara, digunakan untuk melatih model mengenali suara atau bunyi tertentu dari mikrofon. Sementara <strong>Pose Project</strong> merupakan pengembangan lebih lanjut yang memanfaatkan pengenalan pola citra untuk mendeteksi posisi tubuh manusia, sering digunakan pada aplikasi kebugaran atau permainan interaktif.</p>

        <h3>3 Langkah Utama Kerja Teachable Machine</h3>
        <p>Menariknya, meskipun tampilannya sederhana, ketiga langkah utama pada Teachable Machine ini sebenarnya adalah representasi visual dari konsep "Alur Kerja AI Mengenali Pola" yang sudah kamu pelajari pada topik sebelumnya (Training Data, Belajar Pola, hingga Prediksi) — hanya dikemas dengan cara yang jauh lebih sederhana dan mudah diikuti.</p>
        <div class="materi-steps">
          <div class="materi-step">
            <span class="materi-step-num">1</span>
            <div class="materi-step-body">
              <h4>Gather / Collect Data</h4>
              <p>Mengumpulkan dan mengelompokkan sampel data (gambar atau suara) ke dalam kelas-kelas kategori yang ditentukan. Tahap ini setara dengan proses training data — semakin banyak dan beragam sampel yang dikumpulkan untuk setiap kelas, semakin baik pula kemampuan model dalam mengenali variasi data di kemudian hari.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">2</span>
            <div class="materi-step-body">
              <h4>Train Model</h4>
              <p>Menekan tombol Train agar komputer menganalisis pola dan mengekstrak ciri-ciri dari sampel data yang diunggah. Di balik layar, Teachable Machine menjalankan proses Deep Learning (menggunakan arsitektur mirip CNN untuk data gambar) secara otomatis — kamu tidak perlu memahami detail matematis di baliknya untuk bisa melihat hasilnya.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">3</span>
            <div class="materi-step-body">
              <h4>Export & Test Model</h4>
              <p>Menguji model secara langsung menggunakan webcam/mikrofon, lalu meng-export model untuk digunakan pada aplikasi lain. Pada tahap ini kamu bisa langsung melihat tingkat keyakinan (confidence) dari setiap prediksi yang dibuat model, persis seperti yang ditampilkan pada fitur Simulasi AI di website ini.</p>
            </div>
          </div>
        </div>

        <h3>Istilah-istilah Penting</h3>
        <p>Sebelum mencoba praktikum, ada baiknya kamu memahami beberapa istilah kunci yang akan sering muncul selama menggunakan Teachable Machine, karena istilah-istilah ini juga merupakan istilah baku dalam dunia Machine Learning secara umum.</p>
        <ul>
          <li><strong>Dataset</strong> — kumpulan sampel data (gambar/suara) yang digunakan untuk melatih model.</li>
          <li><strong>Class</strong> — kategori atau kelompok yang ingin dibedakan oleh model, misalnya "Masker" dan "Tanpa Masker".</li>
          <li><strong>Training</strong> — proses melatih model agar dapat mengenali pola dari dataset yang diberikan.</li>
          <li><strong>Model</strong> — hasil akhir dari proses training, berupa "otak" AI yang siap digunakan untuk mengenali data baru.</li>
          <li><strong>Prediction</strong> — hasil tebakan model terhadap data baru yang belum pernah dilihat sebelumnya.</li>
          <li><strong>Confidence</strong> — tingkat keyakinan model terhadap prediksi yang dibuatnya, biasanya ditampilkan dalam bentuk persentase.</li>
        </ul>

        <h3>Langkah Praktikum Sederhana (Klasifikasi Gambar)</h3>
        <p>Agar lebih memahami seluruh proses di atas secara nyata, berikut simulasi langkah-langkah praktikum sederhana menggunakan studi kasus klasifikasi gambar — membedakan orang yang menggunakan masker dan yang tidak menggunakan masker.</p>
        <div class="materi-steps">
          <div class="materi-step">
            <span class="materi-step-num">1</span>
            <div class="materi-step-body">
              <h4>Buka Situs Resmi</h4>
              <p>Kunjungi teachablemachine.withgoogle.com melalui browser.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">2</span>
            <div class="materi-step-body">
              <h4>Pilih Get Started</h4>
              <p>Pilih Image Project (Standard Image Model).</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">3</span>
            <div class="materi-step-body">
              <h4>Buat Class (Kategori)</h4>
              <p>Contoh: Class 1 "Menggunakan Masker" dan Class 2 "Tanpa Masker".</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">4</span>
            <div class="materi-step-body">
              <h4>Ambil Sampel Data</h4>
              <p>Gunakan webcam atau unggah foto sesuai kategorinya (minimal 20–30 sampel per kelas).</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">5</span>
            <div class="materi-step-body">
              <h4>Train Model</h4>
              <p>Klik tombol Train Model dan tunggu proses pelatihan selesai.</p>
            </div>
          </div>
          <div class="materi-step">
            <span class="materi-step-num">6</span>
            <div class="materi-step-body">
              <h4>Uji Hasil</h4>
              <p>Uji hasilnya pada panel Preview dengan mengarahkan objek ke kamera untuk melihat persentase prediksi.</p>
            </div>
          </div>
        </div>

        <p>Setelah model selesai dilatih dan diuji, kamu bisa mengevaluasi hasilnya: apakah model sudah cukup akurat dalam membedakan kedua kelas tersebut, ataukah masih sering salah menebak? Jika hasilnya belum memuaskan, biasanya penyebabnya kembali lagi ke dasar-dasar yang sudah kamu pelajari sepanjang modul ini — bisa jadi karena jumlah sampel data yang kurang banyak, kondisi pencahayaan yang tidak konsisten, atau kedua kelas memiliki ciri visual yang terlalu mirip sehingga sulit dibedakan.</p>

        <h3>Kesimpulan Utama</h3>
        <p>Sampai di sini, kamu sudah menempuh perjalanan panjang mempelajari dunia pengenalan pola — mulai dari konsep dasar hingga praktik nyata. Berikut rangkuman poin-poin terpenting yang perlu kamu ingat dari keseluruhan modul ini.</p>
        <ul>
          <li>Pengenalan Pola adalah kemampuan komputer mengenali suatu objek berdasarkan ciri tertentu menggunakan AI.</li>
          <li>Pengenalan Citra menggunakan data gambar/visual sebagai input, sedangkan Pengenalan Suara menggunakan audio/gelombang suara.</li>
          <li>Teknologi ini berperan penting di berbagai bidang modern seperti kesehatan, keamanan, transportasi, dan pendidikan.</li>
          <li>Teachable Machine memberikan sarana praktis untuk memahami secara nyata bagaimana Machine Learning melatih data citra dan suara secara interaktif.</li>
        </ul>
        <p>Memahami dasar-dasar pengenalan pola bukan hanya tentang mengetahui cara kerja teknologi di baliknya, tetapi juga membekalimu dengan cara berpikir yang akan semakin relevan di masa depan — di mana AI akan semakin banyak hadir dalam berbagai aspek kehidupan. Kini saatnya kamu mempraktikkan seluruh pemahaman ini secara langsung.</p>

        <div class="cta-band">
          <div class="cta-band-text">
            <h3>🚀 Coba Sekarang!</h3>
            <p>Kamu sudah memahami teori. Sekarang saatnya mencoba model AI secara langsung menggunakan fitur Simulasi AI pada website PatternLab.</p>
          </div>
          <a href="simulasi.html" class="btn btn-outline">Buka Simulasi AI <i class="fa-solid fa-arrow-right"></i></a>
        </div>
      `
    }
  };

  var sidebarItems = document.querySelectorAll(".materi-nav-item");
  var mobileSelect = document.getElementById("materiMobileSelect");

  function renderTopic(key) {
    var data = materiData[key];
    if (!data) return;

    contentArea.style.opacity = 0;

    setTimeout(function () {
      contentArea.innerHTML =
        '<div class="materi-content-header">' +
        '<div class="materi-content-icon"><i class="fa-solid ' + data.icon + '"></i></div>' +
        "<h2>" + data.title + "</h2>" +
        "</div>" +
        '<span class="materi-tag">' + data.tag + "</span>" +
        data.body;

      contentArea.style.transition = "opacity 0.35s ease";
      contentArea.style.opacity = 1;
    }, 150);

    sidebarItems.forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-topic") === key);
    });

    if (mobileSelect) mobileSelect.value = key;
  }

  sidebarItems.forEach(function (item) {
    item.addEventListener("click", function () {
      renderTopic(item.getAttribute("data-topic"));
      window.scrollTo({ top: contentArea.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
    });
  });

  if (mobileSelect) {
    mobileSelect.addEventListener("change", function () {
      renderTopic(mobileSelect.value);
    });
  }

  // Render topik pertama secara default — kecuali ada topik yang "dititipkan"
  // dari halaman lain (mis. tombol "Pelajari di Materi" pada Peta Konsep),
  // lihat patternLabGoToMateriTopic() di bagian bawah file ini.
  var pendingMateriTopic = null;
  try {
    pendingMateriTopic = sessionStorage.getItem("patternlab_pending_materi_topic");
    if (pendingMateriTopic) sessionStorage.removeItem("patternlab_pending_materi_topic");
  } catch (err) {
    pendingMateriTopic = null;
  }

  if (pendingMateriTopic && materiData[pendingMateriTopic]) {
    renderTopic(pendingMateriTopic);
    // Beri jeda singkat agar preloader/animasi halaman selesai dulu sebelum scroll.
    setTimeout(function () {
      contentArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 500);
  } else {
    renderTopic("pengertian");
  }

  /* ----------------------------------------------------------------------
     Tombol "Tandai Materi Selesai" — menyimpan status materi ke progress
     terpusat. Jika sebelumnya sudah ditandai selesai (mis. setelah login
     kembali), tampilkan langsung status selesai tanpa perlu klik ulang.
     ---------------------------------------------------------------------- */
  var completeBtn = document.getElementById("materiCompleteBtn");
  var completeLabel = document.getElementById("materiCompleteBtnLabel");

  function reflectMateriStatus() {
    if (!completeBtn) return;
    var progress = typeof PatternLabProgress !== "undefined" ? PatternLabProgress.loadProgress() : {};
    var done = !!progress.materi;
    completeBtn.classList.toggle("is-done", done);
    if (completeLabel) completeLabel.textContent = done ? "✓ Materi Selesai" : "Tandai Materi Selesai";
  }

  if (completeBtn) {
    reflectMateriStatus();
    completeBtn.addEventListener("click", function () {
      if (typeof PatternLabProgress === "undefined") return;
      PatternLabProgress.updateProgress("materi", true);
      reflectMateriStatus();
    });
  }

  /* ----------------------------------------------------------------------
     Tombol "Tandai Sudah Membaca Tujuan Pembelajaran" — sama persis
     polanya dengan tombol "Tandai Materi Selesai" di atas, hanya
     menyimpan ke key progress yang berbeda ("tujuan"). Sengaja perlu
     diklik dulu (bukan otomatis selesai begitu halaman dibuka).
     ---------------------------------------------------------------------- */
  var tujuanBtn = document.getElementById("tujuanCompleteBtn");
  var tujuanLabel = document.getElementById("tujuanCompleteBtnLabel");

  function reflectTujuanStatus() {
    if (!tujuanBtn) return;
    var progress = typeof PatternLabProgress !== "undefined" ? PatternLabProgress.loadProgress() : {};
    var done = !!progress.tujuan;
    tujuanBtn.classList.toggle("is-done", done);
    if (tujuanLabel) tujuanLabel.textContent = done ? "✓ Tujuan Pembelajaran Sudah Dibaca" : "Tandai Sudah Membaca Tujuan Pembelajaran";
  }

  if (tujuanBtn) {
    reflectTujuanStatus();
    tujuanBtn.addEventListener("click", function () {
      if (typeof PatternLabProgress === "undefined") return;
      PatternLabProgress.updateProgress("tujuan", true);
      reflectTujuanStatus();
    });
  }
}

/* --------------------------------------------------------------------------
   6. HALAMAN VIDEO: tombol putar (placeholder player, kompatibel mundur)
   -------------------------------------------------------------------------- */
function initVideoPage() {
  var playButtons = document.querySelectorAll(".video-play-btn");

  playButtons.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var card = btn.closest(".video-card");
      if (card) {
        card.classList.toggle("video-player-active");
      }
    });
  });

  /* ----------------------------------------------------------------------
     Progress tracking untuk 2 video edukasi utama (Pola Citra & Pola
     Suara). Status video1/video2 disimpan TERPISAH dan hanya berubah
     menjadi selesai ketika video benar-benar diputar sampai habis
     (event "ended") — bukan hanya karena halaman dibuka.
     ---------------------------------------------------------------------- */
  var videoCards = document.querySelectorAll(".video-card[data-video-key]");
  if (!videoCards.length || typeof PatternLabProgress === "undefined") return;

  var progress = PatternLabProgress.loadProgress();

  function reflectVideoStatus(key) {
    var badge = document.getElementById("videoStatus-" + key);
    if (badge) {
      var done = !!progress[key];
      badge.textContent = done ? "✓ Selesai" : "";
      badge.classList.toggle("is-done", done);
    }
  }

  videoCards.forEach(function (card) {
    var key = card.getAttribute("data-video-key"); // "video1" atau "video2"
    var videoEl = card.querySelector(".video-native");

    reflectVideoStatus(key);

    if (videoEl) {
      videoEl.addEventListener("ended", function () {
        progress = PatternLabProgress.updateProgress(key, true);
        reflectVideoStatus(key);
      });
    }
  });
}

/* --------------------------------------------------------------------------
   6b. HALAMAN VIDEO: autoplay/pause video "Penerapan AI di Dunia Nyata"
   menggunakan Intersection Observer. Setiap video otomatis diputar (muted)
   ketika card masuk viewport, dan berhenti otomatis saat card keluar
   viewport agar tidak membebani performa halaman.
   -------------------------------------------------------------------------- */
function initAppliedVideoObserver() {
  var frames = document.querySelectorAll("[data-observe-video]");
  if (!frames.length) return;

  function playVideo(video) {
    if (!video) return;
    var playPromise = video.play();
    // Beberapa browser mengembalikan Promise yang bisa ditolak (mis. karena
    // interaksi pengguna belum terjadi); kita tangkap agar tidak muncul
    // error di console.
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {});
    }
  }

  function pauseVideo(video) {
    if (!video) return;
    video.pause();
  }

  // Video penerapan saat ini memakai embed YouTube (iframe), bukan <video>
  // asli. Untuk mengontrol play/pause secara otomatis saat masuk/keluar
  // viewport, kita kirim perintah lewat postMessage ke YouTube IFrame API
  // (butuh parameter enablejsapi=1 pada src iframe). Jika suatu saat iframe
  // diganti dengan <video> lokal (mis. hasil edit sendiri), fungsi ini tetap
  // aman karena playVideo/pauseVideo di atas menangani elemen <video> biasa.
  function postToYoutube(iframe, func) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: func, args: [] }),
        "*"
      );
    } catch (err) {
      // Jika browser tidak mengizinkan (mis. karena kebijakan otomatis-
      // putar), abaikan saja — kontrol video manual tetap tersedia.
    }
  }

  if (!("IntersectionObserver" in window)) {
    // Fallback sederhana jika browser tidak mendukung Intersection Observer.
    frames.forEach(function (frame) {
      playVideo(frame.querySelector(".applied-video"));
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target.querySelector(".applied-video");
        var iframe = entry.target.querySelector("iframe");

        if (entry.isIntersecting) {
          if (video) playVideo(video);
          if (iframe) postToYoutube(iframe, "playVideo");
        } else {
          if (video) pauseVideo(video);
          if (iframe) postToYoutube(iframe, "pauseVideo");
        }
      });
    },
    { threshold: 0.4 }
  );

  frames.forEach(function (frame) {
    observer.observe(frame);
  });
}

/* --------------------------------------------------------------------------
   7. HALAMAN SIMULASI AI: upload gambar + kamera, terhubung ke model
   Google Teachable Machine (https://teachablemachine.withgoogle.com).
   Prediksi dummy sebelumnya sudah dihapus dan digantikan dengan prediksi
   asli dari model yang telah dilatih oleh kelompok kami.
   -------------------------------------------------------------------------- */
function initSimulasiPage() {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var selectBtn = document.getElementById("selectImageBtn");
  var previewFrame = document.getElementById("previewFrame");
  var resultCardWrap = document.getElementById("resultCardWrap");
  var resultBlock = document.getElementById("predictionResult");
  var emptyResultState = document.getElementById("predictionEmptyResult");
  var predictionLabel = document.getElementById("predictionLabel");
  var predictionBadge = document.getElementById("predictionBadge");
  var confidenceFill = document.getElementById("confidenceFill");
  var confidenceValue = document.getElementById("confidenceValue");
  var confidenceList = document.getElementById("confidenceList");
  var predictionExplanation = document.getElementById("predictionExplanation");
  var resetBtn = document.getElementById("resetSimBtn");

  var aiLoading = document.getElementById("aiLoading");
  var errorBanner = document.getElementById("simErrorBanner");
  var errorText = document.getElementById("simErrorText");

  var openCameraBtn = document.getElementById("openCameraBtn");
  var closeCameraBtn = document.getElementById("closeCameraBtn");
  var captureBtn = document.getElementById("captureBtn");
  var cameraPanel = document.getElementById("cameraPanel");
  var webcamVideo = document.getElementById("webcamVideo");

  // Hentikan fungsi ini jika elemen inti halaman simulasi tidak ditemukan
  // (artinya script ini sedang dijalankan bukan di halaman simulasi.html)
  if (!dropzone || !fileInput) return;

  /* ---------------------- Panduan Simulasi: tombol "Mulai Simulasi" ---------------------- */
  var simGuideStartBtn = document.getElementById("simGuideStartBtn");
  var simulasiUploadArea = document.getElementById("simulasiUploadArea");
  if (simGuideStartBtn && simulasiUploadArea) {
    simGuideStartBtn.addEventListener("click", function () {
      simulasiUploadArea.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // URL model Google Teachable Machine milik kelompok kami
  var MODEL_URL = "https://teachablemachine.withgoogle.com/models/pLAws_2Ab/";

  var model = null;
  var modelReady = false;
  var mediaStream = null;
  var cameraLoopId = null;
  var isCameraActive = false;

  // --- State baru untuk Lab Analisis AI ---
  var currentImageEl = null; // gambar still terakhir (upload/capture) yang sedang ditampilkan
  var lastBasicPrediction = null; // { className, probability } dari prediksi utama terakhir
  var cachedGrayData = null; // { gray, w, h } hasil grayscale gambar saat ini
  var cachedEdgeData = null; // { mag, max } hasil deteksi tepi Sobel
  var convolutionAnimId = null;
  var robustnessRenderTimer = null;

  // Pemetaan nama kelas ke emoji buah untuk tampilan yang lebih hidup.
  // Pencocokan dilakukan secara fleksibel (mengandung kata kunci) agar tetap
  // berfungsi walau nama kelas pada model ditulis dengan variasi berbeda.
  var emojiMap = [
    { keys: ["apel", "apple"], emoji: "🍎" },
    { keys: ["pisang", "banana"], emoji: "🍌" },
    { keys: ["jeruk", "orange", "citrus"], emoji: "🍊" },
    { keys: ["stroberi", "strawberries"], emoji: "🍉" },
    { keys: ["mangga", "mango"], emoji: "🥭" }
  ];

  function getEmoji(className) {
    var lower = (className || "").toLowerCase();
    for (var i = 0; i < emojiMap.length; i++) {
      for (var j = 0; j < emojiMap[i].keys.length; j++) {
        if (lower.indexOf(emojiMap[i].keys[j]) !== -1) return emojiMap[i].emoji;
      }
    }
    return "🔍";
  }

  /* ---------------------- Memuat model Teachable Machine ---------------------- */
  function loadModel() {
    if (typeof tmImage === "undefined") {
      showError("Library Teachable Machine gagal dimuat. Periksa koneksi internetmu, lalu muat ulang halaman.");
      return;
    }

    var modelURL = MODEL_URL + "model.json";
    var metadataURL = MODEL_URL + "metadata.json";

    tmImage
      .load(modelURL, metadataURL)
      .then(function (loadedModel) {
        model = loadedModel;
        modelReady = true;
        hideError();
      })
      .catch(function () {
        showError("Model AI gagal dimuat. Periksa koneksi internetmu, lalu coba muat ulang halaman.");
      });
  }

  /* ---------------------- Utilitas UI: loading & error ---------------------- */
  function showLoading() {
    if (aiLoading) aiLoading.style.display = "flex";
  }

  function hideLoading() {
    if (aiLoading) aiLoading.style.display = "none";
  }

  function showError(message) {
    if (errorText) errorText.textContent = message;
    if (errorBanner) errorBanner.style.display = "flex";
    hideLoading();
  }

  function hideError() {
    if (errorBanner) errorBanner.style.display = "none";
  }

  function resetResultCard() {
    if (resultBlock) resultBlock.classList.remove("show");
    if (emptyResultState) emptyResultState.style.display = "flex";
    if (resultCardWrap) resultCardWrap.classList.remove("result-glow");
    if (confidenceFill) confidenceFill.style.width = "0%";
    if (confidenceList) confidenceList.innerHTML = "";
    hideLoading();
    hideError();
  }

  /* ---------------------- Upload Gambar ---------------------- */
  function openFileDialog() {
    fileInput.click();
  }

  if (selectBtn) {
    selectBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openFileDialog();
    });
  }

  dropzone.addEventListener("click", function (e) {
    if (e.target.closest("#openCameraBtn")) return;
    openFileDialog();
  });

  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files.length) {
      handleFile(fileInput.files[0]);
    }
  });

  function handleFile(file) {
    closeCamera();
    hideError();

    if (!file || file.type.indexOf("image/") !== 0) {
      showError("File yang diunggah bukan gambar yang valid. Silakan pilih file JPG, PNG, atau WEBP.");
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () {
      showError("Gagal membaca file gambar. Silakan coba unggah ulang.");
    };
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        previewFrame.innerHTML = "";
        previewFrame.appendChild(img);
        var scanLine = document.createElement("div");
        scanLine.className = "scanning-line";
        previewFrame.appendChild(scanLine);
        previewFrame.classList.add("scanning");

        currentImageEl = img;
        refreshLabPanel();

        predictImage(img, function () {
          previewFrame.classList.remove("scanning");
        });
      };
      img.onerror = function () {
        showError("Gambar tidak dapat dibaca. Pastikan file tidak rusak, lalu coba lagi.");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------------------- Kamera (Webcam) ---------------------- */
  function openCamera() {
    hideError();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError("Kamera tidak didukung pada perangkat/browser ini.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(function (stream) {
        mediaStream = stream;
        webcamVideo.srcObject = stream;
        cameraPanel.classList.add("active");
        isCameraActive = true;

        webcamVideo.onloadedmetadata = function () {
          webcamVideo.play();
          startCameraPredictionLoop();
        };
      })
      .catch(function () {
        showError("Tidak dapat mengakses kamera. Pastikan kamu mengizinkan akses kamera pada browser.");
      });
  }

  function closeCamera() {
    isCameraActive = false;
    if (cameraLoopId) {
      cancelAnimationFrame(cameraLoopId);
      cameraLoopId = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (track) {
        track.stop();
      });
      mediaStream = null;
    }
    if (webcamVideo) webcamVideo.srcObject = null;
    if (cameraPanel) cameraPanel.classList.remove("active");
  }

  function startCameraPredictionLoop() {
    var lastPredictTime = 0;

    function loop(timestamp) {
      if (!isCameraActive) return;

      // Prediksi setiap ~700ms agar tidak membebani perangkat secara berlebihan
      if (!lastPredictTime || timestamp - lastPredictTime > 700) {
        lastPredictTime = timestamp;
        if (modelReady && model) {
          model
            .predict(webcamVideo)
            .then(function (predictions) {
              renderPredictions(predictions, { silent: true });
            })
            .catch(function () {
              /* abaikan galat sesaat selama kamera masih menyala */
            });
        }
      }
      cameraLoopId = requestAnimationFrame(loop);
    }

    cameraLoopId = requestAnimationFrame(loop);
  }

  function capturePhoto() {
    if (!webcamVideo || !webcamVideo.videoWidth) return;

    var canvas = document.createElement("canvas");
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;
    var ctx = canvas.getContext("2d");
    // Balik horizontal agar sesuai efek cermin pada preview kamera
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);

    var dataUrl = canvas.toDataURL("image/png");
    var img = new Image();
    img.onload = function () {
      previewFrame.innerHTML = "";
      previewFrame.appendChild(img);
      closeCamera();
      currentImageEl = img;
      refreshLabPanel();
      predictImage(img, function () {});
    };
    img.src = dataUrl;
  }

  if (openCameraBtn) {
    openCameraBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openCamera();
    });
  }

  if (closeCameraBtn) {
    closeCameraBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeCamera();
    });
  }

  if (captureBtn) {
    captureBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      capturePhoto();
    });
  }

  /* ---------------------- Prediksi & Render Hasil ---------------------- */
  function predictImage(imageEl, doneCallback) {
    hideError();

    if (!modelReady || !model) {
      showError("Model AI belum siap. Tunggu beberapa saat lalu coba lagi, atau muat ulang halaman.");
      if (doneCallback) doneCallback();
      return;
    }

    showLoading();
    if (resultBlock) resultBlock.classList.remove("show");
    if (resultCardWrap) resultCardWrap.classList.remove("result-glow");

    // Beri jeda singkat agar animasi loading terlihat jelas oleh pengguna
    setTimeout(function () {
      model
        .predict(imageEl)
        .then(function (predictions) {
          renderPredictions(predictions, { silent: false });
          if (doneCallback) doneCallback();
        })
        .catch(function () {
          showError("Terjadi kesalahan saat memproses gambar. Silakan coba dengan gambar lain.");
          if (doneCallback) doneCallback();
        });
    }, 500);
  }

  function renderPredictions(predictions, options) {
    options = options || {};

    var sorted = predictions.slice().sort(function (a, b) {
      return b.probability - a.probability;
    });
    var top = sorted[0];
    var topPercent = Math.round(top.probability * 100 * 10) / 10;

    hideLoading();
    if (emptyResultState) emptyResultState.style.display = "none";
    if (resultBlock) resultBlock.classList.add("show");

    // Tandai aktivitas Simulasi AI selesai setelah prediksi NYATA berhasil
    // (bukan sekadar membuka halaman). options.silent membedakan render
    // biasa dari pemanggilan lain yang bukan hasil interaksi pengguna.
    if (!options.silent && typeof PatternLabProgress !== "undefined") {
      PatternLabProgress.updateProgress("simulasi", true);
      // Simpan ringkasan hasil sebagai referensi otomatis untuk LKPD
      // (lihat initLkpdPage) — hanya dari prediksi still image sungguhan.
      PatternLabProgress.saveSimResult({
        objek: top.className,
        confidence: topPercent,
        tahapan: "Gambar Asli (Hasil Prediksi)",
        grayscale: false,
        edge: false,
        simulated: false,
        time: Date.now()
      });
    }

    // Simpan hasil prediksi utama sebagai baseline pembanding untuk Lab
    // Analisis AI (Robustness Lab). Hanya diperbarui dari prediksi still
    // image sungguhan, bukan dari loop kamera real-time yang silent.
    if (!options.silent) {
      lastBasicPrediction = { className: top.className, probability: top.probability };
    }

    if (predictionLabel) {
      predictionLabel.textContent = getEmoji(top.className) + " " + top.className;
    }

    if (confidenceValue) confidenceValue.textContent = topPercent + "%";
    if (confidenceFill) {
      confidenceFill.style.width = "0%";
      setTimeout(function () {
        confidenceFill.style.width = topPercent + "%";
      }, 60);
    }

    if (predictionExplanation) {
      predictionExplanation.textContent =
        "Model mengenali fitur visual (warna, bentuk, dan tekstur) yang paling menyerupai " +
        top.className +
        " dengan tingkat keyakinan " +
        topPercent +
        "%.";
    }

    // Render seluruh daftar confidence per kelas
    if (confidenceList) {
      confidenceList.innerHTML = "";
      sorted.forEach(function (p) {
        var percent = Math.round(p.probability * 100 * 10) / 10;
        var isTop = p.className === top.className;

        var item = document.createElement("div");
        item.className = "confidence-list-item" + (isTop ? " is-top" : "");
        item.innerHTML =
          '<span class="confidence-list-name">' + getEmoji(p.className) + " " + p.className + "</span>" +
          '<span class="confidence-list-percent">' + percent + "%</span>" +
          '<div class="confidence-list-track"><div class="confidence-list-fill" style="width:0%"></div></div>';
        confidenceList.appendChild(item);

        var fillEl = item.querySelector(".confidence-list-fill");
        setTimeout(function () {
          fillEl.style.width = percent + "%";
        }, 60);
      });
    }

    // Animasi kecil (glow + badge pop) ketika AI berhasil mengenali objek —
    // tidak ditampilkan berulang kali saat mode kamera real-time (silent)
    // agar tidak terasa berkedip-kedip.
    if (!options.silent) {
      if (resultCardWrap) {
        resultCardWrap.classList.remove("result-glow");
        void resultCardWrap.offsetWidth; // reset animasi
        resultCardWrap.classList.add("result-glow");
      }
      if (predictionBadge) {
        predictionBadge.classList.remove("badge-pop");
        void predictionBadge.offsetWidth;
        predictionBadge.classList.add("badge-pop");
      }
    }
  }

  /* ---------------------- Reset ---------------------- */
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      closeCamera();
      previewFrame.innerHTML =
        '<div class="preview-placeholder" id="predictionEmpty"><i class="fa-regular fa-image"></i><p>Belum ada gambar yang diunggah</p></div>';
      resetResultCard();
      fileInput.value = "";

      currentImageEl = null;
      lastBasicPrediction = null;
      cachedGrayData = null;
      cachedEdgeData = null;
      stopConvolutionAnimation();
      refreshLabPanel();
    });
  }

  /* ==========================================================================
     LAB ANALISIS AI — Mode tambahan: bongkar pipeline & uji ketahanan model
     ========================================================================== */

  var simTabBasic = document.getElementById("simTabBasic");
  var simTabLab = document.getElementById("simTabLab");
  var simBasicPanel = document.getElementById("simBasicPanel");
  var simLabPanel = document.getElementById("simLabPanel");
  var simLabEmpty = document.getElementById("simLabEmpty");
  var simLabContent = document.getElementById("simLabContent");

  function switchSimTab(mode) {
    var isLab = mode === "lab";
    if (simTabBasic) simTabBasic.classList.toggle("active", !isLab);
    if (simTabLab) simTabLab.classList.toggle("active", isLab);
    if (simBasicPanel) simBasicPanel.classList.toggle("active", !isLab);
    if (simLabPanel) simLabPanel.classList.toggle("active", isLab);
    if (isLab) refreshLabPanel();
  }

  if (simTabBasic) {
    simTabBasic.addEventListener("click", function () {
      switchSimTab("basic");
    });
  }
  if (simTabLab) {
    simTabLab.addEventListener("click", function () {
      switchSimTab("lab");
    });
  }

  function refreshLabPanel() {
    if (!simLabEmpty || !simLabContent) return;

    if (!currentImageEl) {
      simLabEmpty.style.display = "block";
      simLabContent.style.display = "none";
      return;
    }

    simLabEmpty.style.display = "none";
    simLabContent.style.display = "block";
    renderPipelineStages();
    initRobustnessCanvas();
  }

  /* ---------------------- Bagian 1: Pipeline Viewer ---------------------- */
  function drawImageCoverFit(canvas, imgEl) {
    var ctx = canvas.getContext("2d");
    var size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    var iw = imgEl.naturalWidth || imgEl.width;
    var ih = imgEl.naturalHeight || imgEl.height;
    if (!iw || !ih) return;

    var scale = Math.max(size / iw, size / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    ctx.drawImage(imgEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
  }

  function computeGrayscale(canvas) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    var imgData = ctx.getImageData(0, 0, w, h);
    var data = imgData.data;
    var gray = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    return { gray: gray, w: w, h: h };
  }

  function paintGrayscale(canvas, grayData) {
    var ctx = canvas.getContext("2d");
    var w = grayData.w;
    var h = grayData.h;
    var out = ctx.createImageData(w, h);
    for (var i = 0; i < w * h; i++) {
      var v = grayData.gray[i];
      out.data[i * 4] = v;
      out.data[i * 4 + 1] = v;
      out.data[i * 4 + 2] = v;
      out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }

  // Deteksi tepi sederhana memakai operator Sobel (konsep dasar konvolusi
  // yang juga menjadi fondasi cara kerja CNN pada materi "Metode").
  function computeSobelEdges(grayData) {
    var w = grayData.w;
    var h = grayData.h;
    var gray = grayData.gray;
    var gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    var gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    var mag = new Float32Array(w * h);
    var max = 1;

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var sx = 0;
        var sy = 0;
        var k = 0;
        for (var j = -1; j <= 1; j++) {
          for (var i = -1; i <= 1; i++) {
            var val = gray[(y + j) * w + (x + i)];
            sx += val * gx[k];
            sy += val * gy[k];
            k++;
          }
        }
        var m = Math.sqrt(sx * sx + sy * sy);
        mag[y * w + x] = m;
        if (m > max) max = m;
      }
    }
    return { mag: mag, max: max, w: w, h: h };
  }

  function paintEdges(canvas, edgeData) {
    var ctx = canvas.getContext("2d");
    var w = edgeData.w;
    var h = edgeData.h;
    var out = ctx.createImageData(w, h);
    for (var i = 0; i < w * h; i++) {
      var v = Math.min(255, (edgeData.mag[i] / edgeData.max) * 255 * 1.4);
      out.data[i * 4] = v;
      out.data[i * 4 + 1] = v;
      out.data[i * 4 + 2] = v;
      out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }

  // Peta "highlight fitur" — ilustrasi heatmap dari kekuatan tepi (BUKAN
  // feature map asli dari dalam model), sekadar membantu membayangkan
  // area yang cenderung menonjol bagi AI.
  function paintFeatureHeatmap(canvas, edgeData) {
    var ctx = canvas.getContext("2d");
    var w = edgeData.w;
    var h = edgeData.h;
    var out = ctx.createImageData(w, h);
    for (var i = 0; i < w * h; i++) {
      var t = Math.min(1, (edgeData.mag[i] / edgeData.max) * 1.4);
      var r, g, b;
      if (t < 0.33) {
        var s1 = t / 0.33;
        r = 0;
        g = Math.round(s1 * 180);
        b = Math.round(120 + s1 * 135);
      } else if (t < 0.66) {
        var s2 = (t - 0.33) / 0.33;
        r = Math.round(s2 * 255);
        g = Math.round(180 + s2 * 75);
        b = Math.round(255 * (1 - s2));
      } else {
        var s3 = (t - 0.66) / 0.34;
        r = 255;
        g = Math.round(255 * (1 - s3));
        b = 0;
      }
      out.data[i * 4] = r;
      out.data[i * 4 + 1] = g;
      out.data[i * 4 + 2] = b;
      out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }

  function renderPipelineStages() {
    var origCanvas = document.getElementById("pipelineOriginal");
    var grayCanvas = document.getElementById("pipelineGray");
    var edgeCanvas = document.getElementById("pipelineEdge");
    var featureCanvas = document.getElementById("pipelineFeature");
    if (!origCanvas || !grayCanvas || !edgeCanvas || !featureCanvas || !currentImageEl) return;

    [origCanvas, grayCanvas, edgeCanvas, featureCanvas].forEach(function (c) {
      drawImageCoverFit(c, currentImageEl);
    });

    var grayData = computeGrayscale(grayCanvas);
    paintGrayscale(grayCanvas, grayData);

    var edgeData = computeSobelEdges(grayData);
    paintEdges(edgeCanvas, edgeData);
    paintFeatureHeatmap(featureCanvas, edgeData);

    cachedGrayData = grayData;
    cachedEdgeData = edgeData;
  }

  /* ---------------------- Uji Prediksi dengan Tahapan Pipeline ---------------------- */
  var stageGrayscale = document.getElementById("stageGrayscale");
  var stageEdge = document.getElementById("stageEdge");
  var testPipelineBtn = document.getElementById("testPipelineBtn");
  var pipelineResult = document.getElementById("pipelineResult");

  // CATATAN PENTING (revisi):
  // Tombol ini TIDAK LAGI menjalankan ulang model klasifikasi Teachable
  // Machine pada gambar grayscale/tepi. Model tersebut dilatih memakai
  // gambar berwarna asli, sehingga jika dipaksa memprediksi gambar
  // grayscale/edge, hasilnya bisa "meleset" ke kelas lain (mis. Apel
  // terbaca sebagai Jeruk) — bukan karena objeknya berubah, tapi karena
  // model kehilangan informasi warna yang biasa dipakainya. Menampilkan
  // hasil itu sebagai "prediksi AI" akan menyesatkan peserta didik, seolah
  // preprocessing benar-benar mengubah jenis objek.
  //
  // Sebagai gantinya, tahap ini murni EDUKATIF: menjelaskan APA yang
  // terjadi pada citra di setiap tahap preprocessing/ekstraksi fitur,
  // tanpa mengklaim itu adalah hasil klasifikasi model AI nyata. Jika
  // angka "confidence" ditampilkan, selalu diberi label tegas sebagai
  // simulasi/ilustrasi.
  if (testPipelineBtn) {
    testPipelineBtn.addEventListener("click", function () {
      if (!currentImageEl) return;

      var useGray = !!(stageGrayscale && stageGrayscale.checked);
      var useEdge = !!(stageEdge && stageEdge.checked);

      var stageLabel;
      var explanation;
      if (useEdge) {
        stageLabel = "Grayscale + Deteksi Tepi";
        explanation =
          "Pada tahap ini, gambar diubah menjadi grayscale dan tepi objek diperjelas menggunakan filter Sobel. " +
          "Proses ini membantu sistem mengenali bentuk dan batas objek sebagai bagian dari ekstraksi fitur — " +
          "bukan untuk menentukan ulang jenis objek yang difoto.";
      } else if (useGray) {
        stageLabel = "Grayscale";
        explanation =
          "Pada tahap ini, gambar diubah menjadi grayscale (skala keabuan) sehingga sistem berfokus pada pola " +
          "intensitas terang-gelap, bukan warna. Ini adalah salah satu langkah preprocessing sebelum ekstraksi fitur.";
      } else {
        stageLabel = "Gambar Asli (tanpa tahapan tambahan)";
        explanation = "Gambar diamati apa adanya, sama seperti pada tab Hasil Prediksi, tanpa tahapan preprocessing tambahan.";
      }

      var objectLabel = "Objek yang diunggah";
      if (lastBasicPrediction && lastBasicPrediction.className) {
        objectLabel = getEmoji(lastBasicPrediction.className) + " " + lastBasicPrediction.className;
      }

      if (pipelineResult) {
        pipelineResult.style.display = "block";
        pipelineResult.innerHTML = "Menjalankan tahapan: <strong>" + stageLabel + "</strong>...";
      }

      setTimeout(function () {
        if (!pipelineResult) return;

        // Angka ilustratif (BUKAN hasil model), hanya untuk membantu memahami
        // konsep confidence — selalu tinggi & stabil karena ini bukan prediksi nyata.
        var simConfidence = 90 + Math.round(Math.random() * 8);

        var html =
          '<div class="sim-lab-result-row"><span>Objek yang diunggah</span><strong>' + objectLabel + "</strong></div>" +
          '<div class="sim-lab-result-row"><span>Tahapan yang dipilih</span><strong>' + stageLabel + "</strong></div>" +
          '<div class="sim-lab-result-row"><span>Status</span><strong><i class="fa-solid fa-circle-check"></i> Tahapan berhasil dijalankan</strong></div>' +
          '<p class="sim-lab-result-explanation">' + explanation + "</p>";

        if (useGray || useEdge) {
          html +=
            '<p class="sim-lab-result-note"><i class="fa-solid fa-circle-info"></i> ' +
            "Confidence simulasi: <strong>" + simConfidence + "%</strong> — angka ini merupakan " +
            "<strong>ilustrasi</strong> untuk memahami konsep confidence, <em>bukan</em> hasil klasifikasi ulang dari " +
            "model AI nyata. Grayscale dan Deteksi Tepi tidak mengubah jenis objek yang terdeteksi.</p>";
        }

        pipelineResult.innerHTML = html;

        if (typeof PatternLabProgress !== "undefined") {
          PatternLabProgress.updateProgress("simulasi", true);
          PatternLabProgress.saveSimResult({
            objek: (lastBasicPrediction && lastBasicPrediction.className) || "-",
            confidence: (useGray || useEdge) ? simConfidence : null,
            tahapan: stageLabel,
            grayscale: useGray,
            edge: useEdge,
            simulated: useGray || useEdge,
            time: Date.now()
          });
        }
      }, 550);
    });
  }

  /* ---------------------- Animasi Konvolusi ---------------------- */
  var playConvolutionBtn = document.getElementById("playConvolutionBtn");
  var convolutionWrap = document.getElementById("convolutionWrap");

  function stopConvolutionAnimation() {
    if (convolutionAnimId) {
      clearInterval(convolutionAnimId);
      convolutionAnimId = null;
    }
  }

  function playConvolutionAnimation() {
    var canvas = document.getElementById("convolutionCanvas");
    var kernelBox = document.getElementById("kernelBox");
    var grayCanvasSrc = document.getElementById("pipelineGray");
    if (!canvas || !cachedGrayData || !cachedEdgeData || !grayCanvasSrc) return;

    var ctx = canvas.getContext("2d");
    var w = cachedGrayData.w;
    var h = cachedGrayData.h;
    var stride = Math.max(2, Math.floor(w / 50)); // grid lebih kasar agar animasi tidak terlalu lama
    var scale = canvas.width / w;
    var blockSize = stride * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(grayCanvasSrc, 0, 0, canvas.width, canvas.height);
    if (kernelBox) {
      kernelBox.style.width = blockSize * 1.4 + "px";
      kernelBox.style.height = blockSize * 1.4 + "px";
    }

    var x = 1;
    var y = 1;
    var stepsPerFrame = 6;

    stopConvolutionAnimation();
    convolutionAnimId = setInterval(function () {
      for (var s = 0; s < stepsPerFrame; s++) {
        if (y >= h - 1) {
          stopConvolutionAnimation();
          if (playConvolutionBtn) {
            playConvolutionBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Putar Ulang Animasi';
          }
          return;
        }

        var v = Math.min(255, (cachedEdgeData.mag[y * w + x] / cachedEdgeData.max) * 255 * 1.4);
        if (v > 35) {
          ctx.fillStyle = "rgba(255, 255, 255, " + Math.min(1, v / 255) + ")";
          ctx.fillRect(x * scale, y * scale, blockSize + 1, blockSize + 1);
        }

        x += stride;
        if (x >= w - 1) {
          x = 1;
          y += stride;
        }
      }

      if (kernelBox) {
        kernelBox.style.left = x * scale - blockSize * 0.2 + "px";
        kernelBox.style.top = y * scale - blockSize * 0.2 + "px";
      }
    }, 16);
  }

  if (playConvolutionBtn) {
    playConvolutionBtn.addEventListener("click", function () {
      if (!convolutionWrap) return;
      var isOpen = convolutionWrap.style.display !== "none";

      if (isOpen) {
        stopConvolutionAnimation();
        convolutionWrap.style.display = "none";
        playConvolutionBtn.innerHTML = '<i class="fa-solid fa-play"></i> Putar Animasi Konvolusi';
      } else {
        convolutionWrap.style.display = "block";
        playConvolutionBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Hentikan Animasi';
        playConvolutionAnimation();
      }
    });
  }

  /* ---------------------- Bagian 2: Robustness Lab ---------------------- */
  var robustnessCanvas = document.getElementById("robustnessCanvas");
  var sliderBlur = document.getElementById("sliderBlur");
  var sliderBrightness = document.getElementById("sliderBrightness");
  var sliderNoise = document.getElementById("sliderNoise");
  var sliderRotate = document.getElementById("sliderRotate");
  var sliderOcclusion = document.getElementById("sliderOcclusion");
  var testRobustnessBtn = document.getElementById("testRobustnessBtn");
  var resetRobustnessBtn = document.getElementById("resetRobustnessBtn");
  var compareWrap = document.getElementById("compareWrap");
  var compareOriginalFill = document.getElementById("compareOriginalFill");
  var compareOriginalValue = document.getElementById("compareOriginalValue");
  var compareModifiedFill = document.getElementById("compareModifiedFill");
  var compareModifiedValue = document.getElementById("compareModifiedValue");
  var challengeMessage = document.getElementById("challengeMessage");

  var robustnessSliders = [sliderBlur, sliderBrightness, sliderNoise, sliderRotate, sliderOcclusion];

  function clampByte(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function updateSliderLabels() {
    if (sliderBlur) document.getElementById("sliderBlurValue").textContent = sliderBlur.value;
    if (sliderBrightness) document.getElementById("sliderBrightnessValue").textContent = sliderBrightness.value;
    if (sliderNoise) document.getElementById("sliderNoiseValue").textContent = sliderNoise.value;
    if (sliderRotate) document.getElementById("sliderRotateValue").textContent = sliderRotate.value;
    if (sliderOcclusion) document.getElementById("sliderOcclusionValue").textContent = sliderOcclusion.value;
  }

  function renderRobustnessCanvas() {
    if (!robustnessCanvas || !currentImageEl) return;
    var ctx = robustnessCanvas.getContext("2d");
    var size = robustnessCanvas.width;
    ctx.clearRect(0, 0, size, size);

    var blur = sliderBlur ? parseInt(sliderBlur.value, 10) : 0;
    var brightness = sliderBrightness ? parseInt(sliderBrightness.value, 10) : 0;
    var noise = sliderNoise ? parseInt(sliderNoise.value, 10) : 0;
    var rotate = sliderRotate ? parseInt(sliderRotate.value, 10) : 0;
    var occlusion = sliderOcclusion ? parseInt(sliderOcclusion.value, 10) : 0;

    var iw = currentImageEl.naturalWidth || currentImageEl.width;
    var ih = currentImageEl.naturalHeight || currentImageEl.height;
    var scale = Math.max(size / iw, size / ih);
    var dw = iw * scale;
    var dh = ih * scale;

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.filter = "blur(" + blur + "px) brightness(" + (100 + brightness) + "%)";
    ctx.drawImage(currentImageEl, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    if (noise > 0) {
      var imgData = ctx.getImageData(0, 0, size, size);
      var data = imgData.data;
      var strength = noise * 1.8;
      for (var i = 0; i < data.length; i += 4) {
        var n = (Math.random() - 0.5) * strength;
        data[i] = clampByte(data[i] + n);
        data[i + 1] = clampByte(data[i + 1] + n);
        data[i + 2] = clampByte(data[i + 2] + n);
      }
      ctx.putImageData(imgData, 0, 0);
    }

    if (occlusion > 0) {
      var occH = size * (occlusion / 100);
      ctx.fillStyle = "#0b0e1a";
      ctx.fillRect(0, size - occH, size, occH);
    }
  }

  function resetRobustnessControls() {
    robustnessSliders.forEach(function (s) {
      if (s) s.value = 0;
    });
    updateSliderLabels();
    if (compareWrap) compareWrap.style.display = "none";
    if (compareOriginalFill) compareOriginalFill.style.width = "0%";
    if (compareModifiedFill) compareModifiedFill.style.width = "0%";
    if (challengeMessage) {
      challengeMessage.classList.remove("is-visible", "is-neutral");
      challengeMessage.textContent = "";
    }
  }

  function initRobustnessCanvas() {
    resetRobustnessControls();
    renderRobustnessCanvas();
  }

  robustnessSliders.forEach(function (slider) {
    if (!slider) return;
    slider.addEventListener("input", function () {
      updateSliderLabels();
      if (robustnessRenderTimer) clearTimeout(robustnessRenderTimer);
      robustnessRenderTimer = setTimeout(renderRobustnessCanvas, 60);
    });
  });

  if (resetRobustnessBtn) {
    resetRobustnessBtn.addEventListener("click", function () {
      resetRobustnessControls();
      renderRobustnessCanvas();
    });
  }

  if (testRobustnessBtn) {
    testRobustnessBtn.addEventListener("click", function () {
      if (!modelReady || !model || !robustnessCanvas || !currentImageEl) return;

      testRobustnessBtn.disabled = true;
      var originalLabel = testRobustnessBtn.innerHTML;
      testRobustnessBtn.innerHTML = '<span class="ai-loading-spinner" style="display:inline-block;vertical-align:middle;margin-right:6px;"></span> Menguji...';

      model
        .predict(robustnessCanvas)
        .then(function (predictions) {
          var sorted = predictions.slice().sort(function (a, b) {
            return b.probability - a.probability;
          });
          var top = sorted[0];
          var modPct = Math.round(top.probability * 100 * 10) / 10;

          var baseline = lastBasicPrediction;
          var origPct = baseline ? Math.round(baseline.probability * 100 * 10) / 10 : 0;

          if (compareWrap) compareWrap.style.display = "block";
          if (compareOriginalValue) compareOriginalValue.textContent = origPct + "%";
          if (compareModifiedValue) compareModifiedValue.textContent = modPct + "%";
          if (compareOriginalFill) {
            compareOriginalFill.style.width = "0%";
            setTimeout(function () {
              compareOriginalFill.style.width = origPct + "%";
            }, 30);
          }
          if (compareModifiedFill) {
            compareModifiedFill.style.width = "0%";
            setTimeout(function () {
              compareModifiedFill.style.width = modPct + "%";
            }, 30);
          }

          if (challengeMessage) {
            challengeMessage.classList.add("is-visible");
            challengeMessage.classList.remove("is-neutral");
            var labelChanged = baseline && top.className !== baseline.className;

            if (labelChanged) {
              challengeMessage.textContent =
                "🎉 Kamu berhasil mengelabui AI! Sekarang AI menebak " + getEmoji(top.className) + " " + top.className +
                ", padahal awalnya " + getEmoji(baseline.className) + " " + baseline.className + ".";
            } else if (modPct < 50) {
              challengeMessage.textContent =
                "👀 AI masih menebak kelas yang sama, tapi confidence-nya jatuh drastis menjadi " + modPct + "%. Gambar ini sudah cukup sulit dikenali AI.";
            } else if (baseline && modPct < origPct - 15) {
              challengeMessage.textContent =
                "📉 Confidence turun dari " + origPct + "% menjadi " + modPct + "% — perubahan ini mulai memengaruhi AI, walau tebakannya masih sama.";
            } else {
              challengeMessage.classList.add("is-neutral");
              challengeMessage.textContent =
                "🤖 AI masih cukup yakin dengan tebakannya. Coba naikkan blur, noise, atau rotasi untuk menguji batas kemampuannya.";
            }
          }

          testRobustnessBtn.disabled = false;
          testRobustnessBtn.innerHTML = originalLabel;
        })
        .catch(function () {
          testRobustnessBtn.disabled = false;
          testRobustnessBtn.innerHTML = originalLabel;
        });
    });
  }

  // Mulai memuat model segera setelah halaman siap
  resetResultCard();
  loadModel();
}

/* --------------------------------------------------------------------------
   8. HALAMAN QUIZ
   -------------------------------------------------------------------------- */
function initQuizPage() {
  var quizCard = document.getElementById("quizCard");
  if (!quizCard) return;

  /* ------------------------------------------------------------------------
     STRUKTUR DATA SOAL — 3 bagian sesuai materi Pattern Recognition:
     Bagian 1: Pilihan Ganda (5 soal)   -> type: "mc"
     Bagian 2: Memasangkan (5 pasangan) -> type: "matching" (1 layar)
     Bagian 3: Esai Singkat (3 soal)    -> type: "essay"

     Soal Pilihan Ganda & Memasangkan dinilai otomatis (benar/salah).
     Soal Esai tidak dinilai otomatis — setelah dikirim, pedoman jawaban
     langsung ditampilkan sebagai pembanding (sesuai instruksi: jika sistem
     tidak bisa menilai esai secara akurat, tampilkan contoh jawaban).
     ------------------------------------------------------------------------ */
  var quizItems = [
    // ---------------- BAGIAN 1: PILIHAN GANDA (5 soal) ----------------
    {
      type: "mc",
      partLabel: "Bagian 1: Pilihan Ganda",
      question: "Perangkat input utama yang berfungsi melakukan akuisisi data visual pada sistem pengenalan pola citra adalah...",
      options: ["Mikrofon", "Speaker", "Kamera", "Keyboard"],
      answer: 2,
      explanation: "Akuisisi citra adalah tahap awal pengenalan pola citra, yaitu menangkap data visual dari dunia nyata. Kamera (atau scanner) adalah perangkat utama untuk menangkap gambar/video sebagai data masukan sistem."
    },
    {
      type: "mc",
      partLabel: "Bagian 1: Pilihan Ganda",
      question: "Urutan tahapan alur kerja (workflow) pengenalan pola citra yang tepat dan logis adalah...",
      options: [
        "Preprocessing → Akuisisi Citra → Klasifikasi → Ekstraksi Fitur",
        "Akuisisi Citra → Preprocessing → Ekstraksi Fitur → Klasifikasi",
        "Ekstraksi Fitur → Klasifikasi → Preprocessing → Akuisisi Citra",
        "Klasifikasi → Ekstraksi Fitur → Preprocessing → Akuisisi Citra"
      ],
      answer: 1,
      explanation: "Alur kerja yang logis dimulai dari akuisisi citra (menangkap gambar), lalu preprocessing (membersihkan/menyiapkan gambar), dilanjutkan ekstraksi fitur (mengambil ciri penting), dan diakhiri klasifikasi (menentukan objek)."
    },
    {
      type: "mc",
      partLabel: "Bagian 1: Pilihan Ganda",
      question: "Mengubah foto berwarna menjadi grayscale serta membersihkan noise merupakan bagian dari tahap...",
      options: ["Akuisisi Citra", "Preprocessing", "Ekstraksi Fitur", "Klasifikasi"],
      answer: 1,
      explanation: "Preprocessing bertujuan menyiapkan citra agar lebih mudah dianalisis pada tahap berikutnya, misalnya dengan mengubah ke grayscale, membersihkan noise, atau menyesuaikan ukuran gambar."
    },
    {
      type: "mc",
      partLabel: "Bagian 1: Pilihan Ganda",
      question: "Arsitektur Deep Learning yang paling umum dan efektif digunakan khusus untuk memproses data berstruktur matriks piksel pada gambar adalah...",
      options: [
        "Hidden Markov Model (HMM)",
        "Convolutional Neural Network (CNN)",
        "Mel-Frequency Cepstral Coefficients (MFCC)",
        "Optical Character Recognition (OCR)"
      ],
      answer: 1,
      explanation: "CNN dirancang khusus untuk mengolah data berbentuk matriks piksel seperti gambar, dengan mengenali pola secara bertingkat mulai dari garis, bentuk, hingga objek utuh."
    },
    {
      type: "mc",
      partLabel: "Bagian 1: Pilihan Ganda",
      question: "Teknologi Speaker Recognition pada Voice Unlock berbeda dengan Speech Recognition karena...",
      options: [
        "Speaker Recognition menganalisis siapa yang berbicara, sedangkan Speech Recognition menganalisis apa kata yang diucapkan.",
        "Speaker Recognition mengubah suara menjadi teks, sedangkan Speech Recognition membaca garis wajah.",
        "Speaker Recognition tidak memerlukan tahap pra-pemrosesan data.",
        "Speaker Recognition menggunakan kamera optik, sedangkan Speech Recognition menggunakan sinyal GPS."
      ],
      answer: 0,
      explanation: "Speaker Recognition berfokus pada identitas pemilik suara (karakteristik vokal unik seseorang), sedangkan Speech Recognition berfokus pada menerjemahkan kata/kalimat yang diucapkan tanpa memedulikan siapa yang mengucapkannya."
    },

    // ---------------- BAGIAN 2: MEMASANGKAN (1 layar, 5 pasangan) ----------------
    {
      type: "matching",
      partLabel: "Bagian 2: Memasangkan",
      question: "Jodohkanlah pernyataan/istilah pada Kolom A dengan pasangan yang tepat pada Kolom B!",
      instruction: "Pilih pasangan yang tepat dari Kolom B untuk setiap pernyataan di Kolom A, lalu tekan \"Periksa Jawaban\".",
      columnA: [
        "Karakteristik fisik visual yang dianalisis komputer pada citra.",
        "Teknik ekstraksi fitur audio yang mewakili frekuensi pendengaran manusia.",
        "Contoh penerapan pengenalan pola suara dalam kehidupan sehari-hari.",
        "Penerapan pengenalan citra pada sistem Smart Transportation.",
        "Tantangan/kendala utama dalam pengenalan pola suara di ruang terbuka."
      ],
      columnB: [
        "Noise latar (Background Noise)",
        "Google Assistant & Siri",
        "Warna, bentuk, dan tekstur",
        "MFCC (Mel-Frequency Cepstral Coefficients)",
        "Kendaraan Otonom (Self-driving car)"
      ],
      answer: [2, 3, 1, 4, 0],
      explanation: [
        "Warna, bentuk, dan tekstur adalah ciri fisik visual yang dianalisis komputer pada citra.",
        "MFCC adalah teknik ekstraksi fitur audio yang merepresentasikan frekuensi sesuai persepsi pendengaran manusia.",
        "Google Assistant dan Siri adalah contoh nyata penerapan pengenalan pola suara dalam kehidupan sehari-hari.",
        "Kendaraan otonom (self-driving car) menggunakan pengenalan pola citra untuk mendeteksi jalur dan rambu lalu lintas.",
        "Noise latar (background noise) adalah kendala utama karena dapat mengganggu sinyal suara yang ingin dianalisis."
      ]
    },

    // ---------------- BAGIAN 3: ESAI SINGKAT (3 soal) ----------------
    {
      type: "essay",
      partLabel: "Bagian 3: Esai Singkat",
      question: "Jelaskan definisi Pattern Recognition (Pengenalan Pola) dalam lingkup Kecerdasan Buatan (AI)!",
      modelAnswer: "Pattern Recognition adalah proses mendeteksi, mengidentifikasi, dan mengelompokkan data seperti gambar, suara, atau teks secara otomatis menggunakan komputer berdasarkan karakteristik, ciri khas, atau keteraturan tertentu."
    },
    {
      type: "essay",
      partLabel: "Bagian 3: Esai Singkat",
      question: "Mengapa kondisi pencahayaan yang minim atau gambar yang buram dapat menyulitkan komputer dalam mengenali objek visual?",
      modelAnswer: "Karena komputer menganalisis kontras piksel untuk menemukan garis tepi (edges) dan bentuk. Jika gambar terlalu gelap atau buram, nilai piksel menjadi tidak jelas sehingga ekstraksi fitur tidak dapat dilakukan dengan akurat."
    },
    {
      type: "essay",
      partLabel: "Bagian 3: Esai Singkat",
      question: "Jelaskan peran penting Artificial Intelligence (AI) dan penggunaan dataset dalam meningkatkan akurasi sistem pengenalan pola!",
      modelAnswer: "AI memproses dan mempelajari pola dari kumpulan data sampel (dataset). Semakin banyak dan beragam data yang dipelajari, semakin baik kemampuan model dalam mengenali objek atau pola baru."
    }
  ];

  var letters = ["A", "B", "C", "D", "E"];

  // userAnswers[i] menyimpan jawaban pengguna untuk item ke-i, bentuknya
  // berbeda sesuai tipe soal:
  //   mc       -> index opsi yang dipilih (angka)
  //   matching -> array 5 index pilihan Kolom B (satu per baris Kolom A)
  //   essay    -> teks jawaban yang dikirim (string)
  // null berarti item tersebut belum dijawab/dikirim.
  var userAnswers = [];
  var currentIndex = 0;

  var startBtn = document.getElementById("startQuizBtn");
  var prevBtn = document.getElementById("prevQuizBtn");
  var nextBtn = document.getElementById("nextQuizBtn");
  var submitBtn = document.getElementById("quizSubmitBtn");
  var restartBtn = document.getElementById("restartQuizBtn");
  var backMateriBtn = document.getElementById("quizToMateriBtn");

  var introState = document.getElementById("quizIntro");
  var questionState = document.getElementById("quizQuestionState");
  var resultState = document.getElementById("quizResultState");

  var progressFill = document.getElementById("quizProgressFill");
  var progressText = document.getElementById("quizProgressText");
  var partLabelEl = document.getElementById("quizPartLabel");
  var questionNumberEl = document.getElementById("quizQuestionNumber");
  var questionText = document.getElementById("quizQuestionText");
  var instructionEl = document.getElementById("quizInstruction");
  var optionsWrap = document.getElementById("quizOptions");

  var explanationCard = document.getElementById("quizExplanationCard");
  var explanationTitle = document.getElementById("quizExplanationTitle");
  var explanationStatusText = document.getElementById("quizExplanationStatusText");
  var explanationCorrectAnswer = document.getElementById("quizExplanationCorrectAnswer");
  var explanationText = document.getElementById("quizExplanationText");

  var scoreEl = document.getElementById("quizScoreValue");
  var correctEl = document.getElementById("quizCorrectValue");
  var wrongEl = document.getElementById("quizWrongValue");
  var percentEl = document.getElementById("quizPercentValue");
  var essayValueEl = document.getElementById("quizEssayValue");
  var categoryEmojiEl = document.getElementById("quizCategoryEmoji");
  var categoryLabelEl = document.getElementById("quizCategoryLabel");

  function showState(state) {
    [introState, questionState, resultState].forEach(function (s) {
      if (s) s.classList.remove("active");
    });
    if (state) state.classList.add("active");
  }

  function playSound(name) {
    if (window.PatternLabSound) window.PatternLabSound.play(name);
  }

  function startQuiz() {
    currentIndex = 0;
    userAnswers = new Array(quizItems.length).fill(null);
    showState(questionState);
    renderQuestion();
  }

  /* ==========================================================================
     RENDER SOAL — router berdasarkan tipe (mc / matching / essay)
     ========================================================================== */
  function renderQuestion() {
    var item = quizItems[currentIndex];
    var total = quizItems.length;
    var answeredSoFar = userAnswers.filter(function (a) { return a !== null; }).length;
    var progressPercent = (answeredSoFar / total) * 100;

    if (progressFill) progressFill.style.width = progressPercent + "%";
    if (progressText) progressText.textContent = "Soal " + (currentIndex + 1) + " dari " + total;
    if (partLabelEl) {
      partLabelEl.innerHTML = '<i class="fa-solid fa-layer-group"></i> ' + item.partLabel;
    }
    if (questionNumberEl) {
      questionNumberEl.textContent = "Soal " + (currentIndex + 1) + " / " + total;
    }
    if (questionText) questionText.textContent = item.question;

    if (instructionEl) {
      if (item.instruction) {
        instructionEl.textContent = item.instruction;
        instructionEl.style.display = "block";
      } else {
        instructionEl.style.display = "none";
      }
    }

    if (explanationCard) explanationCard.style.display = "none";
    if (prevBtn) prevBtn.style.display = currentIndex > 0 ? "inline-flex" : "none";
    if (nextBtn) nextBtn.style.display = "none";
    if (submitBtn) submitBtn.style.display = "none";

    var saved = userAnswers[currentIndex];

    if (item.type === "mc") {
      renderMC(item, saved);
    } else if (item.type === "matching") {
      renderMatching(item, saved);
    } else if (item.type === "essay") {
      renderEssay(item, saved);
    }

    updateNextButtonLabel();
  }

  function updateNextButtonLabel() {
    if (!nextBtn) return;
    var isLast = currentIndex === quizItems.length - 1;
    nextBtn.innerHTML = isLast
      ? 'Lihat Hasil <i class="fa-solid fa-flag-checkered"></i>'
      : 'Lanjut <i class="fa-solid fa-arrow-right"></i>';
  }

  /* ------------------------- BAGIAN 1: PILIHAN GANDA ------------------------- */
  function renderMC(item, saved) {
    if (!optionsWrap) return;
    optionsWrap.className = "quiz-options";
    optionsWrap.innerHTML = "";

    item.options.forEach(function (opt, idx) {
      var btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.innerHTML = '<span class="opt-letter">' + letters[idx] + "</span><span>" + opt + "</span>";
      btn.addEventListener("click", function () {
        selectMCAnswer(idx);
      });
      optionsWrap.appendChild(btn);
    });

    if (saved !== null && saved !== undefined) {
      lockMCOptions(saved);
      showExplanationMC(item, saved);
      if (nextBtn) nextBtn.style.display = "inline-flex";
    }
  }

  function lockMCOptions(selectedIdx) {
    var item = quizItems[currentIndex];
    var allOptions = optionsWrap.querySelectorAll(".quiz-option");
    allOptions.forEach(function (opt, idx) {
      opt.disabled = true;
      if (idx === item.answer) {
        opt.classList.add("correct");
      } else if (idx === selectedIdx) {
        opt.classList.add("wrong");
      }
    });
  }

  function showExplanationMC(item, selectedIdx) {
    var isCorrect = selectedIdx === item.answer;

    if (explanationTitle) explanationTitle.textContent = "Pembahasan";
    if (explanationCard) {
      explanationCard.style.display = "block";
      explanationCard.classList.remove("is-correct", "is-wrong", "is-info");
      explanationCard.classList.add(isCorrect ? "is-correct" : "is-wrong");
    }
    if (explanationStatusText) {
      explanationStatusText.textContent = isCorrect ? "✅ Tepat! Jawabanmu benar." : "❌ Belum tepat. Coba perhatikan kembali konsep pada materi.";
    }
    if (explanationCorrectAnswer) {
      if (isCorrect) {
        explanationCorrectAnswer.style.display = "none";
      } else {
        explanationCorrectAnswer.style.display = "block";
        explanationCorrectAnswer.textContent =
          "Jawaban yang benar adalah " + letters[item.answer] + ". " + item.options[item.answer];
      }
    }
    if (explanationText) explanationText.textContent = item.explanation;
  }

  function selectMCAnswer(idx) {
    if (userAnswers[currentIndex] !== null) return; // sudah terjawab
    var item = quizItems[currentIndex];

    userAnswers[currentIndex] = idx;
    lockMCOptions(idx);
    showExplanationMC(item, idx);
    playSound(idx === item.answer ? "correct" : "wrong");

    if (nextBtn) nextBtn.style.display = "inline-flex";
    updateProgressBarLive();
  }

  /* --------------------------- BAGIAN 2: MEMASANGKAN --------------------------- */
  function renderMatching(item, saved) {
    if (!optionsWrap) return;
    optionsWrap.className = "quiz-match-list";
    optionsWrap.innerHTML = "";

    item.columnA.forEach(function (statement, idx) {
      var row = document.createElement("div");
      row.className = "quiz-match-row";
      row.setAttribute("data-row-index", idx);

      var letterEl = document.createElement("span");
      letterEl.className = "quiz-match-letter";
      letterEl.textContent = idx + 1;

      var statementEl = document.createElement("span");
      statementEl.className = "quiz-match-statement";
      statementEl.textContent = statement;

      var select = document.createElement("select");
      select.className = "quiz-match-select";
      select.setAttribute("data-row-index", idx);

      var placeholderOpt = document.createElement("option");
      placeholderOpt.value = "";
      placeholderOpt.textContent = "Pilih pasangan...";
      placeholderOpt.disabled = true;
      placeholderOpt.selected = true;
      select.appendChild(placeholderOpt);

      item.columnB.forEach(function (opt, optIdx) {
        var optionEl = document.createElement("option");
        optionEl.value = optIdx;
        optionEl.textContent = letters[optIdx] + ". " + opt;
        select.appendChild(optionEl);
      });

      var iconEl = document.createElement("span");
      iconEl.className = "quiz-match-row-icon";

      row.appendChild(letterEl);
      row.appendChild(statementEl);
      row.appendChild(select);
      row.appendChild(iconEl);
      optionsWrap.appendChild(row);
    });

    if (saved !== null && saved !== undefined) {
      // Sudah pernah dijawab: isi ulang pilihan & tampilkan hasil terkunci.
      var selects = optionsWrap.querySelectorAll(".quiz-match-select");
      selects.forEach(function (sel, idx) {
        sel.value = saved[idx];
      });
      lockMatchingRows(item, saved);
      showExplanationMatching(item, saved);
      if (nextBtn) nextBtn.style.display = "inline-flex";
    } else if (submitBtn) {
      submitBtn.style.display = "inline-flex";
      submitBtn.innerHTML = 'Periksa Jawaban <i class="fa-solid fa-check"></i>';
      submitBtn.onclick = function () {
        submitMatching(item);
      };
    }
  }

  function submitMatching(item) {
    var selects = optionsWrap.querySelectorAll(".quiz-match-select");
    var selections = [];
    var allFilled = true;

    selects.forEach(function (sel) {
      if (sel.value === "") allFilled = false;
      selections.push(sel.value === "" ? -1 : parseInt(sel.value, 10));
    });

    if (!allFilled) {
      if (explanationCard) {
        explanationCard.style.display = "block";
        explanationCard.classList.remove("is-correct", "is-wrong");
        explanationCard.classList.add("is-info");
      }
      if (explanationTitle) explanationTitle.textContent = "Belum Lengkap";
      if (explanationStatusText) explanationStatusText.textContent = "⚠️ Pasangkan seluruh 5 pernyataan terlebih dahulu.";
      if (explanationCorrectAnswer) explanationCorrectAnswer.style.display = "none";
      if (explanationText) explanationText.textContent = "";
      return;
    }

    userAnswers[currentIndex] = selections;
    lockMatchingRows(item, selections);
    showExplanationMatching(item, selections);
    playSound(isMatchingAllCorrect(item, selections) ? "correct" : "wrong");

    if (submitBtn) submitBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "inline-flex";
    updateProgressBarLive();
  }

  function isMatchingAllCorrect(item, selections) {
    return selections.every(function (val, idx) { return val === item.answer[idx]; });
  }

  function lockMatchingRows(item, selections) {
    var rows = optionsWrap.querySelectorAll(".quiz-match-row");
    rows.forEach(function (row, idx) {
      var sel = row.querySelector("select");
      if (sel) sel.disabled = true;
      var icon = row.querySelector(".quiz-match-row-icon");
      var isCorrect = selections[idx] === item.answer[idx];
      row.classList.remove("is-correct", "is-wrong");
      row.classList.add(isCorrect ? "is-correct" : "is-wrong");
      if (icon) icon.innerHTML = isCorrect ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';
    });
  }

  function showExplanationMatching(item, selections) {
    var correctCount = selections.filter(function (val, idx) { return val === item.answer[idx]; }).length;
    var allCorrect = correctCount === item.columnA.length;

    if (explanationTitle) explanationTitle.textContent = "Pembahasan";
    if (explanationCard) {
      explanationCard.style.display = "block";
      explanationCard.classList.remove("is-correct", "is-wrong", "is-info");
      explanationCard.classList.add(allCorrect ? "is-correct" : "is-wrong");
    }
    if (explanationStatusText) {
      explanationStatusText.textContent = allCorrect
        ? "✅ Tepat! Semua pasangan benar (" + correctCount + "/5)."
        : "❌ Belum tepat sepenuhnya. Jawaban benar: " + correctCount + "/5.";
    }
    if (explanationCorrectAnswer) explanationCorrectAnswer.style.display = "none";
    if (explanationText) {
      var lines = item.columnA.map(function (statement, idx) {
        return (idx + 1) + " → " + letters[item.answer[idx]] + ": " + item.explanation[idx];
      });
      explanationText.textContent = lines.join(" ");
    }
  }

  /* --------------------------- BAGIAN 3: ESAI SINGKAT --------------------------- */
  function renderEssay(item, saved) {
    if (!optionsWrap) return;
    optionsWrap.className = "quiz-options";
    optionsWrap.innerHTML = "";

    var textarea = document.createElement("textarea");
    textarea.className = "quiz-essay-textarea";
    textarea.placeholder = "Tulis jawabanmu di sini...";
    optionsWrap.appendChild(textarea);

    if (saved !== null && saved !== undefined) {
      textarea.value = saved;
      textarea.disabled = true;
      showExplanationEssay(item, saved);
      if (nextBtn) nextBtn.style.display = "inline-flex";
    } else if (submitBtn) {
      submitBtn.style.display = "inline-flex";
      submitBtn.innerHTML = 'Kirim Jawaban <i class="fa-solid fa-paper-plane"></i>';
      submitBtn.onclick = function () {
        submitEssay(item, textarea);
      };
    }
  }

  function submitEssay(item, textarea) {
    var value = textarea.value.trim();
    if (!value) {
      textarea.focus();
      return;
    }

    userAnswers[currentIndex] = value;
    textarea.disabled = true;
    showExplanationEssay(item, value);
    playSound("click");

    if (submitBtn) submitBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "inline-flex";
    updateProgressBarLive();
  }

  function showExplanationEssay(item) {
    if (explanationTitle) explanationTitle.textContent = "Pedoman Jawaban";
    if (explanationCard) {
      explanationCard.style.display = "block";
      explanationCard.classList.remove("is-correct", "is-wrong");
      explanationCard.classList.add("is-info");
    }
    if (explanationStatusText) explanationStatusText.textContent = "📝 Jawabanmu sudah tersimpan. Bandingkan dengan pedoman berikut:";
    if (explanationCorrectAnswer) explanationCorrectAnswer.style.display = "none";
    if (explanationText) explanationText.textContent = item.modelAnswer;
  }

  /* ------------------------------- NAVIGASI ------------------------------- */
  function updateProgressBarLive() {
    var total = quizItems.length;
    var answeredSoFar = userAnswers.filter(function (a) { return a !== null; }).length;
    if (progressFill) progressFill.style.width = (answeredSoFar / total) * 100 + "%";
  }

  function goNext() {
    if (currentIndex === quizItems.length - 1) {
      finishQuiz();
    } else {
      currentIndex++;
      renderQuestion();
    }
  }

  function goPrev() {
    if (currentIndex === 0) return;
    currentIndex--;
    renderQuestion();
  }

  /* -------------------------------- HASIL -------------------------------- */
  function finishQuiz() {
    var correctCount = 0;
    var gradableTotal = 0;
    var essayAnswered = 0;
    var essayTotal = 0;

    quizItems.forEach(function (item, i) {
      var ans = userAnswers[i];
      if (item.type === "mc") {
        gradableTotal++;
        if (ans === item.answer) correctCount++;
      } else if (item.type === "matching") {
        gradableTotal += item.columnA.length;
        if (ans) {
          ans.forEach(function (val, idx) {
            if (val === item.answer[idx]) correctCount++;
          });
        }
      } else if (item.type === "essay") {
        essayTotal++;
        if (ans) essayAnswered++;
      }
    });

    var wrongCount = gradableTotal - correctCount;
    var percent = gradableTotal > 0 ? Math.round((correctCount / gradableTotal) * 100) : 0;

    if (progressFill) progressFill.style.width = "100%";
    showState(resultState);
    playSound("complete");

    if (scoreEl) scoreEl.textContent = correctCount + "/" + gradableTotal;
    if (correctEl) correctEl.textContent = correctCount;
    if (wrongEl) wrongEl.textContent = wrongCount;
    if (percentEl) percentEl.textContent = percent + "%";
    if (essayValueEl) essayValueEl.textContent = essayAnswered + "/" + essayTotal;

    var category;
    if (percent >= 90) {
      category = { emoji: "🏆", label: "Sangat Baik" };
    } else if (percent >= 80) {
      category = { emoji: "🥇", label: "Baik" };
    } else if (percent >= 70) {
      category = { emoji: "👍", label: "Cukup" };
    } else {
      category = { emoji: "📚", label: "Perlu Belajar Lagi" };
    }
    if (categoryEmojiEl) categoryEmojiEl.textContent = category.emoji;
    if (categoryLabelEl) categoryLabelEl.textContent = category.label;

    // Simpan status quiz ke sistem progress terpusat (skor dari bagian yang
    // dapat dinilai otomatis: Pilihan Ganda + Memasangkan).
    if (typeof PatternLabProgress !== "undefined") {
      PatternLabProgress.updateProgress("quiz", {
        completed: true,
        score: correctCount,
        total: gradableTotal,
        percentage: percent
      });
    }
  }

  if (startBtn) startBtn.addEventListener("click", startQuiz);
  if (nextBtn) nextBtn.addEventListener("click", goNext);
  if (prevBtn) prevBtn.addEventListener("click", goPrev);
  if (restartBtn) restartBtn.addEventListener("click", startQuiz);
  if (backMateriBtn) {
    backMateriBtn.addEventListener("click", function () {
      window.location.href = "materi.html";
    });
  }
}

/* --------------------------------------------------------------------------
   9. HALAMAN PROGRES: identitas pengguna + status tiap tahap pembelajaran,
   dihitung otomatis dari PatternLabProgress (bukan angka statis).
   -------------------------------------------------------------------------- */
function initProgresPage() {
  var page = document.getElementById("progresPage");
  if (!page) return;

  var user = PatternLabProgress.getCurrentUser();
  var progress = PatternLabProgress.loadProgress();
  var stats = PatternLabProgress.overallStats(progress);

  var STAGES = [
    { key: "tujuan", label: "Tujuan Pembelajaran", done: !!progress.tujuan },
    { key: "petaKonsep", label: "Peta Konsep", done: !!progress.petaKonsep },
    { key: "materi", label: "Materi", done: !!progress.materi },
    { key: "video1", label: "Video 1", done: !!progress.video1 },
    { key: "video2", label: "Video 2", done: !!progress.video2 },
    { key: "simulasi", label: "Simulasi AI", done: !!progress.simulasi },
    { key: "lkpd", label: "LKPD", done: !!progress.lkpd },
    { key: "quiz", label: "Quiz", done: !!(progress.quiz && progress.quiz.completed) },
    { key: "glosarium", label: "Glosarium", done: !!progress.glosarium }
  ];
  var videoDoneCount = (progress.video1 ? 1 : 0) + (progress.video2 ? 1 : 0);
  var quizInfo = progress.quiz || { completed: false, score: 0, total: 0, percentage: 0 };

  /* ---------------- Identitas pengguna ---------------- */
  var nameEl = document.getElementById("progresUserName");
  var classEl = document.getElementById("progresUserClass");
  if (nameEl) nameEl.textContent = user && user.name ? user.name : "Tamu";
  if (classEl) classEl.textContent = user && user.className ? user.className : "-";

  /* ---------------- 4 kartu statistik ringkas ---------------- */
  var statPercent = document.getElementById("progresStatPercent");
  var statStages = document.getElementById("progresStatStages");
  var statVideo = document.getElementById("progresStatVideo");
  var statQuiz = document.getElementById("progresStatQuiz");
  var statQuizTrend = document.getElementById("progresStatQuizTrend");

  if (statPercent) statPercent.textContent = stats.percent + "%";
  if (statStages) statStages.textContent = stats.done + " / " + stats.total;
  if (statVideo) statVideo.textContent = videoDoneCount + " / 2";
  if (statQuiz) {
    statQuiz.textContent = quizInfo.completed ? quizInfo.percentage + "%" : "-";
  }
  if (statQuizTrend) {
    statQuizTrend.textContent = quizInfo.completed
      ? "Skor " + quizInfo.score + " dari " + quizInfo.total + " soal"
      : "Belum dikerjakan";
  }

  /* ---------------- Progress bar per tahap ---------------- */
  var bars = document.querySelectorAll(".progress-bar-fill[data-stage]");
  bars.forEach(function (bar) {
    var stageKey = bar.getAttribute("data-stage");
    var stage = STAGES.filter(function (s) { return s.key === stageKey; })[0];
    var percent = stage && stage.done ? 100 : 0;
    if (stageKey === "quiz" && quizInfo.completed) percent = quizInfo.percentage;
    bar.setAttribute("data-percent", percent);

    var row = bar.closest(".progress-topic-row");
    if (row) {
      var percentLabel = row.querySelector("[data-stage-percent]");
      if (percentLabel) percentLabel.textContent = percent + "%";
    }
  });

  /* ---------------- Donut ringkasan ---------------- */
  var donut = document.getElementById("masteryDonut");
  if (donut) {
    donut.setAttribute("data-mastered", stats.percent);
    donut.setAttribute("data-review", 0);
    var donutValue = donut.querySelector(".donut-hole b");
    if (donutValue) donutValue.textContent = stats.percent + "%";
    var legendMastered = document.getElementById("progresLegendMastered");
    var legendRemaining = document.getElementById("progresLegendRemaining");
    if (legendMastered) legendMastered.textContent = "Selesai (" + stats.percent + "%)";
    if (legendRemaining) legendRemaining.textContent = "Belum selesai (" + (100 - stats.percent) + "%)";
  }

  /* ---------------- Daftar tahap selesai / belum selesai ---------------- */
  var doneListEl = document.getElementById("progresDoneList");
  var todoListEl = document.getElementById("progresTodoList");
  var doneStages = STAGES.filter(function (s) { return s.done; });
  var todoStages = STAGES.filter(function (s) { return !s.done; });

  if (doneListEl) {
    doneListEl.innerHTML = doneStages.length
      ? doneStages.map(function (s) {
          return '<div class="topic-chip mastered"><i class="fa-solid fa-circle-check"></i> ' + s.label + "</div>";
        }).join("")
      : '<p style="color: var(--color-text-faint); font-size: 0.86rem;">Belum ada tahap yang selesai.</p>';
  }

  if (todoListEl) {
    todoListEl.innerHTML = todoStages.length
      ? todoStages.map(function (s) {
          return '<div class="topic-chip needs-review"><i class="fa-solid fa-circle-notch"></i> ' + s.label + "</div>";
        }).join("")
      : '<p style="color: var(--color-text-faint); font-size: 0.86rem;">🎉 Semua tahap sudah selesai!</p>';
  }

  /* ---------------- Animasi (bar + donut) saat terlihat di layar ---------------- */
  function animateBars() {
    bars.forEach(function (bar) {
      var target = bar.getAttribute("data-percent") || 0;
      bar.style.width = target + "%";
    });
  }

  function drawDonut() {
    if (!donut) return;
    var mastered = parseInt(donut.getAttribute("data-mastered"), 10) || 0;
    var review = parseInt(donut.getAttribute("data-review"), 10) || 0;

    var deg1 = mastered * 3.6;
    var deg2 = (mastered + review) * 3.6;

    donut.style.background =
      "conic-gradient(#3654ff 0deg " + deg1 + "deg, " +
      "#22d3ee " + deg1 + "deg " + deg2 + "deg, " +
      "#e5e9f5 " + deg2 + "deg 360deg)";
  }

  if (!("IntersectionObserver" in window)) {
    animateBars();
    drawDonut();
    return;
  }

  var observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateBars();
          drawDonut();
          obs.disconnect();
        }
      });
    },
    { threshold: 0.2 }
  );

  observer.observe(page);
}

/* --------------------------------------------------------------------------
   9b. HALAMAN LKPD: cetak/simpan, prefill identitas dari login, dan
   pencatatan status selesai ke progress terpusat.
   -------------------------------------------------------------------------- */
function initLkpdPage() {
  var nameInput = document.getElementById("lkpdName");
  if (!nameInput) return; // bukan halaman LKPD

  var printBtn = document.getElementById("lkpdPrintBtn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }

  // Isi otomatis Nama & Kelas dari identitas yang sedang login, agar tidak
  // perlu diketik ulang. Field tetap bisa diedit manual jika diperlukan.
  if (typeof PatternLabProgress !== "undefined") {
    var user = PatternLabProgress.getCurrentUser();
    var classInput = document.getElementById("lkpdClass");
    if (user) {
      if (nameInput && !nameInput.value) nameInput.value = user.name || "";
      if (classInput && !classInput.value) classInput.value = user.className || "";
    }
  }

  /* ---------------------- Hubungan Simulasi AI -> LKPD (Kegiatan 1) ---------------------- */
  // Isi baris tabel yang masih kosong dengan ringkasan hasil percobaan
  // terakhir dari halaman Simulasi (bila ada), sebagai referensi awal.
  // Input manual TIDAK dihapus/dikunci — pengguna tetap bebas mengubahnya.
  (function prefillFromSimulasi() {
    if (typeof PatternLabProgress === "undefined") return;
    var results = PatternLabProgress.loadSimResults();
    if (!results || !results.length) return;

    // Pakai hasil terbaru dulu, maksimal 3 baris.
    var recent = results.slice(-3).reverse();
    var filledAny = false;

    recent.forEach(function (entry, idx) {
      var rowNum = idx + 1;
      var gambarInput = document.getElementById("lkpdRow" + rowNum + "Gambar");
      var hasilInput = document.getElementById("lkpdRow" + rowNum + "Hasil");
      var confInput = document.getElementById("lkpdRow" + rowNum + "Confidence");
      if (!gambarInput || !hasilInput || !confInput) return;

      if (!gambarInput.value.trim()) {
        gambarInput.value = "Objek: " + (entry.objek || "-") + " — Tahapan: " + (entry.tahapan || "-");
        filledAny = true;
      }
      if (!hasilInput.value.trim()) {
        hasilInput.value = entry.objek || "-";
        filledAny = true;
      }
      if (!confInput.value.trim()) {
        if (entry.confidence === null || entry.confidence === undefined) {
          confInput.value = "-";
        } else {
          confInput.value = entry.confidence + "%" + (entry.simulated ? " (simulasi)" : "");
        }
        filledAny = true;
      }
    });

    var note = document.getElementById("lkpdAutofillNote");
    if (filledAny && note) note.style.display = "flex";
  })();

  /* ---------------------- Simpan & Muat Jawaban LKPD ---------------------- */
  // Field yang dipertahankan nilainya lewat localStorage (per pengguna),
  // memakai mekanisme yang sama dengan sistem progress lainnya, supaya
  // jawaban tidak hilang saat pengguna berpindah halaman lalu kembali lagi.
  var LKPD_FIELD_IDS = [
    "lkpdName", "lkpdClass", "lkpdDate",
    "lkpdRow1Gambar", "lkpdRow1Hasil", "lkpdRow1Confidence", "lkpdRow1Sesuai",
    "lkpdRow2Gambar", "lkpdRow2Hasil", "lkpdRow2Confidence", "lkpdRow2Sesuai",
    "lkpdRow3Gambar", "lkpdRow3Hasil", "lkpdRow3Confidence", "lkpdRow3Sesuai",
    "lkpdQ1", "lkpdQ2", "lkpdQ3", "lkpdQ4", "lkpdQ5", "lkpdQ6", "lkpdQ7", "lkpdQ8", "lkpdQ9",
    "lkpdKesimpulan",
    "lkpdCheck1", "lkpdCheck2", "lkpdCheck3", "lkpdCheck4", "lkpdCheck5"
  ];

  function lkpdStorageKey() {
    if (typeof PatternLabProgress === "undefined") return null;
    var u = PatternLabProgress.getCurrentUser();
    if (!u) return null;
    return "patternLabLkpdAnswers_" + (u.name || "").trim().toLowerCase().replace(/\s+/g, " ") +
      "_" + (u.className || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function loadSavedLkpdAnswers() {
    var key = lkpdStorageKey();
    if (!key) return;
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return;
      var data = JSON.parse(raw);
      LKPD_FIELD_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el || !(id in data)) return;
        if (el.type === "checkbox") {
          if (!el.checked) el.checked = !!data[id];
        } else if (!el.value) {
          el.value = data[id];
        }
      });
    } catch (err) {
      /* abaikan */
    }
  }

  function saveLkpdAnswers() {
    var key = lkpdStorageKey();
    if (!key) return false;
    var data = {};
    LKPD_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      data[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  // Muat jawaban tersimpan SETELAH prefill dari Simulasi, tapi tanpa
  // menimpa nilai yang sudah otomatis terisi (dicek lewat !el.value).
  loadSavedLkpdAnswers();

  var saveBtn = document.getElementById("lkpdSaveBtn");
  var saveStatus = document.getElementById("lkpdSaveStatus");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var ok = saveLkpdAnswers();
      var kesimpulanEl = document.getElementById("lkpdKesimpulan");
      var firstRowEl = document.getElementById("lkpdRow1Hasil");
      var hasKesimpulan = kesimpulanEl && kesimpulanEl.value.trim().length > 0;
      var hasData = firstRowEl && firstRowEl.value.trim().length > 0;
      if (ok && hasKesimpulan && hasData && typeof PatternLabProgress !== "undefined") {
        PatternLabProgress.updateProgress("lkpd", true);
      }
      if (saveStatus) {
        saveStatus.style.display = "block";
        saveStatus.innerHTML = ok
          ? '<i class="fa-solid fa-circle-check"></i> Jawaban tersimpan di perangkatmu.'
          : '<i class="fa-solid fa-triangle-exclamation"></i> Gagal menyimpan. Coba lagi.';
      }
    });
  }

  // LKPD dianggap selesai ketika bagian inti (data percobaan minimal satu
  // baris + kesimpulan) sudah diisi, dicek pada saat pengguna menekan
  // "Lanjut ke Quiz". Navigasi tetap berjalan seperti biasa (href asli
  // tidak diubah) — pengecekan ini hanya menentukan status progress.
  var nextBtn = document.getElementById("lkpdNextBtn");
  var kesimpulan = document.getElementById("lkpdKesimpulan");
  var firstRowPrediction = document.getElementById("lkpdRow1Hasil");

  if (nextBtn && typeof PatternLabProgress !== "undefined") {
    nextBtn.addEventListener("click", function () {
      saveLkpdAnswers();
      var hasKesimpulan = kesimpulan && kesimpulan.value.trim().length > 0;
      var hasData = firstRowPrediction && firstRowPrediction.value.trim().length > 0;
      if (hasKesimpulan && hasData) {
        PatternLabProgress.updateProgress("lkpd", true);
      }
    });
  }
}

/* --------------------------------------------------------------------------
   10. TAHUN OTOMATIS DI FOOTER
   -------------------------------------------------------------------------- */
function initFooterYear() {
  var yearEl = document.getElementById("currentYear");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/* --------------------------------------------------------------------------
   11. GLOSARIUM & PETA KONSEP INTERAKTIF (halaman Materi)
   Dua fitur tambahan yang murni ADITIF — tidak mengubah initMateriPage()
   atau data materi yang sudah ada. Keduanya memakai satu sumber data yang
   sama (PATTERNLAB_TERMS) agar istilah pada Glosarium dan Peta Konsep tetap
   konsisten satu sama lain, dan hanya berjalan jika elemen terkait memang
   ada di halaman (aman dipakai bersama script.js di semua halaman).
   -------------------------------------------------------------------------- */

/* Sumber data istilah — dirangkum dari materi yang sudah ada pada
   initMateriPage() (topik: pengertian, pola-citra, pola-suara,
   cara-kerja-ai, metode, penerapan, teachable-machine). "topic" mengacu
   pada data-topic tombol sidebar Materi agar tombol "Pelajari di Materi"
   dapat langsung berpindah ke topik yang relevan. */
var PATTERNLAB_TERMS = {
  "pattern-recognition": { term: "Pattern Recognition", sub: "Pengenalan Pola", category: "Konsep Dasar", topic: "pengertian",
    def: "Proses mengenali, mengelompokkan, atau mengidentifikasi keteraturan dalam data menggunakan ciri-ciri tertentu, baik secara manual maupun dengan bantuan AI." },
  "ai": { term: "Artificial Intelligence (AI)", sub: "Kecerdasan Buatan", category: "Konsep Dasar", topic: "pengertian",
    def: "Kecerdasan buatan yang membantu komputer meniru sebagian kemampuan berpikir manusia, termasuk kemampuan mengenali pola pada citra dan suara." },
  "computer-vision": { term: "Computer Vision", sub: "Visi Komputer", category: "Citra", topic: "pola-citra",
    def: "Bidang AI yang memungkinkan komputer menganalisis dan mengenali objek atau karakteristik visual dari sebuah gambar." },
  "pola-citra": { term: "Pengenalan Pola Citra", sub: "Image Pattern Recognition", category: "Citra", topic: "pola-citra",
    def: "Proses membaca piksel gambar untuk mengenali objek, wajah, bentuk, atau struktur visual di dalamnya secara otomatis." },
  "pola-suara": { term: "Pengenalan Pola Suara", sub: "Voice/Audio Pattern Recognition", category: "Suara", topic: "pola-suara",
    def: "Teknologi yang memungkinkan komputer mengenali dan memahami gelombang suara manusia, baik kata yang diucapkan maupun identitas pembicaranya." },
  "akuisisi-citra": { term: "Akuisisi Citra", sub: "Image Acquisition", category: "Tahapan", topic: "pola-citra",
    def: "Tahap awal pengambilan gambar dari kamera, sensor, atau pemindai sebagai pintu masuk data visual ke dalam sistem." },
  "akuisisi-audio": { term: "Akuisisi Audio", sub: "Perekaman Audio", category: "Tahapan", topic: "pola-suara",
    def: "Tahap mengubah gelombang suara analog menjadi sinyal digital melalui mikrofon (proses sampling)." },
  "preprocessing": { term: "Preprocessing", sub: "Pra-pemrosesan", category: "Tahapan", topic: "pola-citra",
    def: "Tahap membersihkan dan merapikan data mentah (citra maupun suara) — misalnya menghilangkan noise — sebelum dianalisis lebih lanjut." },
  "ekstraksi-fitur": { term: "Ekstraksi Fitur", sub: "Ekstraksi Ciri / Feature Extraction", category: "Tahapan", topic: "pola-citra",
    def: "Proses mengambil ciri-ciri penting dari data yang sudah bersih, seperti tepi dan warna pada citra atau frekuensi pada suara." },
  "klasifikasi": { term: "Klasifikasi", sub: "Classification", category: "Tahapan", topic: "cara-kerja-ai",
    def: "Tahap mencocokkan ciri yang telah diekstraksi dengan pola yang sudah dipelajari untuk menentukan kategori/kelas data." },
  "training-data": { term: "Training Data", sub: "Data Latih", category: "Cara Kerja AI", topic: "cara-kerja-ai",
    def: "Kumpulan data contoh beserta labelnya yang diberikan kepada sistem agar AI dapat belajar mengenali pola." },
  "prediksi": { term: "Prediksi", sub: "Prediction", category: "Cara Kerja AI", topic: "cara-kerja-ai",
    def: "Hasil akhir sistem berupa label/kategori beserta tingkat keyakinan terhadap data baru yang belum pernah dilihat sebelumnya." },
  "confidence": { term: "Confidence", sub: "Tingkat Keyakinan", category: "Cara Kerja AI", topic: "cara-kerja-ai",
    def: "Tingkat keyakinan model AI terhadap sebuah prediksi, biasanya ditampilkan dalam bentuk persentase." },
  "machine-learning": { term: "Machine Learning", sub: "Pembelajaran Mesin", category: "Metode", topic: "metode",
    def: "Cabang AI di mana model belajar mengenali pola dari fitur-fitur data secara fleksibel, tanpa aturan yang ditulis manual." },
  "deep-learning": { term: "Deep Learning", sub: "Pembelajaran Mendalam", category: "Metode", topic: "metode",
    def: "Pengembangan Machine Learning yang memakai jaringan saraf tiruan berlapis-lapis untuk mempelajari pola yang lebih kompleks." },
  "cnn": { term: "CNN", sub: "Convolutional Neural Network", category: "Metode", topic: "metode",
    def: "Arsitektur Deep Learning yang efektif digunakan untuk mengenali pola pada citra atau gambar." },
  "hmm": { term: "HMM", sub: "Hidden Markov Model", category: "Metode", topic: "metode",
    def: "Model probabilistik klasik yang selama bertahun-tahun menjadi andalan dalam sistem pengenalan pola suara/ucapan." },
  "rnn": { term: "RNN", sub: "Recurrent Neural Network", category: "Metode", topic: "metode",
    def: "Arsitektur jaringan saraf yang cocok untuk data berurutan (sekuensial) seperti sinyal suara dan teks." },
  "lstm": { term: "LSTM", sub: "Long Short-Term Memory", category: "Metode", topic: "metode",
    def: "Pengembangan dari RNN yang mampu \u201cmengingat\u201d konteks dari data sebelumnya dalam jangka waktu yang lebih panjang." },
  "mfcc": { term: "MFCC", sub: "Mel-Frequency Cepstral Coefficients", category: "Suara", topic: "pola-suara",
    def: "Teknik ekstraksi fitur audio yang mengubah gelombang suara menjadi representasi frekuensi yang meniru cara telinga manusia mendengar." },
  "template-matching": { term: "Template Matching", sub: "Pencocokan Templat", category: "Metode", topic: "metode",
    def: "Metode klasik yang mencocokkan data baru dengan satu atau beberapa pola contoh (template) yang sudah tersimpan sebelumnya." },
  "dataset": { term: "Dataset", sub: "Kumpulan Data", category: "Praktik", topic: "teachable-machine",
    def: "Kumpulan sampel data (gambar/suara) yang digunakan untuk melatih model AI mengenali pola." },
  "noise": { term: "Noise", sub: "Derau / Gangguan", category: "Tahapan", topic: "pola-citra",
    def: "Gangguan atau bintik-bintik pada data citra maupun suara yang perlu dibersihkan pada tahap preprocessing." },
  "speech-recognition": { term: "Speech Recognition", sub: "Pengenalan Ucapan", category: "Suara", topic: "pola-suara",
    def: "Sistem yang berfokus pada apa yang diucapkan — mengubah ucapan menjadi teks, seperti pada fitur voice typing." },
  "speaker-recognition": { term: "Speaker Recognition", sub: "Pengenalan Pembicara", category: "Suara", topic: "pola-suara",
    def: "Sistem yang berfokus pada siapa yang berbicara — mengenali identitas seseorang dari karakteristik vokalnya." },
  "teachable-machine": { term: "Teachable Machine", sub: "Google Teachable Machine", category: "Praktik", topic: "teachable-machine",
    def: "Platform berbasis web dari Google untuk melatih model Machine Learning sederhana secara visual tanpa menulis kode (no-code)." },
  "image-project": { term: "Image Project", sub: "Proyek Citra", category: "Praktik", topic: "teachable-machine",
    def: "Jenis proyek pada Teachable Machine untuk melatih model mengenali objek atau kategori gambar tertentu." },
  "audio-project": { term: "Audio Project", sub: "Proyek Audio", category: "Praktik", topic: "teachable-machine",
    def: "Jenis proyek pada Teachable Machine untuk melatih model mengenali kata atau suara tertentu dari mikrofon." },
  "pose-project": { term: "Pose Project", sub: "Proyek Pose", category: "Praktik", topic: "teachable-machine",
    def: "Jenis proyek pada Teachable Machine untuk melatih model mengenali posisi atau gerakan tubuh manusia." }
};

/* Berpindah ke topik tertentu pada halaman Materi dengan memicu tombol
   sidebar topik yang sudah ada (sekaligus otomatis scroll ke sana), tanpa
   perlu mengubah initMateriPage(). Aman dipanggil dari halaman mana pun —
   fungsi ini akan diam saja jika tombol topik tidak ditemukan. */
function patternLabGoToMateriTopic(topicKey) {
  var btn = document.querySelector('.materi-nav-item[data-topic="' + topicKey + '"]');
  if (btn) {
    btn.click();
    return;
  }
  var content = document.getElementById("materiContent");
  if (content) {
    content.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  // Tombol topik/artikel materi tidak ditemukan di halaman saat ini
  // (mis. dipanggil dari halaman Peta Konsep yang kini terpisah) —
  // "titipkan" topik yang dituju lewat sessionStorage lalu arahkan ke
  // halaman Materi; initMateriPage() akan langsung membuka topik tsb.
  try {
    sessionStorage.setItem("patternlab_pending_materi_topic", topicKey);
  } catch (err) {
    /* abaikan jika sessionStorage tidak tersedia */
  }
  window.location.href = "materi.html";
}

function initGlossary() {
  var grid = document.getElementById("glossaryGrid");
  if (!grid) return;

  var searchInput = document.getElementById("glossarySearchInput");
  var countEl = document.getElementById("glossaryCount");
  var emptyEl = document.getElementById("glossaryEmpty");

  var keys = Object.keys(PATTERNLAB_TERMS).sort(function (a, b) {
    return PATTERNLAB_TERMS[a].term.localeCompare(PATTERNLAB_TERMS[b].term);
  });

  keys.forEach(function (key) {
    var data = PATTERNLAB_TERMS[key];
    var card = document.createElement("button");
    card.type = "button";
    card.className = "glossary-card";
    card.setAttribute("data-key", key);
    card.setAttribute("data-search", (data.term + " " + data.sub + " " + data.category).toLowerCase());
    card.innerHTML =
      '<div class="glossary-card-top">' +
      '<span class="glossary-card-term">' + data.term + "</span>" +
      '<i class="fa-solid fa-chevron-down glossary-card-chevron"></i>' +
      "</div>" +
      '<span class="glossary-card-sub">' + data.sub + "</span>" +
      '<span class="glossary-card-tag">' + data.category + "</span>" +
      '<p class="glossary-card-def">' + data.def + "</p>";

    card.addEventListener("click", function () {
      card.classList.toggle("is-open");
    });

    grid.appendChild(card);
  });

  var allCards = grid.querySelectorAll(".glossary-card");

  function applyFilter() {
    var q = (searchInput ? searchInput.value : "").trim().toLowerCase();
    var visible = 0;
    allCards.forEach(function (card) {
      var match = !q || card.getAttribute("data-search").indexOf(q) !== -1;
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    if (countEl) countEl.textContent = visible + " istilah";
    if (emptyEl) emptyEl.style.display = visible === 0 ? "block" : "none";
  }

  applyFilter();

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
  }

  /* Dipanggil dari Peta Konsep ("Lihat di Glosarium") agar istilah yang
     relevan langsung tersorot tanpa mengubah struktur pencarian yang ada. */
  window.patternLabOpenGlossaryTerm = function (key) {
    if (!searchInput || !PATTERNLAB_TERMS[key]) return;
    searchInput.value = PATTERNLAB_TERMS[key].term;
    applyFilter();
    var card = grid.querySelector('.glossary-card[data-key="' + key + '"]');
    if (card) {
      card.classList.add("is-open");
      grid.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Jika pengguna baru saja berpindah dari halaman Peta Konsep lewat tombol
  // "Lihat di Glosarium", langsung buka istilah yang dituju.
  try {
    var pendingTerm = sessionStorage.getItem("patternlab_pending_glossary_term");
    if (pendingTerm) {
      sessionStorage.removeItem("patternlab_pending_glossary_term");
      window.patternLabOpenGlossaryTerm(pendingTerm);
    }
  } catch (e) {}

  /* ----------------------------------------------------------------------
     Tombol "Tandai Glosarium Sudah Dipelajari" (halaman glosarium.html) —
     mengikuti pola tombol selesai yang sudah ada di halaman Materi, dan
     menyimpan ke sistem progress terpusat yang sama (key "glosarium").
     ---------------------------------------------------------------------- */
  var glossaryCompleteBtn = document.getElementById("glossaryCompleteBtn");
  var glossaryCompleteLabel = document.getElementById("glossaryCompleteBtnLabel");

  function reflectGlossaryStatus() {
    if (!glossaryCompleteBtn) return;
    var progress = typeof PatternLabProgress !== "undefined" ? PatternLabProgress.loadProgress() : {};
    var done = !!progress.glosarium;
    glossaryCompleteBtn.classList.toggle("is-done", done);
    if (glossaryCompleteLabel) glossaryCompleteLabel.textContent = done ? "✓ Glosarium Sudah Dipelajari" : "Tandai Glosarium Sudah Dipelajari";
  }

  if (glossaryCompleteBtn) {
    reflectGlossaryStatus();
    glossaryCompleteBtn.addEventListener("click", function () {
      if (typeof PatternLabProgress === "undefined") return;
      PatternLabProgress.updateProgress("glosarium", true);
      reflectGlossaryStatus();
    });
  }
}

function initConceptMap() {
  var tree = document.getElementById("conceptMapTree");
  if (!tree) return;

  var detailPlaceholder = document.getElementById("conceptDetailPlaceholder");
  var detailBody = document.getElementById("conceptDetailBody");
  var detailTag = document.getElementById("conceptDetailTag");
  var detailTitle = document.getElementById("conceptDetailTitle");
  var detailDef = document.getElementById("conceptDetailDef");
  var detailRelationWrap = document.getElementById("conceptDetailRelation");
  var detailRelationText = document.getElementById("conceptDetailRelationText");
  var detailActions = document.getElementById("conceptDetailActions");

  /* Struktur cabang Peta Konsep. Setiap node boleh mengacu ke istilah pada
     PATTERNLAB_TERMS lewat "term" (agar tombol "Lihat di Glosarium" dapat
     muncul), atau berdiri sendiri dengan def/relation miliknya sendiri
     untuk hal yang tidak dibahas sebagai istilah kamus (mis. bidang
     penerapan). "topic" selalu mengacu ke topik Materi yang sudah ada. */
  var CONCEPT_MAP = [
    {
      key: "citra", icon: "fa-image", label: "Pengenalan Pola Citra", topic: "pola-citra", term: "pola-citra",
      relation: "Cabang utama Pattern Recognition yang bekerja pada data gambar/visual.",
      children: [
        { label: "Computer Vision", term: "computer-vision", topic: "pola-citra" },
        { label: "Akuisisi Citra", term: "akuisisi-citra", topic: "pola-citra" },
        { label: "Preprocessing", term: "preprocessing", topic: "pola-citra" },
        { label: "Ekstraksi Fitur", term: "ekstraksi-fitur", topic: "pola-citra" },
        { label: "Klasifikasi", term: "klasifikasi", topic: "pola-citra" },
        { label: "CNN", term: "cnn", topic: "pola-citra" },
        { label: "Contoh Penerapan", topic: "pola-citra",
          def: "Face ID, Google Lens, deteksi plat nomor (ETLE), hingga pencitraan medis (X-ray/MRI).",
          relation: "Menunjukkan bagaimana tahapan Pengenalan Pola Citra dipakai secara nyata sehari-hari." }
      ]
    },
    {
      key: "suara", icon: "fa-microphone", label: "Pengenalan Pola Suara", topic: "pola-suara", term: "pola-suara",
      relation: "Cabang utama Pattern Recognition yang bekerja pada data audio/gelombang suara.",
      children: [
        { label: "Speech Recognition", term: "speech-recognition", topic: "pola-suara" },
        { label: "Akuisisi Audio", term: "akuisisi-audio", topic: "pola-suara" },
        { label: "Preprocessing", term: "preprocessing", topic: "pola-suara" },
        { label: "Ekstraksi Fitur", term: "ekstraksi-fitur", topic: "pola-suara" },
        { label: "MFCC", term: "mfcc", topic: "pola-suara" },
        { label: "Klasifikasi", term: "klasifikasi", topic: "pola-suara" },
        { label: "HMM / RNN / LSTM", topic: "pola-suara",
          def: "Metode statistik dan Deep Learning (HMM, RNN, LSTM) yang dipakai untuk mencocokkan pola suara yang bersifat berurutan.",
          relation: "Menjadi \u201cotak\u201d di balik tahap Klasifikasi & Pencocokan Pola pada Pengenalan Pola Suara." },
        { label: "Contoh Penerapan", topic: "pola-suara",
          def: "Voice assistant (Google Assistant, Siri, Alexa), speech-to-text, hingga call center otomatis.",
          relation: "Menunjukkan bagaimana tahapan Pengenalan Pola Suara dipakai secara nyata sehari-hari." }
      ]
    },
    {
      key: "cara-kerja-ai", icon: "fa-brain", label: "Cara Kerja AI", topic: "cara-kerja-ai",
      def: "Gambaran menyeluruh bagaimana AI (Machine Learning) belajar dari data hingga bisa mengenali pola secara otomatis, tanpa aturan yang ditulis manual.",
      relation: "Menjelaskan proses belajar yang mendasari Pengenalan Pola Citra maupun Pola Suara.",
      children: [
        { label: "Training Data", term: "training-data", topic: "cara-kerja-ai" },
        { label: "Belajar Pola", topic: "cara-kerja-ai",
          def: "Tahap model mencoba menemukan pola secara berulang — menebak, membandingkan dengan label sebenarnya, lalu memperbaiki diri.",
          relation: "Inti dari proses \u201cbelajar\u201d pada Machine Learning sebelum model siap dipakai." },
        { label: "Ekstraksi Fitur", term: "ekstraksi-fitur", topic: "cara-kerja-ai" },
        { label: "Klasifikasi", term: "klasifikasi", topic: "cara-kerja-ai" },
        { label: "Prediksi", term: "prediksi", topic: "cara-kerja-ai" },
        { label: "Confidence", term: "confidence", topic: "cara-kerja-ai" }
      ]
    },
    {
      key: "metode", icon: "fa-diagram-project", label: "Metode Pengenalan Pola", topic: "metode",
      def: "Kumpulan pendekatan/algoritma yang dipakai untuk mengekstraksi ciri dan mengklasifikasikan data, mulai dari yang klasik hingga modern.",
      relation: "\u201cKotak peralatan\u201d yang dipakai bersama pada Pengenalan Pola Citra maupun Pola Suara.",
      children: [
        { label: "Template Matching", term: "template-matching", topic: "metode" },
        { label: "Machine Learning", term: "machine-learning", topic: "metode" },
        { label: "Deep Learning", term: "deep-learning", topic: "metode" },
        { label: "CNN", term: "cnn", topic: "metode" },
        { label: "HMM", term: "hmm", topic: "metode" },
        { label: "RNN", term: "rnn", topic: "metode" },
        { label: "LSTM", term: "lstm", topic: "metode" }
      ]
    },
    {
      key: "penerapan", icon: "fa-rocket", label: "Penerapan", topic: "penerapan",
      def: "Bidang-bidang kehidupan nyata yang sudah memanfaatkan Pengenalan Pola Citra maupun Suara.",
      relation: "Bukti nyata bahwa konsep data \u2192 pola \u2192 klasifikasi dapat diadaptasi untuk berbagai masalah di dunia nyata.",
      children: [
        { label: "Pendidikan", topic: "penerapan", def: "Absensi otomatis berbasis wajah dan koreksi tulisan tangan otomatis.", relation: "Penerapan Pengenalan Pola di bidang pendidikan." },
        { label: "Kesehatan", topic: "penerapan", def: "Membantu dokter mendeteksi penyakit lewat citra X-ray dan MRI.", relation: "Penerapan Pengenalan Pola di bidang kesehatan." },
        { label: "Keamanan", topic: "penerapan", def: "CCTV pintar, Face Recognition untuk akses ruangan, dan Voice Verification.", relation: "Penerapan Pengenalan Pola di bidang keamanan." },
        { label: "Transportasi", topic: "penerapan", def: "Mobil tanpa pengemudi serta deteksi rambu dan pelanggaran lalu lintas.", relation: "Penerapan Pengenalan Pola di bidang transportasi." },
        { label: "Smartphone", topic: "penerapan", def: "Face Unlock dan Voice Unlock untuk membuka kunci perangkat.", relation: "Penerapan Pengenalan Pola pada perangkat pribadi." },
        { label: "Perbankan", topic: "penerapan", def: "Autentikasi biometrik suara untuk transaksi dan layanan perbankan.", relation: "Penerapan Pengenalan Pola di bidang perbankan." },
        { label: "Smart Home", topic: "penerapan", def: "Asisten suara mengendalikan lampu, AC, dan TV lewat perintah suara.", relation: "Penerapan Pengenalan Pola Suara di rumah pintar." }
      ]
    },
    {
      key: "teachable-machine", icon: "fa-cubes", label: "Praktik dengan Teachable Machine", topic: "teachable-machine", term: "teachable-machine",
      relation: "Sarana untuk mempraktikkan langsung seluruh konsep Pattern Recognition yang sudah dipelajari, tanpa menulis kode.",
      children: [
        { label: "Gather / Collect Data", topic: "teachable-machine",
          def: "Mengumpulkan dan mengelompokkan sampel data (gambar/suara) ke dalam kelas-kelas kategori.",
          relation: "Setara dengan tahap Training Data pada Cara Kerja AI." },
        { label: "Train Model", topic: "teachable-machine",
          def: "Menekan tombol Train agar komputer menganalisis pola dan mengekstrak ciri dari data yang diunggah.",
          relation: "Setara dengan tahap Belajar Pola & Ekstraksi Fitur pada Cara Kerja AI." },
        { label: "Export & Test Model", topic: "teachable-machine",
          def: "Menguji model lewat webcam/mikrofon lalu meng-export model untuk dipakai pada aplikasi lain.",
          relation: "Setara dengan tahap Prediksi & Confidence pada Cara Kerja AI." },
        { label: "Image Project", term: "image-project", topic: "teachable-machine" },
        { label: "Audio Project", term: "audio-project", topic: "teachable-machine" },
        { label: "Pose Project", term: "pose-project", topic: "teachable-machine" }
      ]
    }
  ];

  function resolveNode(raw) {
    var base = raw.term && PATTERNLAB_TERMS[raw.term] ? PATTERNLAB_TERMS[raw.term] : null;
    return {
      title: raw.label || (base ? base.term : ""),
      tag: base ? base.category : "Peta Konsep",
      def: raw.def || (base ? base.def : ""),
      relation: raw.relation || "",
      topic: raw.topic,
      termKey: raw.term || null
    };
  }

  function clearActive() {
    tree.querySelectorAll(".is-active").forEach(function (el) {
      el.classList.remove("is-active");
    });
  }

  /* ----------------------------------------------------------------------
     Pencatatan progress "Peta Konsep" ke sistem progress terpusat.
     Dianggap selesai secara wajar setelah pengguna benar-benar menjelajahi
     peta (bukan hanya membuka halaman) — di sini begitu ia sudah membuka
     detail dari keenam cabang utama minimal sekali.
     ---------------------------------------------------------------------- */
  var progressNote = document.getElementById("conceptMapProgressNote");
  var visitedBranches = {};
  var TOTAL_BRANCHES = CONCEPT_MAP.length;

  function reflectConceptMapProgress() {
    if (!progressNote) return;
    var progress = typeof PatternLabProgress !== "undefined" ? PatternLabProgress.loadProgress() : {};
    var visitedCount = Object.keys(visitedBranches).length;
    if (progress.petaKonsep) {
      progressNote.textContent = "✓ Peta Konsep sudah dipelajari";
      progressNote.classList.add("is-done");
    } else {
      progressNote.textContent = visitedCount + " dari " + TOTAL_BRANCHES + " cabang dijelajahi";
      progressNote.classList.remove("is-done");
    }
  }

  function markBranchVisited(branchKey) {
    if (!branchKey) return;
    visitedBranches[branchKey] = true;
    if (Object.keys(visitedBranches).length >= TOTAL_BRANCHES && typeof PatternLabProgress !== "undefined") {
      PatternLabProgress.updateProgress("petaKonsep", true);
    }
    reflectConceptMapProgress();
  }

  reflectConceptMapProgress();

  function showDetail(node, btnEl) {
    clearActive();
    if (btnEl) btnEl.classList.add("is-active");

    if (detailPlaceholder) detailPlaceholder.style.display = "none";
    if (detailBody) detailBody.style.display = "block";
    if (detailTag) detailTag.textContent = node.tag;
    if (detailTitle) detailTitle.textContent = node.title;
    if (detailDef) detailDef.textContent = node.def;

    if (node.relation) {
      if (detailRelationWrap) detailRelationWrap.style.display = "block";
      if (detailRelationText) detailRelationText.textContent = node.relation;
    } else if (detailRelationWrap) {
      detailRelationWrap.style.display = "none";
    }

    if (detailActions) {
      detailActions.innerHTML = "";

      if (node.topic) {
        var learnBtn = document.createElement("button");
        learnBtn.type = "button";
        learnBtn.className = "btn btn-outline";
        learnBtn.innerHTML = 'Pelajari di Materi <i class="fa-solid fa-arrow-right"></i>';
        learnBtn.addEventListener("click", function () {
          patternLabGoToMateriTopic(node.topic);
        });
        detailActions.appendChild(learnBtn);
      }

      if (node.termKey) {
        var glossaryBtn = document.createElement("button");
        glossaryBtn.type = "button";
        glossaryBtn.className = "btn btn-outline";
        glossaryBtn.innerHTML = '<i class="fa-solid fa-book-bookmark"></i> Lihat di Glosarium';
        glossaryBtn.addEventListener("click", function () {
          if (window.patternLabOpenGlossaryTerm) {
            // Glosarium ada di halaman yang sama (jarang terjadi, tapi dijaga).
            window.patternLabOpenGlossaryTerm(node.termKey);
          } else {
            // Peta Konsep kini halaman terpisah dari Glosarium — simpan
            // istilah yang dituju lalu pindah halaman; glosarium.html akan
            // otomatis membukanya (lihat initGlossary()).
            try {
              sessionStorage.setItem("patternlab_pending_glossary_term", node.termKey);
            } catch (e) {}
            window.location.href = "glosarium.html";
          }
        });
        detailActions.appendChild(glossaryBtn);
      }
    }
  }

  /* --- Render pusat: PATTERN RECOGNITION --- */
  var centerWrap = document.createElement("div");
  centerWrap.className = "conceptmap-center";
  var centerBtn = document.createElement("button");
  centerBtn.type = "button";
  centerBtn.className = "conceptmap-center-btn";
  centerBtn.innerHTML = '<i class="fa-solid fa-diagram-project"></i> PATTERN RECOGNITION';
  centerBtn.addEventListener("click", function () {
    showDetail(resolveNode({ term: "pattern-recognition", topic: "pengertian",
      relation: "Konsep inti yang menjadi dasar seluruh cabang pada Peta Konsep ini." }), centerBtn);
  });
  centerWrap.appendChild(centerBtn);
  tree.appendChild(centerWrap);

  var trunk = document.createElement("div");
  trunk.className = "conceptmap-trunk";
  tree.appendChild(trunk);

  /* --- Render cabang & anak node --- */
  var branchesWrap = document.createElement("div");
  branchesWrap.className = "conceptmap-branches";

  CONCEPT_MAP.forEach(function (branch) {
    var branchEl = document.createElement("div");
    branchEl.className = "conceptmap-branch";

    var branchBtn = document.createElement("button");
    branchBtn.type = "button";
    branchBtn.className = "conceptmap-branch-btn";
    branchBtn.innerHTML = '<i class="fa-solid ' + branch.icon + '"></i> <span>' + branch.label + "</span>";
    branchBtn.addEventListener("click", function () {
      showDetail(resolveNode(branch), branchBtn);
      markBranchVisited(branch.key);
    });
    branchEl.appendChild(branchBtn);

    var childrenWrap = document.createElement("div");
    childrenWrap.className = "conceptmap-children";

    branch.children.forEach(function (child) {
      var childBtn = document.createElement("button");
      childBtn.type = "button";
      childBtn.className = "conceptmap-node-btn";
      childBtn.textContent = child.label;
      childBtn.addEventListener("click", function () {
        showDetail(resolveNode(child), childBtn);
        markBranchVisited(branch.key);
      });
      childrenWrap.appendChild(childBtn);
    });

    branchEl.appendChild(childrenWrap);
    branchesWrap.appendChild(branchEl);
  });

  tree.appendChild(branchesWrap);
}
