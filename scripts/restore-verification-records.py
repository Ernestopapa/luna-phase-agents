import json

t = json.load(open("/tmp/sourcify-testnet.json"))
m = json.load(open("/tmp/sourcify-mainnet.json"))

testnet = {
    "submitStatus": 202,
    "submitBody": {"verificationId": "783e705b-4034-4445-86db-9dc5d4a651ef"},
    "lastPoll": {
        "isJobCompleted": True,
        "verificationId": "783e705b-4034-4445-86db-9dc5d4a651ef",
        "jobStartTime": "2026-11-02T16:08:01Z",
        "jobFinishTime": "2026-11-02T16:08:02Z",
        "contract": t,
    },
}
json.dump(testnet, open("verification/sourcify-result.json", "w"), indent=2)

mainnet = {
    "submitStatus": 202,
    "submitBody": {"verificationId": "eebf0fee-6cbc-4eda-b235-65317543d227"},
    "lastPoll": {
        "isJobCompleted": True,
        "verificationId": "eebf0fee-6cbc-4eda-b235-65317543d227",
        "jobStartTime": "2026-11-02T16:18:44Z",
        "jobFinishTime": "2026-11-02T16:18:45Z",
        "contract": m,
        "externalVerifications": {
            "etherscan": {
                "verificationId": "ilvwfes7szp5e8ctt1f3ewym7a9yeehzgziq5yqs24tyvgbayj",
                "statusUrl": "https://api.etherscan.io/v2/api?chainid=56&module=contract&action=checkverifystatus&guid=ilvwfes7szp5e8ctt1f3ewym7a9yeehzgziq5yqs24tyvgbayj",
                "explorerUrl": "https://bscscan.com//address/0x5c04392641c81F1b69826E13d8f3F78c58464970",
            }
        },
    },
}
json.dump(mainnet, open("verification/sourcify-result-mainnet.json", "w"), indent=2)

bscscan = {
    "address": "0x5c04392641c81F1b69826E13d8f3F78c58464970",
    "chainId": 56,
    "method": "Sourcify forwarding (guid ilvwfes7szp5e8ctt1f3ewym7a9yeehzgziq5yqs24tyvgbayj, checkverifystatus Pass - Verified); confirmed by getsourcecode chain 56",
    "verified": True,
    "ContractName": "LunaPhaseAgents",
    "CompilerVersion": "v0.8.26+commit.8a97fa7a",
    "OptimizationUsed": "1",
    "Runs": "200",
    "EVMVersion": "cancun",
    "ConstructorArguments": "00000000000000000000000060b9262456de011f7d15a54cdd8c48baaa8b022f00000000000000000000000075d251ba39ded2e456d9f6dd776f77d422864403",
    "SourceCode_chars": 193257,
    "contract_page": "https://bscscan.com/address/0x5c04392641c81F1b69826E13d8f3F78c58464970",
}
json.dump(bscscan, open("verification/bscscan-result-mainnet.json", "w"), indent=2)

print("testnet match:", t.get("match"), t.get("matchId"))
print("mainnet match:", m.get("match"), m.get("matchId"))
print("bscscan-result-mainnet.json saved")
