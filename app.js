import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- إعدادات مشروعك في Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyABI1Q92r_gzgTSd_7nTUz602aX6MafGzw",
    authDomain: "ecommerce-92c76.firebaseapp.com",
    projectId: "ecommerce-92c76",
    storageBucket: "ecommerce-92c76.firebasestorage.app",
    messagingSenderId: "650078282327",
    appId: "1:650078282327:web:e5b9b6c76e174eba0d7912",
    measurementId: "G-CY6B8SJZQY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- XSS Protection ---
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

// --- State Variables ---
let currentUser = null;
let currentLang = 'fr';
let productsData = [];
let vendorProducts = [];
let cart = JSON.parse(localStorage.getItem('luxe_cart')) || [];
let favorites = JSON.parse(localStorage.getItem('luxe_favs')) || [];
let isSignupMode = false;

// --- Toasts System ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-white/90 dark:bg-black/90' : 'bg-red-500/90 text-white';
    const textColor = type === 'success' ? 'text-apple-text dark:text-white' : 'text-white';
    const border = type === 'success' ? 'border border-gray-200/50 dark:border-gray-700/50' : 'border border-red-600/50';

    toast.className = `toast-enter glass ${bgColor} ${textColor} ${border} px-6 py-3 rounded-full shadow-lg font-medium text-sm backdrop-blur-xl flex items-center gap-2`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-leave');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// --- Translations ---
const translations = {
    fr: {
        brand: "Luxe Market", login: "Connexion", dashboard: "Vendre", logout: "Déconnexion",
        hero_title: "Lancez votre e-commerce aujourd'hui", hero_subtitle: "Aucune expérience technique requise. Ouvrez votre boutique gratuitement.",
        start_selling: "Commencer à vendre", browse_products: "Explorer", latest_products: "Derniers Produits",
        publish: "Publier", cat_all: "Tout", cat_elec: "Électronique", cat_fash: "Mode",
        search_placeholder: "Rechercher...", cart_title: "Mon Panier", total: "Total:", checkout: "Payer",
        add_to_cart: "Ajouter", empty_cart: "Panier vide", auth_welcome: "Bienvenue", signup_link: "Créer un compte",
        login_link: "Se connecter", or: "Ou", google_login: "Continuer avec Google",
        login_success: "Connexion réussie !", logout_success: "Déconnexion réussie.",
        auth_error: "Erreur d'authentification", fav_added: "Ajouté aux favoris ❤️", fav_removed: "Retiré des favoris 💔",
        success_upload: "Produit publié !", error_file: "Image trop grande (Max 2MB)", success_delete: "Produit supprimé.",
        dashboard_title: "Espace Vendeur", tab_overview: "Aperçu", tab_add: "Ajouter", tab_my_products: "Mes Produits",
        stat_total_products: "Total Produits", stat_total_value: "Valeur Totale",
        col_image: "Image", col_title: "Titre", col_price: "Prix", col_action: "Action", no_products: "Aucun produit trouvé.",
        uploading: "Téléchargement en cours...", img_error: "Erreur de téléchargement d'image"
    },
    ar: {
        brand: "سوق فاخر", login: "دخول", dashboard: "لوحة البائع", logout: "خروج",
        hero_title: "ابدأ رحلتك في التجارة الإلكترونية اليوم", hero_subtitle: "لا تحتاج إلى خبرة تقنية. افتح متجرك الخاص مجاناً.",
        start_selling: "ابدأ البيع", browse_products: "تصفح المنتجات", latest_products: "أحدث المنتجات",
        publish: "نشر الآن", cat_all: "الكل", cat_elec: "إلكترونيات", cat_fash: "موضة",
        search_placeholder: "بحث...", cart_title: "سلة المشتريات", total: "المجموع:", checkout: "إتمام الشراء",
        add_to_cart: "أضف للسلة", empty_cart: "السلة فارغة", auth_welcome: "مرحباً بك", signup_link: "سجل الآن",
        login_link: "تسجيل الدخول", or: "أو", google_login: "المتابعة مع Google",
        login_success: "تم تسجيل الدخول بنجاح!", logout_success: "تم تسجيل الخروج.",
        auth_error: "خطأ في التسجيل", fav_added: "أضيف للمفضلة ❤️", fav_removed: "أزيل من المفضلة 💔",
        success_upload: "تم نشر المنتج!", error_file: "الصورة كبيرة جداً", success_delete: "تم الحذف بنجاح.",
        dashboard_title: "لوحة تحكم البائع", tab_overview: "نظرة عامة", tab_add: "إضافة منتج", tab_my_products: "منتجاتي",
        stat_total_products: "إجمالي المنتجات", stat_total_value: "القيمة الإجمالية",
        col_image: "صورة", col_title: "العنوان", col_price: "السعر", col_action: "إجراء", no_products: "لا توجد منتجات بعد.",
        uploading: "جاري الرفع...", img_error: "خطأ في رفع الصورة"
    }
};

function updateLanguage() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('lang-toggle').innerText = currentLang === 'fr' ? 'عربي' : 'Français';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) el.innerText = translations[currentLang][key];
    });
    document.getElementById('search-input').placeholder = translations[currentLang].search_placeholder;
    renderProducts(productsData);
    if(currentUser) renderVendorDashboard();
    updateCartUI();
}

document.getElementById('lang-toggle').addEventListener('click', () => { currentLang = currentLang === 'fr' ? 'ar' : 'fr'; updateLanguage(); });
document.getElementById('logo-btn').addEventListener('click', () => {
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('marketplace-section').classList.remove('hidden');
    if(!currentUser) document.getElementById('hero-section').classList.remove('hidden');
});

// --- Theme ---
if(localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
});

// --- Auth ---
const authModal = document.getElementById('auth-modal');
const heroSection = document.getElementById('hero-section');
const dashboardSection = document.getElementById('dashboard-section');
const marketplaceSection = document.getElementById('marketplace-section');

onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) {
        document.getElementById('user-menu').classList.remove('hidden');
        document.getElementById('auth-buttons').classList.add('hidden');
        if(heroSection) heroSection.classList.add('hidden');
        renderVendorDashboard();
    } else {
        document.getElementById('user-menu').classList.add('hidden');
        document.getElementById('auth-buttons').classList.remove('hidden');
        if(heroSection) heroSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        marketplaceSection.classList.remove('hidden');
    }
});

function openAuthModal(signup = false) {
    isSignupMode = signup;
    document.getElementById('auth-title').innerText = isSignupMode ? translations[currentLang].signup_link : translations[currentLang].auth_welcome;
    document.getElementById('btn-auth-action').innerText = isSignupMode ? translations[currentLang].signup_link : translations[currentLang].login;
    document.getElementById('toggle-auth-mode').innerText = isSignupMode ? translations[currentLang].login_link : translations[currentLang].signup_link;
    authModal.classList.replace('hidden', 'flex');
}

document.getElementById('btn-start-selling').addEventListener('click', () => openAuthModal(true));
document.getElementById('btn-browse').addEventListener('click', () => marketplaceSection.scrollIntoView({ behavior: 'smooth' }));
document.getElementById('btn-show-login').addEventListener('click', () => openAuthModal(false));
document.getElementById('close-modal').addEventListener('click', () => authModal.classList.replace('flex', 'hidden'));
document.getElementById('toggle-auth-mode').addEventListener('click', () => openAuthModal(!isSignupMode));

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        if (isSignupMode) await createUserWithEmailAndPassword(auth, document.getElementById('auth-email').value, document.getElementById('auth-password').value);
        else await signInWithEmailAndPassword(auth, document.getElementById('auth-email').value, document.getElementById('auth-password').value);
        authModal.classList.replace('flex', 'hidden');
        showToast(translations[currentLang].login_success);
    } catch (err) { showToast(translations[currentLang].auth_error, 'error'); }
});

document.getElementById('btn-google-auth').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        authModal.classList.replace('flex', 'hidden');
        showToast(translations[currentLang].login_success);
    } catch (err) { showToast(translations[currentLang].auth_error, 'error'); }
});

document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth); showToast(translations[currentLang].logout_success); });
document.getElementById('btn-show-dashboard').addEventListener('click', () => {
    dashboardSection.classList.remove('hidden');
    marketplaceSection.classList.add('hidden');
});

// --- Dashboard Tabs Logic ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active', 'bg-white', 'dark:bg-[#1c1c1e]', 'shadow-sm');
            b.classList.add('text-apple-muted');
        });
        e.target.classList.add('active', 'bg-white', 'dark:bg-[#1c1c1e]', 'shadow-sm');
        e.target.classList.remove('text-apple-muted');
        
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
    });
});

function renderVendorDashboard() {
    if (!currentUser) return;
    vendorProducts = productsData.filter(p => p.vendorId === currentUser.uid);
    
    const totalValue = vendorProducts.reduce((sum, p) => sum + p.price, 0);
    document.getElementById('stat-count').innerText = vendorProducts.length;
    document.getElementById('stat-value').innerText = `$${totalValue.toFixed(2)}`;
    
    const tbody = document.getElementById('vendor-products-list');
    const noProds = document.getElementById('no-vendor-products');
    
    if (vendorProducts.length === 0) {
        tbody.innerHTML = '';
        noProds.classList.remove('hidden');
    } else {
        noProds.classList.add('hidden');
        tbody.innerHTML = vendorProducts.map(p => `
            <tr class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-3"><img src="${p.imageUrl}" class="w-12 h-12 rounded-lg object-cover"></td>
                <td class="py-3 text-sm font-semibold truncate max-w-[100px] sm:max-w-xs">${p.title}</td>
                <td class="py-3 text-sm text-apple-blue font-bold">$${p.price.toFixed(2)}</td>
                <td class="py-3">
                    <button onclick="window.deleteProduct('${p.id}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition">🗑️</button>
                </td>
            </tr>
        `).join('');
    }
}

window.deleteProduct = async (id) => {
    if(!confirm("Êtes-vous sûr ? / هل أنت متأكد؟")) return;
    try {
        await deleteDoc(doc(db, "products", id));
        showToast(translations[currentLang].success_delete);
    } catch (error) { showToast("Erreur / خطأ", 'error'); }
};

// ==========================================
// --- PRODUCT UPLOAD (100% FREE VIA IMGBB) ---
// ==========================================
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const file = document.getElementById('prod-image').files[0];
    if (file.size > 2 * 1024 * 1024) return showToast(translations[currentLang].error_file, 'error');

    const btn = document.getElementById('btn-submit-product');
    btn.disabled = true; 
    btn.innerText = translations[currentLang].uploading;

    try {
        // ⚠️ هام جداً: ضع المفتاح الخاص بك هنا
        const imgbbApiKey = 'be52b14b12e7aecda0d13166c49fb66e'; 
        
        const formData = new FormData();
        formData.append('image', file);

        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
            method: 'POST',
            body: formData
        });
        
        const imgbbData = await imgbbResponse.json();
        
        if (!imgbbData.success) throw new Error(translations[currentLang].img_error);

        const imageUrl = imgbbData.data.url; 
        
        await addDoc(collection(db, "products"), {
            title: escapeHTML(document.getElementById('prod-title').value),
            price: Number(document.getElementById('prod-price').value),
            category: document.getElementById('prod-category').value,
            imageUrl: imageUrl, 
            vendorId: currentUser.uid,
            createdAt: serverTimestamp()
        });
        
        showToast(translations[currentLang].success_upload);
        document.getElementById('add-product-form').reset();
        document.querySelector('[data-target="tab-overview"]').click();
    } catch (err) { 
        showToast(err.message, 'error'); 
        console.error(err);
    } finally { 
        btn.disabled = false; 
        btn.innerText = translations[currentLang].publish; 
    }
});

// --- Feed & Search ---
let activeCategory = 'All';
onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
    productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    filterAndRender();
    if(currentUser) renderVendorDashboard();
});

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = products.map(p => {
        const catKey = p.category === 'Electronics' ? 'cat_elec' : 'cat_fash';
        const translatedCat = translations[currentLang][catKey] || p.category;
        const isFav = favorites.includes(p.id);
        
        return `
        <div class="glass rounded-3xl overflow-hidden hover:shadow-2xl transition duration-500 flex flex-col group border border-white/40 dark:border-gray-700/50">
            <div class="h-56 overflow-hidden relative bg-white/50">
                <img src="${p.imageUrl}" class="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-in-out">
                <button onclick="window.toggleFav('${p.id}')" class="heart-btn absolute top-3 left-3 rtl:left-auto rtl:right-3 p-2 bg-white/80 dark:bg-black/60 backdrop-blur-md rounded-full shadow-sm ${isFav ? 'heart-active' : ''}">
                    <svg class="w-5 h-5 transition-colors" fill="${isFav ? '#ff3b30' : 'none'}" stroke="${isFav ? '#ff3b30' : 'currentColor'}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                </button>
                <span class="absolute top-3 right-3 rtl:right-auto rtl:left-3 bg-white/80 dark:bg-black/60 backdrop-blur-md text-xs font-bold px-3 py-1.5 rounded-full shadow-sm dark:text-white">${translatedCat}</span>
            </div>
            <div class="p-5 flex flex-col flex-grow">
                <h3 class="font-bold text-lg mb-1 dark:text-white truncate">${p.title}</h3>
                <p class="text-apple-blue font-extrabold text-2xl mb-4">$${p.price.toFixed(2)}</p>
                <button onclick="window.addToCart('${p.id}')" class="mt-auto w-full bg-apple-bg dark:bg-white/10 text-apple-text dark:text-white py-2.5 rounded-xl font-bold hover:bg-apple-blue hover:text-white transition shadow-sm">${translations[currentLang].add_to_cart}</button>
            </div>
        </div>`;
    }).join('');
}

function filterAndRender() {
    const term = document.getElementById('search-input').value.toLowerCase();
    let filtered = productsData;
    if (activeCategory !== 'All') filtered = filtered.filter(p => p.category === activeCategory);
    if (term) filtered = filtered.filter(p => p.title.toLowerCase().includes(term));
    renderProducts(filtered);
}

document.getElementById('search-input').addEventListener('input', filterAndRender);
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('bg-apple-blue', 'text-white');
            b.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-800');
        });
        e.target.classList.add('bg-apple-blue', 'text-white');
        e.target.classList.remove('hover:bg-gray-100', 'dark:hover:bg-gray-800');
        activeCategory = e.target.dataset.category;
        filterAndRender();
    });
});

// --- Favorites ---
window.toggleFav = (id) => {
    const index = favorites.indexOf(id);
    if (index > -1) { favorites.splice(index, 1); showToast(translations[currentLang].fav_removed); }
    else { favorites.push(id); showToast(translations[currentLang].fav_added); }
    localStorage.setItem('luxe_favs', JSON.stringify(favorites));
    filterAndRender();
};

// --- Cart ---
window.addToCart = (id) => {
    const product = productsData.find(p => p.id === id);
    cart.push(product);
    localStorage.setItem('luxe_cart', JSON.stringify(cart));
    updateCartUI();
    const badge = document.getElementById('cart-badge');
    badge.classList.add('scale-125'); setTimeout(() => badge.classList.remove('scale-125'), 200);
    showToast(translations[currentLang].success_upload.replace('!', ' 🛒'), 'success');
};

window.removeCartItem = (idx) => {
    cart.splice(idx, 1);
    localStorage.setItem('luxe_cart', JSON.stringify(cart));
    updateCartUI();
};

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    badge.innerText = cart.length;
    badge.classList.toggle('scale-0', cart.length === 0);
    
    let total = 0;
    document.getElementById('cart-items').innerHTML = cart.map((item, idx) => {
        total += item.price;
        return `
            <div class="flex items-center gap-4 bg-white/60 dark:bg-white/10 p-3 rounded-2xl shadow-sm border border-white/20">
                <img src="${item.imageUrl}" class="w-16 h-16 rounded-xl object-cover">
                <div class="flex-grow">
                    <p class="text-sm font-bold dark:text-white truncate w-32">${item.title}</p>
                    <p class="text-sm font-extrabold text-apple-blue">$${item.price.toFixed(2)}</p>
                </div>
                <button onclick="window.removeCartItem(${idx})" class="text-red-500 hover:text-red-700 p-2 bg-red-50 dark:bg-red-900/20 rounded-full transition">✕</button>
            </div>
        `;
    }).join('');
    
    if(cart.length === 0) document.getElementById('cart-items').innerHTML = `<p class="text-center text-apple-muted mt-10">${translations[currentLang].empty_cart}</p>`;
    document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;
}

const toggleCart = () => {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    const isOpen = drawer.classList.contains('cart-open');
    drawer.classList.toggle('cart-open');
    if(!isOpen) {
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    } else {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
};

document.getElementById('cart-toggle').addEventListener('click', toggleCart);
document.getElementById('close-cart').addEventListener('click', toggleCart);
document.getElementById('cart-overlay').addEventListener('click', toggleCart);

// Init
updateLanguage();
updateCartUI(); toggleCart);
document.getElementById('cart-overlay').addEventListener('click', toggleCart);

// Init
updateLanguage();
updateCartUI();