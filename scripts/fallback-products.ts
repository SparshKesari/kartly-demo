/**
 * Offline fallback catalog: 60 deterministic products in the same shape as the
 * DummyJSON products API, used only when the network fetch fails and no cached
 * source file exists.
 */
export type RawReview = {
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
  reviewerEmail: string;
};

export type RawProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand?: string;
  sku: string;
  weight: number;
  dimensions: { width: number; height: number; depth: number };
  warrantyInformation: string;
  shippingInformation: string;
  returnPolicy: string;
  reviews: RawReview[];
  meta: { createdAt: string };
  images: string[];
  thumbnail: string;
};

const CATEGORIES: { slug: string; brand: string; nouns: string[]; basePrice: number }[] = [
  { slug: "beauty", brand: "Glow Lab", nouns: ["Mascara", "Lip Gloss", "Face Powder", "Eyeliner", "Blush"], basePrice: 9 },
  { slug: "fragrances", brand: "Aroma House", nouns: ["Eau de Parfum", "Cologne", "Body Mist", "Perfume Oil", "Eau de Toilette"], basePrice: 39 },
  { slug: "furniture", brand: "Oak & Pine", nouns: ["Bed Frame", "Sofa", "Side Table", "Office Chair", "Bookshelf"], basePrice: 149 },
  { slug: "groceries", brand: "Fresh Farm", nouns: ["Apples", "Rice", "Olive Oil", "Coffee Beans", "Honey"], basePrice: 3 },
  { slug: "laptops", brand: "Nimbus", nouns: ["Ultrabook 13", "Pro 15", "Gaming 17", "Chromebook", "Workstation"], basePrice: 699 },
  { slug: "mens-shirts", brand: "Tailor Co", nouns: ["Oxford Shirt", "Flannel Shirt", "Polo", "Linen Shirt", "Denim Shirt"], basePrice: 24 },
  { slug: "mens-shoes", brand: "Stride", nouns: ["Running Shoes", "Sneakers", "Loafers", "Boots", "Trainers"], basePrice: 59 },
  { slug: "smartphones", brand: "Pixelon", nouns: ["Phone S", "Phone Plus", "Phone Max", "Phone Mini", "Phone Lite"], basePrice: 199 },
  { slug: "sunglasses", brand: "Shade Co", nouns: ["Aviators", "Wayfarers", "Round Glasses", "Sport Glasses", "Cat Eye"], basePrice: 19 },
  { slug: "tablets", brand: "Pixelon", nouns: ["Tab 8", "Tab 10", "Tab 11 Pro", "Tab Mini", "Tab Air"], basePrice: 249 },
  { slug: "tops", brand: "Sunday Studio", nouns: ["Frock", "Summer Top", "Tunic", "Blouse", "Crop Top"], basePrice: 19 },
  { slug: "womens-bags", brand: "Carryall", nouns: ["Tote", "Handbag", "Backpack", "Clutch", "Crossbody"], basePrice: 39 },
];

const REVIEWERS = ["Ava Turner", "Liam Brooks", "Mia Patel", "Noah Rivera", "Zoe Kim"];
const COMMENTS = ["Great value for the price!", "Works exactly as described.", "Would buy this again happily.", "Not bad but could be better.", "Very satisfied with this purchase!"];

export function fallbackProducts(): RawProduct[] {
  const products: RawProduct[] = [];
  let id = 1;
  CATEGORIES.forEach((cat, ci) => {
    cat.nouns.forEach((noun, ni) => {
      const price = Math.round((cat.basePrice * (1 + ni * 0.35) + 0.99) * 100) / 100;
      const reviews: RawReview[] = [0, 1, 2].map((r) => ({
        rating: ((id + r) % 5) + 1,
        comment: COMMENTS[(id + r) % COMMENTS.length],
        date: `2025-0${(r % 9) + 1}-1${ni}T10:00:00.000Z`,
        reviewerName: REVIEWERS[(id + r) % REVIEWERS.length],
        reviewerEmail: `${REVIEWERS[(id + r) % REVIEWERS.length].toLowerCase().replace(" ", ".")}@example.test`,
      }));
      products.push({
        id,
        title: `${cat.brand} ${noun}`,
        description: `The ${cat.brand} ${noun} is a dependable everyday pick. Built to last and easy to love.`,
        category: cat.slug,
        price,
        discountPercentage: ((id * 7) % 25) + 0.5,
        rating: Math.round((2.5 + ((id * 37) % 25) / 10) * 100) / 100,
        stock: 10 + ((id * 13) % 90),
        tags: [cat.slug],
        brand: cat.brand,
        sku: `FB-${ci}${ni}-${String(id).padStart(3, "0")}`,
        weight: (id % 9) + 1,
        dimensions: { width: 10 + ni, height: 12 + ci, depth: 5 + ni },
        warrantyInformation: `${(id % 3) + 1} year warranty`,
        shippingInformation: `Ships in ${(id % 5) + 1} business days`,
        returnPolicy: "30 days return policy",
        reviews,
        meta: { createdAt: `2025-${String((id % 12) + 1).padStart(2, "0")}-${String((id % 27) + 1).padStart(2, "0")}T12:00:00.000Z` },
        images: [],
        thumbnail: "",
      });
      id += 1;
    });
  });
  return products;
}
