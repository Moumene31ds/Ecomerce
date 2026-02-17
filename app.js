import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ==========================================
// 1. FIREBASE CONFIG
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 2. SECURITY (XSS Prevention)
// ==========================================
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

// ==========================================
// 3. STATE & TRANSLATIONS
// ==========================================
let currentUser = null;
let currentLang = 'fr';
let productsData = [];
let cart = JSON.parse(localStorage.getItem('luxe_cart')) || [];
let isSignupMode = false;

const translations = {
    fr: {
        brand: "Luxe Market", login: "Connexion", dashboard: "Vendre", logout: "Déconnexion",
        hero_title: "Lancez votre e-commerce aujourd'hui",
        hero_subtitle: "Aucune expérience technique requise. Ouvrez votre boutique gratuitement, présentez vos produits au monde et réalisez vos premiers bénéfices.",
        start_selling: "Commencer à vendre (Gratuit)", browse_products: "Explorer les produits",
        step1_title: "Créez votre compte", step1_desc: "Une étape simple et totalement gratuite.",
        step2_title: "Ajoutez vos produits", step2_desc: "Prenez une photo, fixez votre prix et publiez instantanément.",
        step3_title: "Générez des revenus", step3_desc: "Atteignez des milliers d'acheteurs.",
        latest_products: "Derniers Produits", add_product: "Ajouter un produit", publish: "Publier",
        cat_all: "Tout", cat_elec: "Électronique", cat_fash: "Mode",
        search_placeholder: "Rechercher...", cart_title: "Mon Panier", total: "Total:",
        checkout: "Payer", add_to_cart: "Ajouter", empty_cart: "Panier vide",
        auth_welcome: "Bienvenue", signup_link: "Créer un compte", login_link: "Se connecter",
        error_file: "Image trop grande (Max 2MB)", success_upload: "Produit ajouté !"
    },
    ar: {
        brand: "سوق فاخر", login: "دخول", dashboard: "لوحة البائع", logout: "خروج",
        hero_title: "ابدأ رحلتك في التجارة الإلكترونية اليوم",
        hero_subtitle: "لا تحتاج إلى خبرة تقنية. افتح متجرك الخاص مجاناً، اعرض منتجاتك للعالم، وحقق أرباحك الأولى في دقائق.",
        start_selling: "ابدأ البيع مجاناً", browse_products: "تصفح المنتجات",
        step1_title: "سجل حسابك", step1_desc: "بخطوة واحدة بسيطة ومجانية بالكامل.",
        step2_title: "أضف منتجاتك", step2_desc: "التقط صورة لمنتجك، ضع السعر المناسب، وانشره فوراً.",
        step3_title: "استقبل أرباحك", step3_desc: "صل لآلاف المشترين المحتملين وضاعف دخلك.",
        latest_products: "أحدث المنتجات", add_product: "إضافة منتج جديد", publish: "نشر الآن",
        cat_all: "الكل", cat_elec: "إلكترونيات", cat_fash: "موضة",
        search_placeholder: "بحث عن منتج...", cart_title: "سلة المشتريات", total: "المجموع:",
        checkout: "إتمام الشراء", add_to_cart: "أضف للسلة", empty_cart: "السلة فارغة",
        auth_welcome: "مرحباً بك", signup_link: "ليس لديك حساب؟ سجل الآن", login_link: "لديك حساب؟ سجل الدخول",
        error_file: "الملف كبير جداً (أقصى حد 2 ميجا)", success_upload: "تم نشر المنتج بنجاح!"
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
    updateCartUI();
}

document.getElementById('lang-toggle').addEventListener('click', () => {
    currentLang = currentLang === 'fr' ? 'ar' : 'fr';
    updateLanguage();
});

// ==========================================
// 4. THEME TOGGLE (DARK MODE)
// ==========================================
if(localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
});

// ==========================================
// 5. AUTHENTICATION & HERO LOGIC
// ==========================================
const authModal = document.getElementById('auth-modal');
const heroSection = document.getElementById('hero-section');
const dashboardSection = document.getElementById('dashboard-section');
const marketplaceSection = document.getElementById('marketplace-section');

// مراقبة حالة المستخدم (إخفاء Hero إذا كان مسجلاً)
onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) {
        document.getElementById('user-menu').classList.remove('hidden');
        document.getElementById('auth-buttons').classList.add('hidden');
        if(heroSection) heroSection.classList.add('hidden');
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

// أزرار Hero
document.getElementById('btn-start-selling').addEventListener('click', () => openAuthModal(true));
document.getElementById('btn-browse').addEventListener('click', () => marketplaceSection.scrollIntoView({ behavior: 'smooth' }));

// أزرار Navbar
document.getElementById('btn-show-login').addEventListener('click', () => openAuthModal(false));
document.getElementById('close-modal').addEventListener('click', () => authModal.classList.replace('flex', 'hidden'));
document.getElementById('toggle-auth-mode').addEventListener('click', () => openAuthModal(!isSignupMode));

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try {
        if (isSignupMode) await createUserWithEmailAndPassword(auth, email, password);
        else await signInWithEmailAndPassword(auth, email, password);
        authModal.classList.replace('flex', 'hidden');
    } catch (err) { alert("Erreur: " + err.message); }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));
document.getElementById('btn-show-dashboard').addEventListener('click', () => {
    dashboardSection.classList.remove('hidden');
    marketplaceSection.classList.add('hidden');
});

// ==========================================
// 6. DASHBOARD (PRODUCT UPLOAD)
// ==========================================
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const file = document.getElementById('prod-image').files[0];
    if (file.size > 2 * 1024 * 1024) return alert(translations[currentLang].error_file); // الحماية من الملفات الكبيرة

    const btn = document.getElementById('btn-submit-product');
    btn.disabled = true; btn.innerText = "...";

    try {
        const storageRef = ref(storage, `products/${currentUser.uid}_${Date.now()}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);
        
        await addDoc(collection(db, "products"), {
            title: escapeHTML(document.getElementById('prod-title').value), // الحماية من XSS
            price: Number(document.getElementById('prod-price').value),
            category: document.getElementById('prod-category').value,
            imageUrl: imageUrl,
            vendorId: currentUser.uid,
            createdAt: serverTimestamp()
        });
        
        alert(translations[currentLang].success_upload);
        document.getElementById('add-product-form').reset();
        dashboardSection.classList.add('hidden');
        marketplaceSection.classList.remove('hidden');
    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.disabled = false; btn.innerText = translations[currentLang].publish; }
});

// ==========================================
// 7. FEED, SEARCH & FILTERING
// ==========================================
let activeCategory = 'All';

onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
    productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    filterAndRender();
});

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = products.map(p => {
        // ترجمة الفئة
        const catKey = p.category === 'Electronics' ? 'cat_elec' : 'cat_fash';
        const translatedCat = translations[currentLang][catKey] || p.category;
        
        return `
        <div class="glass rounded-3xl overflow-hidden hover:shadow-2xl transition duration-500 flex flex-col group border border-white/40 dark:border-gray-700/50">
            <div class="h-56 overflow-hidden relative bg-white/50">
                <img src="${p.imageUrl}" class="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-in-out">
                <span class="absolute top-3 right-3 rtl:right-auto rtl:left-3 bg-white/80 dark:bg-black/60 backdrop-blur-md text-xs font-bold px-3 py-1.5 rounded-full shadow-sm dark:text-white">
                    ${translatedCat}
                </span>
            </div>
            <div class="p-5 flex flex-col flex-grow">
                <h3 class="font-bold text-lg mb-1 dark:text-white truncate">${p.title}</h3>
                <p class="text-apple-blue font-extrabold text-2xl mb-4">$${p.price.toFixed(2)}</p>
                <button onclick="window.addToCart('${p.id}')" class="mt-auto w-full bg-apple-bg dark:bg-white/10 text-apple-text dark:text-white py-2.5 rounded-xl font-bold hover:bg-apple-blue hover:text-white transition shadow-sm">
                    ${translations[currentLang].add_to_cart}
                </button>
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

// ==========================================
// 8. SHOPPING CART LOGIC
// ==========================================
window.addToCart = (id) => {
    const product = productsData.find(p => p.id === id);
    cart.push(product);
    localStorage.setItem('luxe_cart', JSON.stringify(cart));
    updateCartUI();
    const badge = document.getElementById('cart-badge');
    badge.classList.add('scale-125');
    setTimeout(() => badge.classList.remove('scale-125'), 200);
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

// بدء تشغيل اللغة الافتراضية والسلة
updateLanguage();
updateCartUI();