// Gate 3 proof: extract the on-chain SVG + JSON for all 8 phases.
// Deploys LunaPhaseAgents on a local Anvil chain, mints tokens #1-8
// (3 free + 5 paid in one tx, 0.00025 BNB), decodes each tokenURI and
// writes art/phase-<n>-<slug>.svg and art/tokenuri-<n>.json, plus
// art/tokenuri-summary.json. No IPFS, no metadata files to host —
// the art lives in the contract; these files are the proof copy.
// Usage: node scripts/verify-tokenuri.mjs
import { spawn } from "node:child_process";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "build", `${n}.json`), "utf8"));
const ANVIL = path.join(root, "tools", "anvil");
const PORT = 8548;
const slug = (s) => s.toLowerCase().replace(/ /g, "-");

const anvil = spawn(ANVIL, ["--port", String(PORT), "--silent"], { stdio: "ignore" });
const provider = new ethers.JsonRpcProvider(new ethers.FetchRequest(`http://127.0.0.1:${PORT}`));
try {
  for (let i = 0; i < 50; i++) {
    try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  const deployer = await provider.getSigner(0);
  const deployerAddr = await deployer.getAddress();
  const mock = await new ethers.ContractFactory(load("AgentIdRegistryMock").abi, load("AgentIdRegistryMock").bytecode, deployer).deploy(deployerAddr);
  await mock.waitForDeployment();
  const luna = await new ethers.ContractFactory(load("LunaPhaseAgents").abi, load("LunaPhaseAgents").bytecode, deployer).deploy(await mock.getAddress(), deployerAddr);
  await luna.waitForDeployment();
  await (await mock.setAgent(deployerAddr, true)).wait();
  // mint(8): 3 free + 5 paid = 5 x 0.00005 = 0.00025 BNB
  await (await luna.connect(deployer).mint(8, { value: ethers.parseEther("0.00025") })).wait();
  console.log(`minted #1-8, totalSupply ${await luna.totalSupply()}, paidMinted ${await luna.paidMinted()}`);

  const artDir = path.join(root, "art");
  fs.mkdirSync(artDir, { recursive: true });
  const summary = [];
  for (let id = 1; id <= 8; id++) {
    const uri = await luna.tokenURI(id);
    const json = JSON.parse(Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8"));
    const svg = Buffer.from(json.image.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf8");
    const phase = json.attributes.find((a) => a.trait_type === "Phase").value;
    const illum = json.attributes.find((a) => a.trait_type === "Illumination").value;
    const origin = json.attributes.find((a) => a.trait_type === "Origin").value;
    fs.writeFileSync(path.join(artDir, `phase-${id - 1}-${slug(phase)}.svg`), svg);
    fs.writeFileSync(path.join(artDir, `tokenuri-${id}.json`), JSON.stringify(json, null, 2));
    const row = { tokenId: id, phase, phaseIndex: id - 1, illumination: illum, origin, svgSha256: crypto.createHash("sha256").update(svg).digest("hex"), jsonSha256: crypto.createHash("sha256").update(JSON.stringify(json)).digest("hex"), svgBytes: svg.length };
    summary.push(row);
    console.log(`#${id} ${phase} (${illum}, ${origin}) svg ${svg.length}B sha256 ${row.svgSha256.slice(0, 16)}…`);
  }
  const distinctSvg = new Set(summary.map((r) => r.svgSha256)).size;
  console.log(`distinct SVGs: ${distinctSvg}/8 (must be 8 — one per phase)`);
  if (distinctSvg !== 8) process.exitCode = 1;
  fs.writeFileSync(path.join(artDir, "tokenuri-summary.json"), JSON.stringify(summary, null, 2));
  console.log("Wrote art/phase-*.svg, art/tokenuri-*.json, art/tokenuri-summary.json");
} finally {
  anvil.kill("SIGTERM");
}
