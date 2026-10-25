/* ================================================================
   Smart Budget Planner — script.js
   Struktur:
     1. State & Konstanta
     2. Utilitas (format, localStorage)
     3. Pemasukan & Anggaran
     4. Kategori & Pengeluaran
     5. Wishlist / Target Keinginan
     6. Ringkasan & Grafik
     7. Modal
     8. Event Listeners
     9. Inisialisasi
   ================================================================ */

/* ================================================================
   1. STATE & KONSTANTA
   ================================================================ */

/** State utama aplikasi, satu objek tunggal yang disimpan ke localStorage */
let state = {
  pemasukan: 0,
  metode: '503020',         // '503020' atau 'custom'
  persen: { kebutuhan: 50, keinginan: 30, tabungan: 20 },
  anggaran: { kebutuhan: 0, keinginan: 0, tabungan: 0 },
  kategori: [],             // [{ id, nama, kelompok, pengeluaran }]
  wishlist: [],             // [{ id, nama, harga, bulan, terkumpul }]
};

const STORAGE_KEY = 'smartBudgetPlanner_v1';

// Referensi chart agar bisa diperbarui tanpa membuat instance baru
let chartPie = null;
let chartBar = null;

// ID target wishlist yang sedang dibuka modal tabungannya
let activeWishlistId = null;


/* ================================================================
   2. UTILITAS
   ================================================================ */

/**
 * Format angka ke Rupiah tanpa desimal.
 * Contoh: 2000000 → "Rp 2.000.000"
 */
function formatRupiah(angka) {
  const num = Math.round(Number(angka) || 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Bersihkan input teks berformat ribuan menjadi angka murni.
 * Contoh: "2.000.000" → 2000000
 */
function parseRupiah(str) {
  return parseInt(String(str).replace(/\./g, ''), 10) || 0;
}

/**
 * Format angka input secara otomatis dengan titik ribuan saat mengetik.
 * Dipasang sebagai event listener 'input' pada elemen input teks.
 */
function handleInputRupiah(e) {
  const raw = e.target.value.replace(/\D/g, '');
  if (raw === '') { e.target.value = ''; return; }
  e.target.value = parseInt(raw, 10).toLocaleString('id-ID');
}

/** Simpan state ke localStorage */
function simpanState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Muat state dari localStorage; gunakan default jika belum ada */
function muatState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) state = JSON.parse(data);
  } catch (e) {
    console.warn('Gagal memuat data tersimpan:', e);
  }
}

/** Hasilkan ID unik sederhana */
function buatId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Hitung jumlah hari tersisa di bulan ini (termasuk hari ini).
 */
function hariTersisaBulanIni() {
  const sekarang = new Date();
  const akhirBulan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0);
  return akhirBulan.getDate() - sekarang.getDate() + 1;
}

/** Tampilkan atau sembunyikan elemen */
function tampilkan(el, tampil) {
  if (tampil) el.classList.remove('hidden');
  else el.classList.add('hidden');
}


/* ================================================================
   3. PEMASUKAN & PEMBAGIAN ANGGARAN
   ================================================================ */

/** Sinkronisasi UI input ke state.pemasukan & state.metode */
function bacaInputAnggaran() {
  state.pemasukan = parseRupiah(document.getElementById('inputPemasukan').value);
  state.metode = document.querySelector('input[name="metode"]:checked').value;

  if (state.metode === 'custom') {
    state.persen.kebutuhan = parseFloat(document.getElementById('pKebutuhan').value) || 0;
    state.persen.keinginan = parseFloat(document.getElementById('pKeinginan').value) || 0;
    state.persen.tabungan  = parseFloat(document.getElementById('pTabungan').value)  || 0;
  } else {
    state.persen = { kebutuhan: 50, keinginan: 30, tabungan: 20 };
  }
}

/** Validasi input anggaran; kembalikan pesan error atau null jika valid */
function validasiAnggaran() {
  if (!state.pemasukan || state.pemasukan <= 0) return 'Pemasukan tidak boleh kosong atau nol.';
  if (state.metode === 'custom') {
    const total = state.persen.kebutuhan + state.persen.keinginan + state.persen.tabungan;
    if (Math.abs(total - 100) > 0.01) return 'Total persentase harus tepat 100%.';
  }
  return null;
}

/** Hitung anggaran per kelompok berdasarkan pemasukan dan persentase */
function hitungAnggaran() {
  state.anggaran.kebutuhan = Math.round(state.pemasukan * state.persen.kebutuhan / 100);
  state.anggaran.keinginan = Math.round(state.pemasukan * state.persen.keinginan / 100);
  state.anggaran.tabungan  = Math.round(state.pemasukan * state.persen.tabungan  / 100);
}

/** Render kartu hasil pembagian anggaran */
function renderHasilAnggaran() {
  const kelompok = ['kebutuhan', 'keinginan', 'tabungan'];
  const label    = { kebutuhan: 'Kebutuhan', keinginan: 'Keinginan', tabungan: 'Tabungan' };
  const emoji    = { kebutuhan: '🏠', keinginan: '🛍️', tabungan: '💰' };

  const kontainer = document.getElementById('kartuAnggaran');
  kontainer.innerHTML = '';

  kelompok.forEach(k => {
    const div = document.createElement('div');
    div.className = `anggaran-card ${k}`;
    div.innerHTML = `
      <p class="label text-2xl mb-1">${emoji[k]}</p>
      <p class="label font-semibold text-sm">${label[k]}</p>
      <p class="value font-bold text-xl mt-1">${formatRupiah(state.anggaran[k])}</p>
      <p class="label text-xs mt-0.5">${state.persen[k]}% dari pemasukan</p>
    `;
    kontainer.appendChild(div);
  });

  tampilkan(document.getElementById('hasilAnggaran'), true);
}

/** Handle klik tombol "Hitung Anggaran" */
function handleHitungAnggaran() {
  bacaInputAnggaran();

  const errPemasukan = document.getElementById('errorPemasukan');
  const errPersen    = document.getElementById('errorPersen');
  tampilkan(errPemasukan, false);
  tampilkan(errPersen, false);

  const pesan = validasiAnggaran();
  if (pesan) {
    if (pesan.includes('Pemasukan')) tampilkan(errPemasukan, true);
    else tampilkan(errPersen, true);
    return;
  }

  hitungAnggaran();
  renderHasilAnggaran();
  renderDaftarKategori();   // perbarui indikator warna kelompok
  renderWishlist();         // perbarui status "Terjangkau / Melebihi jatah"
  renderRingkasan();
  simpanState();
}

/** Tampilkan/sembunyikan kotak input custom persentase */
function toggleCustomPersen() {
  const isCustom = document.querySelector('input[name="metode"]:checked').value === 'custom';
  tampilkan(document.getElementById('customPersenBox'), isCustom);
}

/** Update tampilan total persentase secara live */
function updateTotalPersen() {
  const k = parseFloat(document.getElementById('pKebutuhan').value) || 0;
  const i = parseFloat(document.getElementById('pKeinginan').value) || 0;
  const t = parseFloat(document.getElementById('pTabungan').value)  || 0;
  const total = k + i + t;
  document.getElementById('spanTotalPersen').textContent = total;
  document.getElementById('spanTotalPersen').className =
    Math.abs(total - 100) < 0.01 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold';
}


/* ================================================================
   4. KATEGORI & PENGELUARAN
   ================================================================ */

/** Tambah kategori baru ke state */
function tambahKategori() {
  const nama       = document.getElementById('inputNamaKategori').value.trim();
  const kelompok   = document.getElementById('selectKelompok').value;
  const pengeluaran = parseRupiah(document.getElementById('inputPengeluaran').value);
  const errEl      = document.getElementById('errorKategori');

  tampilkan(errEl, false);

  if (!nama || pengeluaran <= 0) {
    tampilkan(errEl, true);
    return;
  }

  state.kategori.push({ id: buatId(), nama, kelompok, pengeluaran });

  // Kosongkan input
  document.getElementById('inputNamaKategori').value = '';
  document.getElementById('inputPengeluaran').value  = '';

  renderDaftarKategori();
  renderRingkasan();
  simpanState();
}

/** Edit nama dan pengeluaran kategori yang ada */
function editKategori(id) {
  const item = state.kategori.find(k => k.id === id);
  if (!item) return;

  const namaBaru   = prompt('Nama kategori baru:', item.nama);
  if (namaBaru === null) return;  // batal
  const pengeluaranBaru = prompt('Pengeluaran baru (angka tanpa titik):', item.pengeluaran);
  if (pengeluaranBaru === null) return;

  const angka = parseInt(pengeluaranBaru, 10);
  if (!namaBaru.trim()) { alert('Nama tidak boleh kosong.'); return; }
  if (isNaN(angka) || angka < 0) { alert('Pengeluaran harus angka positif.'); return; }

  item.nama        = namaBaru.trim();
  item.pengeluaran = angka;

  renderDaftarKategori();
  renderRingkasan();
  simpanState();
}

/** Hapus kategori */
function hapusKategori(id) {
  if (!confirm('Hapus kategori ini?')) return;
  state.kategori = state.kategori.filter(k => k.id !== id);
  renderDaftarKategori();
  renderRingkasan();
  simpanState();
}

/**
 * Hitung total pengeluaran per kelompok dari state.kategori.
 * Kembalikan objek { kebutuhan, keinginan, tabungan }
 */
function totalPengeluaranPerKelompok() {
  return state.kategori.reduce((acc, k) => {
    acc[k.kelompok] = (acc[k.kelompok] || 0) + k.pengeluaran;
    return acc;
  }, { kebutuhan: 0, keinginan: 0, tabungan: 0 });
}

/**
 * Tentukan warna indikator berdasarkan rasio pengeluaran/anggaran.
 * < 80%: hijau | 80-100%: kuning | > 100%: merah
 */
function warnaIndikator(pengeluaran, anggaran) {
  if (!anggaran) return 'gray';
  const rasio = pengeluaran / anggaran;
  if (rasio <= 0.8)  return 'green';
  if (rasio <= 1.0)  return 'yellow';
  return 'red';
}

/** Render seluruh daftar kategori dikelompokkan per kelompok */
function renderDaftarKategori() {
  const kontainer = document.getElementById('daftarKategori');
  kontainer.innerHTML = '';

  const kelompokList = ['kebutuhan', 'keinginan', 'tabungan'];
  const labelMap     = { kebutuhan: '🏠 Kebutuhan', keinginan: '🛍️ Keinginan', tabungan: '💰 Tabungan' };
  const totalPengeluaran = totalPengeluaranPerKelompok();

  kelompokList.forEach(klp => {
    const items = state.kategori.filter(k => k.kelompok === klp);

    const wrapper = document.createElement('div');
    wrapper.className = 'rounded-lg border border-gray-200 overflow-hidden mb-2';

    // Header kelompok dengan indikator warna
    const warna   = warnaIndikator(totalPengeluaran[klp], state.anggaran[klp]);
    const dotHtml = `<span class="dot dot-${warna}"></span>`;
    const sisaKlp = state.anggaran[klp] - totalPengeluaran[klp];
    const sisaTeks = state.anggaran[klp]
      ? `Sisa: ${formatRupiah(sisaKlp)} | ${formatRupiah(totalPengeluaran[klp])} / ${formatRupiah(state.anggaran[klp])}`
      : 'Hitung anggaran terlebih dahulu';

    wrapper.innerHTML = `
      <div class="kelompok-header ${klp}">
        <span>${dotHtml}${labelMap[klp]}</span>
        <span class="font-normal text-xs opacity-80">${sisaTeks}</span>
      </div>
    `;

    if (items.length === 0) {
      const kosong = document.createElement('div');
      kosong.className = 'px-4 py-3 text-sm text-gray-400 bg-white border-x border-b border-gray-200 rounded-b-lg';
      kosong.textContent = 'Belum ada kategori.';
      wrapper.appendChild(kosong);
    } else {
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'kategori-item';
        row.innerHTML = `
          <span class="font-medium text-gray-700">${item.nama}</span>
          <div class="flex items-center gap-3">
            <span class="text-gray-600">${formatRupiah(item.pengeluaran)}</span>
            <button onclick="editKategori('${item.id}')" class="btn-sm bg-blue-50 hover:bg-blue-100 text-blue-600">Edit</button>
            <button onclick="hapusKategori('${item.id}')" class="btn-sm bg-red-50 hover:bg-red-100 text-red-500">Hapus</button>
          </div>
        `;
        wrapper.appendChild(row);
      });
    }

    kontainer.appendChild(wrapper);
  });
}


/* ================================================================
   5. WISHLIST / TARGET KEINGINAN
   ================================================================ */

/** Tambah target wishlist baru */
function tambahWishlist() {
  const nama      = document.getElementById('wNama').value.trim();
  const harga     = parseRupiah(document.getElementById('wHarga').value);
  const bulan     = parseInt(document.getElementById('wBulan').value, 10);
  const terkumpul = parseRupiah(document.getElementById('wTerkumpul').value);
  const errEl     = document.getElementById('errorWishlist');

  tampilkan(errEl, false);

  if (!nama || harga <= 0 || isNaN(bulan) || bulan < 1) {
    tampilkan(errEl, true);
    return;
  }

  state.wishlist.push({
    id: buatId(),
    nama,
    harga,
    bulan,
    terkumpul: terkumpul < 0 ? 0 : terkumpul,
  });

  // Kosongkan input
  ['wNama', 'wHarga', 'wBulan', 'wTerkumpul'].forEach(id => {
    document.getElementById(id).value = '';
  });

  renderWishlist();
  simpanState();
}

/** Edit target wishlist */
function editWishlist(id) {
  const item = state.wishlist.find(w => w.id === id);
  if (!item) return;

  const namaBaru  = prompt('Nama barang:', item.nama);
  if (namaBaru === null) return;
  const hargaBaru = prompt('Harga target (angka):', item.harga);
  if (hargaBaru === null) return;
  const bulanBaru = prompt('Jangka waktu (bulan, min 1):', item.bulan);
  if (bulanBaru === null) return;

  const hargaNum = parseInt(hargaBaru, 10);
  const bulanNum = parseInt(bulanBaru, 10);

  if (!namaBaru.trim()) { alert('Nama tidak boleh kosong.'); return; }
  if (isNaN(hargaNum) || hargaNum <= 0) { alert('Harga harus lebih dari 0.'); return; }
  if (isNaN(bulanNum) || bulanNum < 1)  { alert('Jangka waktu minimal 1 bulan.'); return; }

  item.nama  = namaBaru.trim();
  item.harga = hargaNum;
  item.bulan = bulanNum;

  renderWishlist();
  simpanState();
}

/** Hapus target wishlist */
function hapusWishlist(id) {
  if (!confirm('Hapus target ini?')) return;
  state.wishlist = state.wishlist.filter(w => w.id !== id);
  renderWishlist();
  simpanState();
}

/** Buka modal tambah tabungan untuk target tertentu */
function bukaModalTabungan(id) {
  const item = state.wishlist.find(w => w.id === id);
  if (!item) return;
  activeWishlistId = id;
  document.getElementById('modalTabunganNama').textContent = `Target: ${item.nama}`;
  document.getElementById('inputSetoran').value = '';
  tampilkan(document.getElementById('errorSetoran'), false);
  tampilkan(document.getElementById('modalTabungan'), true);
}

/** Simpan setoran ke target wishlist aktif */
function simpanTabungan() {
  const setoran = parseRupiah(document.getElementById('inputSetoran').value);
  const errEl   = document.getElementById('errorSetoran');
  tampilkan(errEl, false);

  if (!setoran || setoran <= 0) {
    tampilkan(errEl, true);
    return;
  }

  const item = state.wishlist.find(w => w.id === activeWishlistId);
  if (item) {
    item.terkumpul += setoran;
    if (item.terkumpul > item.harga) item.terkumpul = item.harga; // tidak melebihi harga
  }

  tutupModalTabungan();
  renderWishlist();
  simpanState();
}

/** Tutup modal tambah tabungan */
function tutupModalTabungan() {
  activeWishlistId = null;
  tampilkan(document.getElementById('modalTabungan'), false);
}

/**
 * Hitung sisa jatah kelompok keinginan + tabungan setelah pengeluaran.
 * Digunakan untuk menilai kelayakan target wishlist.
 */
function sisaJatahWishlist() {
  const totalPengeluaran = totalPengeluaranPerKelompok();
  const sisaKeinginan = Math.max(0, state.anggaran.keinginan - totalPengeluaran.keinginan);
  const sisaTabungan  = Math.max(0, state.anggaran.tabungan  - totalPengeluaran.tabungan);
  return sisaKeinginan + sisaTabungan;
}

/**
 * Hitung jangka waktu minimal realistis agar target terjangkau.
 * Kembalikan jumlah bulan.
 */
function jangkaWaktuMinimal(harga, terkumpul, sisaPerBulan) {
  if (sisaPerBulan <= 0) return null;
  return Math.ceil((harga - terkumpul) / sisaPerBulan);
}

/** Render seluruh daftar wishlist */
function renderWishlist() {
  const kontainer = document.getElementById('daftarWishlist');
  kontainer.innerHTML = '';

  if (state.wishlist.length === 0) {
    kontainer.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Belum ada target keinginan.</p>';
    return;
  }

  const sisa = sisaJatahWishlist();

  state.wishlist.forEach(item => {
    const sisaHarga    = Math.max(0, item.harga - item.terkumpul);
    const perBulan     = item.bulan > 0 ? Math.ceil(sisaHarga / item.bulan) : 0;
    const progPersen   = Math.min(100, Math.round((item.terkumpul / item.harga) * 100));
    const tercapai     = item.terkumpul >= item.harga;

    // Status terjangkau / melebihi jatah
    let statusHtml = '';
    if (tercapai) {
      statusHtml = `<span class="badge badge-green">✅ Tercapai!</span>`;
    } else if (!state.anggaran.keinginan && !state.anggaran.tabungan) {
      statusHtml = `<span class="badge badge-gray">Hitung anggaran dulu</span>`;
    } else if (perBulan <= sisa) {
      statusHtml = `<span class="badge badge-green">✔ Terjangkau</span>`;
    } else {
      // Sarankan jangka waktu minimal
      const minimal = jangkaWaktuMinimal(item.harga, item.terkumpul, sisa);
      const saranTeks = minimal
        ? `Minimal ${minimal} bulan`
        : 'Tidak cukup sisa anggaran';
      statusHtml = `<span class="badge badge-red">⚠ Melebihi jatah</span>
                    <span class="badge badge-yellow ml-1">Saran: ${saranTeks}</span>`;
    }

    // Warna progress bar
    let progClass = 'progress-fill-green';
    if (progPersen < 50)       progClass = 'progress-fill-yellow';
    if (progPersen >= 100)     progClass = 'progress-fill-green';

    const card = document.createElement('div');
    card.className = `wishlist-card${tercapai ? ' tercapai' : ''}`;
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p class="font-semibold text-gray-800">${item.nama}${tercapai ? ' 🎉' : ''}</p>
          <p class="text-xs text-gray-500 mt-0.5">
            Target: ${formatRupiah(item.harga)} &bull; Jangka: ${item.bulan} bulan
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          ${statusHtml}
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mt-3">
        <div class="flex justify-between text-xs text-gray-500 mb-1">
          <span>Terkumpul: ${formatRupiah(item.terkumpul)}</span>
          <span>${progPersen}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${progClass}" style="width:${progPersen}%"></div>
        </div>
      </div>

      <!-- Info tabungan per bulan -->
      ${!tercapai ? `
      <div class="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
        Perlu menabung <strong>${formatRupiah(perBulan)}/bulan</strong>
        &bull; Sisa jatah Keinginan+Tabungan: <strong>${formatRupiah(sisa)}</strong>
      </div>` : ''}

      <!-- Tombol aksi -->
      <div class="flex gap-2 mt-3 flex-wrap">
        ${!tercapai ? `<button onclick="bukaModalTabungan('${item.id}')" class="btn-sm bg-green-50 hover:bg-green-100 text-green-700">+ Tambah Tabungan</button>` : ''}
        <button onclick="editWishlist('${item.id}')" class="btn-sm bg-blue-50 hover:bg-blue-100 text-blue-600">Edit</button>
        <button onclick="hapusWishlist('${item.id}')" class="btn-sm bg-red-50 hover:bg-red-100 text-red-500">Hapus</button>
      </div>
    `;

    kontainer.appendChild(card);
  });
}


/* ================================================================
   6. RINGKASAN & GRAFIK
   ================================================================ */

/** Render kartu sisa uang dan perkiraan per hari */
function renderRingkasan() {
  const totalPengeluaran = totalPengeluaranPerKelompok();
  const totalKeluar = totalPengeluaran.kebutuhan + totalPengeluaran.keinginan + totalPengeluaran.tabungan;
  const sisa = state.pemasukan - totalKeluar;
  const hari = hariTersisaBulanIni();
  const sisaPerHari = hari > 0 ? Math.floor(sisa / hari) : 0;

  document.getElementById('sisaUang').textContent    = formatRupiah(sisa);
  document.getElementById('sisaPerHari').textContent = formatRupiah(sisaPerHari);
  document.getElementById('hariTersisa').textContent = `${hari} hari tersisa di bulan ini`;

  // Warna teks sisa uang
  const sisaEl = document.getElementById('sisaUang');
  sisaEl.className = `text-2xl font-bold mt-1 ${sisa >= 0 ? 'text-blue-800' : 'text-red-600'}`;

  renderGrafik();
}

/** Render grafik lingkaran (pie) dan batang (bar) menggunakan Chart.js */
function renderGrafik() {
  renderGrafikPie();
  renderGrafikBar();
}

/** Grafik lingkaran — pembagian anggaran */
function renderGrafikPie() {
  const ctx = document.getElementById('chartPie').getContext('2d');

  const data = [state.anggaran.kebutuhan, state.anggaran.keinginan, state.anggaran.tabungan];
  const total = data.reduce((a, b) => a + b, 0);

  // Jangan render jika belum ada data
  if (!total) {
    if (chartPie) { chartPie.destroy(); chartPie = null; }
    return;
  }

  const config = {
    type: 'pie',
    data: {
      labels: ['Kebutuhan', 'Keinginan', 'Tabungan'],
      datasets: [{
        data,
        backgroundColor: ['#3b82f6', '#a855f7', '#22c55e'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.parsed)}`,
          },
        },
      },
    },
  };

  if (chartPie) {
    chartPie.data = config.data;
    chartPie.update();
  } else {
    chartPie = new Chart(ctx, config);
  }
}

/** Grafik batang — rencana vs realisasi per kelompok */
function renderGrafikBar() {
  const ctx = document.getElementById('chartBar').getContext('2d');
  const totalPengeluaran = totalPengeluaranPerKelompok();

  const rencana   = [state.anggaran.kebutuhan, state.anggaran.keinginan, state.anggaran.tabungan];
  const realisasi = [totalPengeluaran.kebutuhan, totalPengeluaran.keinginan, totalPengeluaran.tabungan];

  const config = {
    type: 'bar',
    data: {
      labels: ['Kebutuhan', 'Keinginan', 'Tabungan'],
      datasets: [
        {
          label: 'Anggaran',
          data: rencana,
          backgroundColor: 'rgba(59,130,246,0.7)',
          borderRadius: 6,
        },
        {
          label: 'Pengeluaran',
          data: realisasi,
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => 'Rp ' + (v >= 1_000_000
              ? (v / 1_000_000).toFixed(1) + 'jt'
              : (v / 1_000).toFixed(0) + 'rb'),
          },
        },
      },
    },
  };

  if (chartBar) {
    chartBar.data = config.data;
    chartBar.update();
  } else {
    chartBar = new Chart(ctx, config);
  }
}


/* ================================================================
   7. MODAL
   ================================================================ */

/** Tampilkan modal konfirmasi reset */
function bukaModalReset() {
  tampilkan(document.getElementById('modalReset'), true);
}

/** Tutup modal konfirmasi reset */
function tutupModalReset() {
  tampilkan(document.getElementById('modalReset'), false);
}

/** Reset semua data ke nilai awal */
function resetSemua() {
  state = {
    pemasukan: 0,
    metode: '503020',
    persen: { kebutuhan: 50, keinginan: 30, tabungan: 20 },
    anggaran: { kebutuhan: 0, keinginan: 0, tabungan: 0 },
    kategori: [],
    wishlist: [],
  };
  localStorage.removeItem(STORAGE_KEY);
  tutupModalReset();
  inisialisasiUI();
}


/* ================================================================
   8. SINKRONISASI UI ← STATE (mengisi form dari state tersimpan)
   ================================================================ */

/** Isi semua form dan tampilan dari state yang dimuat (setelah refresh) */
function sinkronUIKeState() {
  // Pemasukan
  if (state.pemasukan > 0) {
    document.getElementById('inputPemasukan').value =
      state.pemasukan.toLocaleString('id-ID');
  }

  // Metode
  const radioMetode = document.querySelector(`input[name="metode"][value="${state.metode}"]`);
  if (radioMetode) radioMetode.checked = true;
  toggleCustomPersen();

  // Custom persen
  if (state.metode === 'custom') {
    document.getElementById('pKebutuhan').value = state.persen.kebutuhan;
    document.getElementById('pKeinginan').value = state.persen.keinginan;
    document.getElementById('pTabungan').value  = state.persen.tabungan;
    updateTotalPersen();
  }

  // Tampilkan hasil anggaran jika sudah ada
  if (state.anggaran.kebutuhan || state.anggaran.keinginan || state.anggaran.tabungan) {
    renderHasilAnggaran();
  }

  renderDaftarKategori();
  renderWishlist();
  renderRingkasan();
}


/* ================================================================
   9. EVENT LISTENERS & INISIALISASI
   ================================================================ */

/** Pasang semua event listener */
function pasangEventListener() {

  // --- Rupiah auto-format ---
  ['inputPemasukan', 'inputPengeluaran', 'wHarga', 'wTerkumpul', 'inputSetoran'].forEach(id => {
    document.getElementById(id).addEventListener('input', handleInputRupiah);
  });

  // --- Anggaran ---
  document.getElementById('btnHitungAnggaran').addEventListener('click', handleHitungAnggaran);

  document.querySelectorAll('input[name="metode"]').forEach(radio => {
    radio.addEventListener('change', toggleCustomPersen);
  });

  ['pKebutuhan', 'pKeinginan', 'pTabungan'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateTotalPersen);
  });

  // --- Kategori ---
  document.getElementById('btnTambahKategori').addEventListener('click', tambahKategori);

  // Enter di input kategori
  ['inputNamaKategori', 'inputPengeluaran'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') tambahKategori();
    });
  });

  // --- Wishlist ---
  document.getElementById('btnTambahWishlist').addEventListener('click', tambahWishlist);

  // --- Modal reset ---
  document.getElementById('btnReset').addEventListener('click', bukaModalReset);
  document.getElementById('btnBatalReset').addEventListener('click', tutupModalReset);
  document.getElementById('btnKonfirmasiReset').addEventListener('click', resetSemua);

  // Klik di luar modal-box juga menutup modal
  document.getElementById('modalReset').addEventListener('click', e => {
    if (e.target === document.getElementById('modalReset')) tutupModalReset();
  });

  // --- Modal tabungan ---
  document.getElementById('btnBatalTabungan').addEventListener('click', tutupModalTabungan);
  document.getElementById('btnSimpanTabungan').addEventListener('click', simpanTabungan);

  document.getElementById('modalTabungan').addEventListener('click', e => {
    if (e.target === document.getElementById('modalTabungan')) tutupModalTabungan();
  });
}

/**
 * Inisialisasi penuh — dipanggil saat halaman dimuat pertama kali
 * dan setelah reset.
 */
function inisialisasiUI() {
  // Kosongkan semua form input
  document.getElementById('inputPemasukan').value    = '';
  document.getElementById('inputNamaKategori').value = '';
  document.getElementById('inputPengeluaran').value  = '';
  ['wNama', 'wHarga', 'wBulan', 'wTerkumpul'].forEach(id => {
    document.getElementById(id).value = '';
  });

  // Reset radio ke 50/30/20
  document.querySelector('input[name="metode"][value="503020"]').checked = true;
  toggleCustomPersen();

  // Sembunyikan hasil anggaran
  tampilkan(document.getElementById('hasilAnggaran'), false);

  // Hancurkan grafik lama agar tidak konflik setelah reset
  if (chartPie) { chartPie.destroy(); chartPie = null; }
  if (chartBar) { chartBar.destroy(); chartBar = null; }

  // Render ulang semua section dari state
  sinkronUIKeState();
}

/* ---- Titik masuk utama ---- */
document.addEventListener('DOMContentLoaded', () => {
  muatState();           // muat data tersimpan
  pasangEventListener(); // pasang semua listener
  inisialisasiUI();      // render UI awal
});
