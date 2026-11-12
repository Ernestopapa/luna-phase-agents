// Return leftover mainnet deployer BNB to the user wallet (one-off).
// Reads the throwaway deployer key from .env.mainnet (chmod 600),
// sends balance minus one plain-transfer fee to the user wallet,
// prints the return tx hash and both balances after.
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";

const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.defibit.io/", 56);
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.mainnet"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
console.log("Deployer:", deployer.address);
const balance = await provider.getBalance(deployer.address);
console.log("Deployer balance:", ethers.formatEther(balance), "BNB");
const feeData = await provider.getFeeData();
const gasPrice = feeData.gasPrice ?? 50_000_000n;
const fee = gasPrice * 21_000n;
console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei; transfer fee:", ethers.formatEther(fee), "BNB");
if (balance <= fee) {
  console.log("Balance too low to return anything.");
  process.exit(1);
}
const amount = balance - fee;
console.log("Returning:", ethers.formatEther(amount), "BNB to", USER);
const tx = await deployer.sendTransaction({ to: USER, value: amount, gasLimit: 21_000, gasPrice });
console.log("Return tx:", tx.hash);
const rc = await tx.wait();
console.log("Receipt status:", rc.status, "block:", rc.blockNumber, "gas used:", rc.gasUsed.toString());
console.log("Deployer balance after:", ethers.formatEther(await provider.getBalance(deployer.address)), "BNB");
console.log("User balance after:", ethers.formatEther(await provider.getBalance(USER)), "BNB");
fs.writeFileSync(
  path.join(root, "leftover-return-mainnet.json"),
  JSON.stringify({ to: USER, amountBNB: ethers.formatEther(amount), tx: tx.hash, block: rc.blockNumber, deployerBalanceAfterBNB: ethers.formatEther(await provider.getBalance(deployer.address)), at: new Date().toISOString() }, null, 2)
);
console.log("Saved: leftover-return-mainnet.json");
