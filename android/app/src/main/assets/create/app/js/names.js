/** Deep-Fold SpriteGenerator NameGenerator port (seeded). */
import { mulberry32, randInt } from "./rng.js";

const MATERIALS = [
  "Bone", "Snow", "Boxwood", "Graphite", "Stone", "Wooden", "Water", "Ice", "Birch", "Air",
  "Crystal", "Magma", "Steel", "Metal", "Plastic", "Concrete", "Glass", "Paper", "Aluminium",
  "Titanium", "Leather", "Quartz", "Mineral",
];
const FOODS = [
  "Beet", "Broccoli", "Celery", "Fish", "Cabbage", "Corn", "Dandelion", "Vanilla", "Chocolate",
  "Lemon", "Coconut", "Strawberry", "Fiddlehead", "Grape", "Cheese", "Cake", "Zucchini",
  "Lettuce", "Spinach", "Salt", "Turnip", "Banana", "Cucumber", "Pumpkin", "Squash", "Tomato",
  "Pepper", "Artichoke", "Sunflower", "Asparagus", "Onion", "Shallot", "Meat", "Herb", "Tofu",
  "Bread", "Rice", "Carrot", "Mushroom", "Bun", "Milk", "Cereal", "Dumpling", "Sushi",
  "Spaghetti", "Meatball", "Apple Pie", "Dave",
];
const FLAVORS = ["Sweet", "Sour", "Spicy", "Hot", "Salty", "Bitter", "Disgusting", "Cheesy"];
const SIZES = ["Big", "Small", "Tiny", "Huge", "Massive", "Short", "Grand"];
const PROPERTIES = [
  "Colorful", "Destructive", "Mysterious", "Healing", "Chaotic", "Floating", "Heavy", "Deep",
  "Hateful", "Unique", "Heavenly", "Radioactive", "Toxic", "Burning", "Freezing", "Beautiful",
  "Ugly", "Cold", "Great", "Terrible", "Light", "Dark",
];
const COLORS = [
  "Red", "Green", "Blue", "Yellow", "Orange", "Pink", "Purple", "Cyan", "Magenta", "Black",
  "White", "Gray",
];
const AGES = [
  "Old", "Fresh", "Crusty", "New", "Ancient", "Broken", "Fossilized", "Crisp", "Aged", "Fermented",
];
const THINGS = [
  "Feather", "Sandals", "Gem", "Orb", "Dust", "Book", "Amulet", "Heart", "Finger", "Pencil",
  "Weapon", "Vitamins", "Calculator", "Cloud", "Overlord", "Bottle", "Branch", "Bag", "Alien",
  "Fire", "Fork", "Sculpture", "Soul", "Toothbrush",
];
const OTHER = [
  "Destruction", "Chaos", "Equality", "Electricity", "Speed", "Mutations", "Agression", "Worship",
  "Silence", "Illusion", "Purifying", "Growing", "Breaking", "Secrets",
];

const TAGS = [
  { key: "sizes", words: SIZES },
  { key: "ages", words: AGES },
  { key: "colors", words: COLORS },
  { key: "properties", words: PROPERTIES },
  { key: "flavors", words: FLAVORS },
  { key: "materials", words: MATERIALS },
];

function pick(rng, arr) {
  return arr[randInt(rng, arr.length)];
}

export function generateName(seed) {
  const rng = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const can = TAGS.slice();
  const added = [];
  for (let i = 0; i < 2; i++) {
    const tag = pick(rng, can);
    if (added.length === 0 && rng() < 0.9) added.push(tag.key);
    else if (!added.includes(tag.key) && rng() < 0.4) added.push(tag.key);
  }
  let name = "";
  for (const t of TAGS) {
    if (added.includes(t.key)) name += pick(rng, t.words) + " ";
  }
  if (rng() < 0.2) {
    name += pick(rng, THINGS) + " of " + pick(rng, OTHER);
  } else {
    name += rng() < 0.5 ? pick(rng, FOODS) : pick(rng, THINGS);
  }
  return name.trim();
}
