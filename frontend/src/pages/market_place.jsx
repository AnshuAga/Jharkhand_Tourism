import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { loadRazorpay } from "../services/razorpay";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingBag,
  Heart,
  Star,
  SlidersHorizontal,
  X,
  MapPin,
  ShieldCheck,
  Truck,
  Leaf,
  ChevronDown,
  Plus,
} from "lucide-react";

/* =========================================================
   REAL / DIRECT IMAGE SOURCES
   These are IMAGE FILE URLs, not webpage URLs.
   ========================================================= */

const IMG = {
  sohrai:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Sohrai_painting,_Jharkhand.jpg",

  sohraiWall:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Sohrai_wall_painting_jharkhand_India.jpg",

  bamboo:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Bamboo_Basket_of_Jharkhand.jpg",

  bambooVase:
    "https://d35l77wxi0xou3.cloudfront.net/opencart/image/productFromFeb2020/Handcrafted%20Bamboo%20Flower%20Vae1593002756-600x600.jpg",

  dhokraFisherwoman:
    "https://static.wixstatic.com/media/9dd462_5db601b5d3a6482a9650f5e40474d9c6~mv2.jpg/v1/fill/w_1340,h_960,al_c,q_85,enc_avif,quality_auto/9dd462_5db601b5d3a6482a9650f5e40474d9c6~mv2.jpg",

  dhokraSun:
    "https://static.wixstatic.com/media/9dd462_456ac291bc684f67a801e63ed746aded~mv2.jpg/v1/fill/w_1340,h_960,al_c,q_85,enc_avif,quality_auto/9dd462_456ac291bc684f67a801e63ed746aded~mv2.jpg",

  dhokraGeneric:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Dokra_from_tribes_of_Bastar_DSCN1172_01.jpg",

  tussar:
    "https://www.jiomart.com/images/product/original/rvybw3lmm1/jharcraft-a-jharkhand-govt-enterprise-reeled-tasar-gheecha-silk-printed-saree-product-images-orvybw3lmm1-p609022685-2-202405190828.jpg?im=Resize%3D%281000%2C1000%29",

  tussarBlue:
    "https://www.jiomart.com/images/product/original/rvlknryw2u/jharcraft-a-jharkhand-govt-enterprise-reeled-tasar-gheecha-silk-printed-saree-product-images-orvlknryw2u-p609016694-6-202405181820.jpg?im=Resize%3D%28500%2C630%29",

  tribalWomen:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Tribal_Women_-_Ranchi_8895.JPG",

  tribalPeople:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Santal_people_Jharkhand_India.jpg",

  jewellery:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Anklets,Payal,_Jharkhand.jpg",

  khovar:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Sohrai_and_Kohbar_Paintings_01.jpg",

  khovarWall:
    "https://media.meer.com/attachments/8360c7890e9f43e2e3433b3af97b474f74c99d6b/store/fill/690/388/e72863da400a8bb928b54a6715e2981fa14d32b08183c7c7a2467fdf5013/Deidi-Von-Schaewen-House-in-the-compound-of-Bulu-Imam-Sanskriti-Khovar-style.jpg",
};

/* =========================================================
   PRODUCTS
   ========================================================= */

const products = [
  {
    id: 1,
    name: "Sohrai Peacock Painting",
    category: "Paintings",
    district: "Hazaribagh",
    material: "Natural pigments",
    price: 2695,
    rating: 4.9,
    reviews: 48,
    artisan: "Hazaribagh Tribal Artists",
    image: IMG.sohrai,
    description:
      "Traditional Sohrai artwork inspired by the animal, forest and fertility motifs of Hazaribagh.",
    badge: "Heritage",
  },

  {
    id: 2,
    name: "Dhokra Nandi Pair",
    category: "Dhokra",
    district: "Ramgarh",
    material: "Brass",
    price: 2995,
    rating: 4.8,
    reviews: 42,
    artisan: "Jharkhand Dhokra Artisan",
    image: IMG.dhokraGeneric,
    description:
      "Hand-cast Dhokra Nandi figures made using the traditional lost-wax metal casting technique.",
    badge: "Handmade",
  },

  {
    id: 3,
    name: "Sohrai Peacock Coaster Set",
    category: "Home Decor",
    district: "Hazaribagh",
    material: "Hand-painted",
    price: 895,
    rating: 4.7,
    reviews: 36,
    artisan: "Sohrai Artists",
    image: IMG.sohraiWall,
    description:
      "A contemporary home accessory inspired by the bold animal and floral vocabulary of Sohrai art.",
    badge: "Popular",
  },

  {
    id: 4,
    name: "Handwoven Tasar Silk Saree",
    category: "Textiles",
    district: "Ranchi",
    material: "Tasar Silk",
    price: 3200,
    rating: 4.8,
    reviews: 61,
    artisan: "Jharcraft Weavers",
    image: IMG.tussar,
    description:
      "Jharkhand Tasar silk textile with traditional handloom character and block-printed detailing.",
    badge: "Tasar Silk",
  },

  {
    id: 5,
    name: "Jharkhand Bamboo Fruit Basket",
    category: "Bamboo",
    district: "Dumka",
    material: "Bamboo",
    price: 1250,
    rating: 4.7,
    reviews: 31,
    artisan: "Dumka Bamboo Artisans",
    image: IMG.bamboo,
    description:
      "Handwoven bamboo basket made using traditional rural weaving techniques.",
    badge: "Eco Craft",
  },

  {
    id: 6,
    name: "Traditional Tribal Jewellery",
    category: "Jewellery",
    district: "Ranchi",
    material: "Silver",
    price: 1850,
    rating: 4.6,
    reviews: 27,
    artisan: "Jharkhand Tribal Artisans",
    image: IMG.jewellery,
    description:
      "Traditional jewellery inspired by the ornament traditions of Jharkhand's tribal communities.",
    badge: "Traditional",
  },

  {
    id: 7,
    name: "Dhokra Fisherwoman",
    category: "Dhokra",
    district: "Ramgarh",
    material: "Brass",
    price: 1495,
    rating: 4.8,
    reviews: 39,
    artisan: "Pancham Malhar",
    image: IMG.dhokraFisherwoman,
    description:
      "Handcrafted Dhokra figure representing a fisherwoman, made using the ancient lost-wax technique.",
    badge: "Handmade",
  },

  {
    id: 8,
    name: "Bamboo Woven Decorative Vase",
    category: "Bamboo",
    district: "Ranchi",
    material: "Bamboo",
    price: 1450,
    rating: 4.7,
    reviews: 25,
    artisan: "Jharkhand Bamboo Artisans",
    image: IMG.bambooVase,
    description:
      "Naturally woven bamboo vase with a traditional handcrafted finish.",
    badge: "Eco Craft",
  },

  {
    id: 9,
    name: "Dhokra Sun Wall Hanging",
    category: "Dhokra",
    district: "Ramgarh",
    material: "Brass",
    price: 595,
    rating: 4.8,
    reviews: 44,
    artisan: "Pancham Malhar",
    image: IMG.dhokraSun,
    description:
      "Decorative Dhokra Sun wall hanging representing traditional tribal metal craftsmanship.",
    badge: "Heritage",
  },

  {
    id: 10,
    name: "Khovar Inspired Artwork",
    category: "Paintings",
    district: "Hazaribagh",
    material: "Natural pigments",
    price: 2495,
    rating: 4.7,
    reviews: 33,
    artisan: "Hazaribagh Artists",
    image: IMG.khovar,
    description:
      "Artwork inspired by the Khovar wedding-room painting tradition of Hazaribagh.",
    badge: "Heritage",
  },

  {
    id: 11,
    name: "Blue Tasar Silk Saree",
    category: "Textiles",
    district: "Ranchi",
    material: "Tasar Silk",
    price: 2890,
    rating: 4.8,
    reviews: 52,
    artisan: "Jharcraft Weavers",
    image: IMG.tussarBlue,
    description:
      "Rich Tasar silk textile featuring traditional printed motifs and handloom character.",
    badge: "Tasar Silk",
  },

  {
    id: 12,
    name: "Dhokra Tribal Couple Frame",
    category: "Dhokra",
    district: "Ramgarh",
    material: "Brass",
    price: 795,
    rating: 4.8,
    reviews: 29,
    artisan: "Jharkhand Dhokra Artisan",
    image: IMG.dhokraGeneric,
    description:
      "Decorative Dhokra artwork portraying a traditional tribal couple.",
    badge: "Handmade",
  },
];

/* =========================================================
   IMAGE WITH FALLBACK
   ========================================================= */

function ProductImage({ src, alt, className = "" }) {
  const [image, setImage] = useState(src);

  return (
    <img
      src={image}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (image !== IMG.sohrai) {
          setImage(IMG.sohrai);
        }
      }}
    />
  );
}

/* =========================================================
   PRODUCT CARD
   ========================================================= */

function ProductCard({
  product,
  liked,
  onLike,
  onOpen,
  onAdd,
  cartCount,
  canPurchase,
}) {
  const availableStock = Number.isFinite(product.stock) ? product.stock : 10;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1326] shadow-lg shadow-black/20"
    >
      {/* IMAGE */}

      <div className="relative h-56 overflow-hidden bg-slate-900">
        <ProductImage
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-950">
          {product.badge}
        </div>

        <button
          onClick={() => onLike(product.id)}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/80 backdrop-blur transition hover:bg-slate-900"
        >
          <Heart
            size={16}
            className={liked ? "fill-red-500 text-red-500" : "text-white"}
          />
        </button>
      </div>

      {/* CONTENT */}

      <div className="p-4">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-400">
          {product.category}
        </div>

        <h3 className="min-h-11 text-base font-semibold text-white">
          {product.name}
        </h3>

        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
          <MapPin size={12} />
          {product.district}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <Star size={13} className="fill-amber-400 text-amber-400" />
          <span className="text-xs font-medium text-white">
            {product.rating}
          </span>
          <span className="text-xs text-slate-500">
            ({product.reviews})
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">
              ₹{product.price.toLocaleString("en-IN")}
            </div>

            <div className={availableStock > 0 ? "text-[10px] text-emerald-400" : "text-[10px] text-red-400"}>
              {availableStock > 0 ? `${availableStock} in stock` : "Out of stock"}
            </div>
          </div>

          {canPurchase && <button
            onClick={() => onAdd(product)}
            disabled={availableStock <= 0 || cartCount >= availableStock}
            title={availableStock <= 0 ? "Out of stock" : "Add to cart"}
            className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Plus size={17} />
            Add
          </button>}
        </div>

        <button
          onClick={() => onOpen(product)}
          className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-[10px] text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
        >
          Discover This Craft
        </button>
      </div>
    </motion.div>
  );
}

/* =========================================================
   MAIN PAGE
   ========================================================= */

export default function MarketPlace() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const canPurchase = role !== 'guide' && role !== 'vendor';
  const cartKey = `jharkhand_cart_${user?.id || user?.email || 'guest'}`;
  const location = useLocation();
  const [items, setItems] = useState(products);
  const [loadingItems, setLoadingItems] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [district, setDistrict] = useState("All");
  const [material, setMaterial] = useState("All");
  const [sort, setSort] = useState("featured");
  const [maxPrice, setMaxPrice] = useState(10000);

  const [liked, setLiked] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [loadedCartKey, setLoadedCartKey] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentGateway, setPaymentGateway] = useState("escrow");

  useEffect(() => {
    if (new URLSearchParams(location.search).get("cart") === "1") {
      setIsCartOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem(cartKey) || "[]");
      setCart(Array.isArray(savedCart) ? savedCart : []);
    } catch {
      setCart([]);
    }
    setLoadedCartKey(cartKey);
    setCartLoaded(true);
  }, [cartKey]);

  useEffect(() => {
    if (!cartLoaded || loadedCartKey !== cartKey) return;
    localStorage.setItem(cartKey, JSON.stringify(cart));
    window.dispatchEvent(new Event("jharkhand-cart-updated"));
  }, [cart, cartKey, cartLoaded, loadedCartKey]);

  useEffect(() => {
    async function loadDynamicMarketplace() {
      setLoadingItems(true);
      try {
        const res = await api.marketplace.getData();
        if (res && res.success && Array.isArray(res.products) && res.products.length > 0) {
          const dbProducts = res.products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category || "Handicrafts",
            district: p.district || "Jharkhand",
            material: p.material || "Artisanal",
            price: Number(p.price) || 0,
            rating: p.rating || 4.8,
            reviews: p.reviews_count || p.reviews || 12,
            artisan: p.vendor_name || p.artisan_name || "Verified Cooperative Artisan",
            image: p.image || IMG.dhokraGeneric,
            description: p.description,
            badge: p.badge || (p.vendor_verified ? "Verified Artisan" : "Handmade"),
            stock: Number(p.stock) || 0,
            vendor_id: p.vendor_id,
            blockchain_cert_id: p.blockchain_cert_id,
          }));
          setItems(dbProducts);
        }
      } catch (err) {
        console.error("Using fallback marketplace items due to:", err);
      } finally {
        setLoadingItems(false);
      }
    }
    loadDynamicMarketplace();
  }, []);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const Razorpay = await loadRazorpay();
      const bookings = [];
      const uniqueItems = Array.from(new Map(cart.map((item) => [item.id, item])).values());
      for (const item of uniqueItems) {
        const travelers = cart.filter((cartItem) => cartItem.id === item.id).length;
        const res = await api.payments.createOrder({
          itemType: "product",
          itemId: item.id,
          travelers
        });
        await new Promise((resolve, reject) => {
           console.log("RAZORPAY ORDER RESPONSE:", res);
           
          const checkout = new Razorpay({
            
            key: res.keyId,
            amount: res.order.amount,
            currency: res.order.currency,
            name: 'Jharkhand Tourism',
            description: `${item.name}${travelers > 1 ? ` x ${travelers}` : ''}`,
            order_id: res.order.id,
            prefill: { name: user?.name || '', email: user?.email || '' },
            theme: { color: '#fbbf24' },
            method: {
              card: true,
              upi: true,
              netbanking: true,
              wallet: true
            },
            handler: async (response) => {
              try {
                const verified = await api.payments.verify(response);
                bookings.push({ booking: verified.booking, payment: verified.payment });
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) }
          });
          checkout.on('payment.failed', (event) => reject(new Error(event?.error?.description || event?.error?.reason || 'Razorpay test payment failed.')));
          checkout.open();
        });
      }
      setCheckoutSuccess({ bookings, booking: bookings[0].booking, payment: bookings[0].payment });
      setCart([]);
      setIsCartOpen(false);
      navigate('/tourist#bookings');
    } catch (err) {
      alert("Checkout error: " + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const categories = [
    "All",
    "Paintings",
    "Dhokra",
    "Bamboo",
    "Textiles",
    "Jewellery",
    "Home Decor",
  ];

  const districts = [
    "All",
    "Hazaribagh",
    "Ranchi",
    "Ramgarh",
    "Dumka",
  ];

  const materials = [
    "All",
    "Brass",
    "Bamboo",
    "Tasar Silk",
    "Natural pigments",
    "Silver",
    "Hand-painted",
  ];

  const filteredProducts = useMemo(() => {
    let result = items.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase()) ||
        product.district.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || product.category.toLowerCase() === category.toLowerCase();

      const matchesDistrict =
        district === "All" || product.district.toLowerCase() === district.toLowerCase();

      const matchesMaterial =
        material === "All" || (product.material && product.material.toLowerCase().includes(material.toLowerCase()));

      const matchesPrice = product.price <= maxPrice;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesDistrict &&
        matchesMaterial &&
        matchesPrice
      );
    });

    if (sort === "price-low") {
      result.sort((a, b) => a.price - b.price);
    }

    if (sort === "price-high") {
      result.sort((a, b) => b.price - a.price);
    }

    if (sort === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    }

    if (sort === "popular") {
      result.sort((a, b) => b.reviews - a.reviews);
    }

    return result;
  }, [items, search, category, district, material, maxPrice, sort]);

  const toggleLike = (id) => {
    setLiked((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart((prev) => [...prev, product]);
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.id === productId);
      return index === -1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100">

      {/* =====================================================
         HERO
         ===================================================== */}

      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0">
          <ProductImage
            src={IMG.sohraiWall}
            alt="Sohrai wall painting in Jharkhand"
            className="h-full w-full object-cover opacity-30"
          />

          <div className="absolute inset-0 bg-linear-to-b from-[#070b14]/60 via-[#070b14]/85 to-[#070b14]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-28">

          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              <Leaf size={15} />
              Jharkhand Artisan Marketplace
            </div>

            <h1 className="text-4xl font-bold leading-tight md:text-6xl">
              Objects With a
              <span className="block font-serif italic text-amber-400">
                Story.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Discover traditional Sohrai paintings, Dhokra metalwork,
              Tasar silk and bamboo crafts created by artisans of Jharkhand.
            </p>
          </div>

          {/* SEARCH */}

          <div className="mt-10 max-w-2xl">
            <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950/80 px-4 backdrop-blur">
              <Search size={18} className="text-slate-500" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Sohrai, Dhokra, Tasar, Bamboo..."
                className="w-full bg-transparent px-3 py-4 text-sm text-white outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

        </div>
      </section>

      {/* =====================================================
         CATEGORY CHIPS
         ===================================================== */}

      <div className="sticky top-0 z-30 border-b border-slate-800 bg-[#070b14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-4">

          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                category === item
                  ? "bg-amber-400 text-slate-950"
                  : "border border-slate-700 bg-slate-900 text-slate-400 hover:border-amber-400 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}

        </div>
      </div>

      {/* =====================================================
         FILTER BAR
         ===================================================== */}

      <section className="mx-auto max-w-7xl px-6 pt-8">

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0b1326] p-5 lg:flex-row lg:items-end">

          <div className="flex items-center gap-2 text-sm font-semibold text-white lg:mr-auto">
            <SlidersHorizontal size={17} className="text-amber-400" />
            Refine Collection
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">

            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="market-select w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-amber-400"
            >
              {districts.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="market-select w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-amber-400"
            >
              {materials.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="market-select w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-amber-400"
            >
              <option value="featured">Featured</option>
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>

            <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2">
              <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                <span>Max Price</span>
                <span className="text-amber-400">
                  ₹{maxPrice.toLocaleString("en-IN")}
                </span>
              </div>

              <input
                type="range"
                min="500"
                max="10000"
                step="100"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================
         PRODUCT GRID
         ===================================================== */}

      <section className="mx-auto max-w-7xl px-6 py-10">

        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-400">
              Curated by Craft
            </p>

            <h2 className="mt-1 text-2xl font-bold text-white">
              Objects With a Story
            </h2>
          </div>

          <div className="text-xs text-slate-500">
            {filteredProducts.length} pieces
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0b1326] py-20 text-center">
            <Search
              size={35}
              className="mx-auto mb-4 text-slate-600"
            />

            <h3 className="text-lg font-semibold text-white">
              No crafts found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try changing your filters or search term.
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                liked={liked.includes(product.id)}
                onLike={toggleLike}
                onOpen={setSelectedProduct}
                onAdd={addToCart}
                cartCount={cart.filter((item) => item.id === product.id).length}
                canPurchase={canPurchase}
              />
            ))}
          </motion.div>
        )}

      </section>

      {/* =====================================================
         TRUST SECTION
         ===================================================== */}

      <section className="mx-auto max-w-7xl px-6 pb-16">

        <div className="grid gap-5 lg:grid-cols-2">

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1326]">

            <div className="relative h-72">
              <ProductImage
                src={IMG.tribalWomen}
                alt="Tribal women of Jharkhand"
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-linear-to-t from-[#0b1326] to-transparent" />

              <div className="absolute bottom-5 left-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400">
                  Behind the Craft
                </p>

                <h3 className="mt-1 text-2xl font-bold text-white">
                  Made by Hands.
                </h3>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-7 text-slate-400">
                From bamboo weaving to metal casting and hand-painted
                murals, Jharkhand's crafts carry generations of knowledge
                and local identity.
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs text-amber-400">
                <ShieldCheck size={15} />
                Artisan-focused collection
              </div>
            </div>

          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/6 p-7">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-slate-950">
              <Leaf size={18} />
            </div>

            <h3 className="mt-5 font-serif text-2xl font-bold text-white">
              More Than a Souvenir
            </h3>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              Take home something that carries the people, landscape and
              traditions you encountered in Jharkhand.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">

              {[
                ["Handmade", "Craft tradition"],
                ["Local", "Jharkhand origin"],
                ["Unique", "Small-batch"],
                ["Heritage", "Living culture"],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"
                >
                  <div className="text-xs font-semibold text-amber-400">
                    {title}
                  </div>

                  <div className="mt-1 text-[10px] text-slate-500">
                    {text}
                  </div>
                </div>
              ))}

            </div>

          </div>

        </div>

      </section>

      {/* =====================================================
         CART BUTTON
         ===================================================== */}

      {canPurchase && <button 
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-black/30 transition hover:bg-amber-300"
      >
        <ShoppingBag size={17} />
        Cart
        {cart.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1 text-[10px] text-white">
            {cart.length}
          </span>
        )}
      </button>}

      {/* CART & ESCROW CHECKOUT MODAL */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
            onClick={() => setIsCartOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0b1326] p-7 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="text-amber-400" size={20} />
                  <h3 className="text-lg font-serif font-bold text-white">Your Artisan Cart</h3>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {checkoutSuccess ? (
                <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 space-y-3 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck size={24} />
                  </div>
                  <h4 className="text-lg font-bold text-white">Smart Contract Escrow Active!</h4>
                  <p className="text-xs text-slate-300">
                    {checkoutSuccess.bookings?.length > 1 ? `${checkoutSuccess.bookings.length} orders secured` : 'Booking ID:'}{' '}
                    <strong className="text-amber-400">{checkoutSuccess.booking?.id}</strong>
                  </p>
                  {checkoutSuccess.bookings?.length > 1 && (
                    <div className="space-y-1 text-left">
                      {checkoutSuccess.bookings.map(({ booking }) => (
                        <p key={booking.id} className="text-[10px] text-slate-400">{booking.item_title} <span className="text-amber-400">{booking.id}</span></p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-300">Gateway: <strong className="text-emerald-400">{checkoutSuccess.payment?.gateway === "escrow" ? "Smart Contract Escrow" : checkoutSuccess.payment?.gateway}</strong></p>
                  <p className="text-[11px] font-mono text-emerald-400 break-all">
                    Contract: {checkoutSuccess.booking?.contract_address || checkoutSuccess.escrow?.contractAddress || '0xJharkhandEscrowContract'}
                  </p>
                  {checkoutSuccess.booking?.contract_tx_hash && (
                    <p className="text-[10px] font-mono text-slate-400 break-all">
                      Tx Hash: {checkoutSuccess.booking.contract_tx_hash}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Funds are secured in escrow and will be released to the artisan upon confirmed delivery.
                  </p>
                  <button
                    onClick={() => {
                      setCheckoutSuccess(null);
                      setIsCartOpen(false);
                    }}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase"
                  >
                    Continue Exploring
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <p className="text-sm">Your cart is currently empty.</p>
                  <p className="text-xs text-slate-500">Discover hand-painted Sohrai art or Dhokra brass crafts above!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                    {Array.from(new Map(cart.map((item) => [item.id, item])).values()).map((item) => {
                      const quantity = cart.filter((cartItem) => cartItem.id === item.id).length;
                      return (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white">{item.name}</h4>
                          <span className="text-[10px] text-amber-400">{item.district} • {item.artisan}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            aria-label={`Remove one ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300"
                          >
                            <span className="text-base leading-none">-</span>
                          </button>
                          <span className="min-w-5 text-center text-sm font-bold text-white">{quantity}</span>
                          <button
                            onClick={() => addToCart(item)}
                            aria-label={`Add another ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 hover:bg-amber-300"
                          >
                            <Plus size={15} />
                          </button>
                          <span className="w-20 text-right text-sm font-bold text-white">₹{(item.price * quantity).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-800 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Amount:</span>
                      <span className="font-bold text-lg text-white">
                        ₹{cart.reduce((sum, item) => sum + item.price, 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                      <ShieldCheck size={14} />
                      Protected by the existing platform escrow flow
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="marketplace-payment-gateway" className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Payment gateway
                    </label>
                    <select
                      id="marketplace-payment-gateway"
                      value={paymentGateway}
                      onChange={(event) => setPaymentGateway(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-200 outline-none focus:border-amber-400"
                    >
                      <option value="razorpay">Razorpay test checkout</option>
                    </select>
                    <p className="text-[10px] text-slate-500">Sandbox payment only. Funds remain locked in platform escrow until delivery is confirmed.</p>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                    className="w-full py-3.5 rounded-xl bg-linear-to-r from-amber-400 to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                  >
                    {checkoutLoading ? "Opening secure test checkout..." : "Pay securely with Razorpay test mode"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================
         PRODUCT MODAL
         ===================================================== */}

      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          >

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#0b1326]"
            >

              <div className="grid md:grid-cols-2">

                <div className="relative h-80 md:h-full">
                  <ProductImage
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="h-full min-h-80 w-full object-cover"
                  />

                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-7">

                  <div className="text-xs uppercase tracking-widest text-amber-400">
                    {selectedProduct.category}
                  </div>

                  <h2 className="mt-2 text-3xl font-bold text-white">
                    {selectedProduct.name}
                  </h2>

                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                    <MapPin size={15} />
                    {selectedProduct.district}
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <Star
                      size={15}
                      className="fill-amber-400 text-amber-400"
                    />

                    <span className="text-white">
                      {selectedProduct.rating}
                    </span>

                    <span className="text-slate-500">
                      ({selectedProduct.reviews} reviews)
                    </span>
                  </div>

                  <p className="mt-6 text-sm leading-7 text-slate-400">
                    {selectedProduct.description}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3">

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-[10px] uppercase text-slate-500">
                        Material
                      </div>

                      <div className="mt-1 text-sm text-white">
                        {selectedProduct.material}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-[10px] uppercase text-slate-500">
                        Artisan
                      </div>

                      <div className="mt-1 text-sm text-white">
                        {selectedProduct.artisan}
                      </div>
                    </div>

                  </div>

                  <div className="mt-7 flex items-center justify-between">

                    <div className="text-2xl font-bold text-white">
                      ₹
                      {selectedProduct.price.toLocaleString("en-IN")}
                    </div>

                    <button
                      onClick={() => {
                        addToCart(selectedProduct);
                        setSelectedProduct(null);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
                    >
                      <ShoppingBag size={17} />
                      Add to Cart
                    </button>

                  </div>

                </div>

              </div>

            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}