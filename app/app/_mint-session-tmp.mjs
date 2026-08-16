import "dotenv/config";
import * as jose from "jose";

const secret = new TextEncoder().encode(process.env.APP_SECRET);
const clientId = process.env.APP_ID || "ridepay";

async function mint(unionId) {
  return new jose.SignJWT({ unionId, clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

const riderToken = await mint("phone:+916294011684");
const driverToken = await mint("phone:+918371816725");
console.log("RIDER_TOKEN=" + riderToken);
console.log("DRIVER_TOKEN=" + driverToken);
