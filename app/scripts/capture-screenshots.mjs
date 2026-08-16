// One-off tool for the marketing landing page — captures real screenshots of
// the live app by seeding the same localStorage the app itself writes after
// a genuine login/registration (userRole/userPhone/ridepay_profile_*), so no
// UI is faked and no mock data beyond what the app already ships with is used.
// Run: node scripts/capture-screenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "assets", "screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = "https://ridepay.saypx.in";

const RIDER_PROFILE = {
  name: "Ananya Sharma",
  dob: "2000-04-12",
  gender: "Female",
  email: "ananya@example.com",
  vehicleType: "",
  vehicleModel: "",
  registration: "",
  licenseNumber: "",
  phone: "9800000001",
};

const DRIVER_PROFILE = {
  name: "Rakesh Kumar",
  dob: "1990-06-01",
  gender: "Male",
  email: "rakesh@example.com",
  vehicleType: "E-Rickshaw",
  vehicleModel: "Bajaj Maxima",
  registration: "WB 12 AB 1234",
  licenseNumber: "WB-DL-0012345",
  phone: "9800000002",
};

function seedAuthScript(role, phone, profile) {
  return `
    localStorage.setItem('userRole', '${role}');
    localStorage.setItem('userPhone', '${phone}');
    localStorage.setItem('ridepay_profile_${role}_${phone}', ${JSON.stringify(JSON.stringify(profile))});
    localStorage.setItem('${role}_theme', 'light');
  `;
}

const SHOTS = [
  { name: "home-booking", role: "user", path: "/user/home" },
  { name: "parcel", role: "user", path: "/user/home", click: "text=Parcel" },
  { name: "wallet", role: "user", path: "/user/wallet" },
  { name: "offers", role: "user", path: "/user/offers" },
  { name: "safety", role: "user", path: "/user/safety" },
  { name: "flying-plus", role: "user", path: "/user/subscription" },
  { name: "wingman-chat", role: "user", path: "/user/ai-chat" },
  { name: "driver-dashboard", role: "driver", path: "/driver/dashboard" },
  { name: "driver-earnings", role: "driver", path: "/driver/earnings" },
  { name: "driver-trips", role: "driver", path: "/driver/trips" },
  { name: "driver-documents", role: "driver", path: "/driver/vehicle-health" },
];

async function run() {
  const browser = await chromium.launch();

  for (const shot of SHOTS) {
    const profile = shot.role === "driver" ? DRIVER_PROFILE : RIDER_PROFILE;
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    await context.addInitScript(seedAuthScript(shot.role, profile.phone, profile));
    const page = await context.newPage();

    try {
      // Some pages (the live map, notification polling) never go fully
      // network-idle, so wait for DOM load + a fixed settle time instead.
      await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(4500); // let map tiles / async data settle
      if (shot.click) {
        await page.locator(shot.click).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      const outPath = path.join(OUT_DIR, `${shot.name}.png`);
      await page.screenshot({ path: outPath });
      console.log(`Saved ${shot.name}.png`);
    } catch (error) {
      console.error(`FAILED ${shot.name}:`, error.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();
}

run();
