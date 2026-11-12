// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IAgentIdRegistry {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title Luna Phase Agents — 7,777 moon-phase Agents
/// @notice Binance Agent ID NFT mint, modelled on the proven 7,777 family
///         (Kitsuneon 0x2b5c0d44878279501aa111e353a2b493e0823b57,
///         LunaPhase 0xf8da629842523878ad9d2cdc559ade37638bab5d and the
///         same factory siblings): ERC721 + Ownable + ReentrancyGuard,
///         registry address passed in the constructor.
///         Supply: 7,777 total = 7,000 FREE (90%) + 777 PAID (10%).
///         SINGLE blended mint(qty): the first 3 mints per wallet are
///         FREE, every extra mint in the SAME transaction costs
///         0.00005 BNB (~$0.035 at $700/BNB). No separate paid phase,
///         no freeMint() function. Max 50 per wallet total, max 50 per tx.
///         Agent ID required for ALL mints (free + paid). EOA-only
///         (msg.sender == tx.origin). 5% ERC-2981 royalties (500 bps)
///         to the owner. Transferable ERC-721, NOT soulbound.
///         Art is ON-CHAIN SVG: 8 moon phases, phase = (tokenId-1) % 8,
///         tokenURI returns a base64 data URI generated in-contract.
///         There is NO setBaseURI, NO IPFS image and NO off-chain
///         metadata — the art is immutable at deploy. Do NOT add a
///         setBaseURI later; that would change the locked art model.
///         Mainnet registry: 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
///         Testnet/local: deploy AgentIdRegistryMock first and pass its address.
///
///         NOT AUDITED: this contract has NOT been audited by a third
///         party. "Built on OpenZeppelin" is not an audit.
///         Owner CAN: withdraw all BNB, transfer/renounce ownership.
///         Owner CANNOT: change supply / free supply / price /
///         free-per-wallet / max per wallet / registry / art, mint extra
///         tokens, pause, freeze, burn, or take holders' tokens.
contract LunaPhaseAgents is ERC721, ERC721Royalty, Ownable, ReentrancyGuard {
    using Strings for uint256;

    IAgentIdRegistry public immutable agentIdRegistry;

    uint256 public constant MAX_SUPPLY = 7777;
    uint256 public constant FREE_SUPPLY = 7000;
    uint256 public constant PAID_SUPPLY = MAX_SUPPLY - FREE_SUPPLY; // 777
    uint256 public constant PAID_PRICE = 0.00005 ether; // ~$0.035 at $700/BNB
    uint256 public constant FREE_PER_WALLET = 3;
    uint256 public constant MAX_PER_WALLET = 50;
    uint256 public constant MAX_PER_TX = 50;

    /// @notice Number of free mints a wallet has used (0..3).
    mapping(address => uint256) public freeClaimed;
    /// @notice Total mints per wallet (free + paid, 0..50).
    mapping(address => uint256) public mintedCount;
    /// @notice True if a tokenId was a paid mint (false = free mint).
    mapping(uint256 => bool) public tokenPaid;

    uint256 public paidMinted;
    uint256 private _freeCount;
    uint256 private _nextId = 1;

    event Minted(address indexed to, uint256 indexed tokenId, bool paid);
    event BnbWithdrawn(address indexed to, uint256 amount);

    constructor(address agentIdRegistry_, address initialOwner)
        ERC721("Luna Phase Agents", "LPHASE")
        Ownable(initialOwner)
    {
        require(agentIdRegistry_ != address(0), "zero registry");
        agentIdRegistry = IAgentIdRegistry(agentIdRegistry_);
        // 5% ERC-2981 default royalty to the owner (500 / 10000 bps).
        _setDefaultRoyalty(initialOwner, 500);
    }

    /// @notice ERC-2981 + ERC-721 interface support (required override).
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ----------------------------------------------------------------- views
    function totalSupply() public view returns (uint256) {
        return _nextId - 1;
    }

    /// @notice Number of free mints used so far (0..7000).
    function freeMintedCount() public view returns (uint256) {
        return _freeCount;
    }

    function freeRemaining() public view returns (uint256) {
        return FREE_SUPPLY - _freeCount;
    }

    function paidRemaining() public view returns (uint256) {
        return PAID_SUPPLY - paidMinted;
    }

    function freeOpen() public view returns (bool) {
        return _freeCount < FREE_SUPPLY;
    }

    function paidOpen() public view returns (bool) {
        return paidMinted < PAID_SUPPLY;
    }

    /// @notice True once an address has used at least one free mint.
    function freeMinted(address wallet) public view returns (bool) {
        return freeClaimed[wallet] > 0;
    }

    /// @notice Moon phase of a token: (tokenId-1) % 8, so each phase
    ///         appears ~972 times across 7,777 tokens.
    function phaseOf(uint256 tokenId) public pure returns (uint8) {
        return uint8((tokenId - 1) % 8);
    }

    function phaseName(uint8 phase) public pure returns (string memory) {
        if (phase == 0) return "New Moon";
        if (phase == 1) return "Waxing Crescent";
        if (phase == 2) return "First Quarter";
        if (phase == 3) return "Waxing Gibbous";
        if (phase == 4) return "Full Moon";
        if (phase == 5) return "Waning Gibbous";
        if (phase == 6) return "Last Quarter";
        return "Waning Crescent";
    }

    function phaseIllumination(uint8 phase) public pure returns (uint256) {
        if (phase == 0) return 0;
        if (phase == 4) return 100;
        if (phase == 2 || phase == 6) return 50;
        if (phase == 3 || phase == 5) return 75;
        return 25;
    }

    /// @notice How many of `qty` would be free / paid for `wallet`,
    ///         and the exact BNB cost. Free qty is capped by the
    ///         wallet's remaining free allowance AND by freeRemaining().
    function quoteMint(address wallet, uint256 qty)
        public
        view
        returns (uint256 freeQty, uint256 paidQty, uint256 cost)
    {
        uint256 freeLeftWallet = FREE_PER_WALLET - freeClaimed[wallet];
        freeQty = qty < freeLeftWallet ? qty : freeLeftWallet;
        uint256 fr = freeRemaining();
        if (freeQty > fr) freeQty = fr;
        paidQty = qty - freeQty;
        cost = PAID_PRICE * paidQty;
    }

    // ------------------------------------------------------------ blended mint
    /// @notice Single blended mint: first 3 per wallet FREE, every extra
    ///         in the same tx paid at 0.00005 BNB. Agent ID required for
    ///         ALL mints. EOA-only. Exact payment required.
    function mint(uint256 qty) external payable nonReentrant {
        require(qty > 0 && qty <= MAX_PER_TX, "qty 1..50");
        require(msg.sender == tx.origin, "EOA only");
        require(agentIdRegistry.balanceOf(msg.sender) > 0, "no Agent ID");
        require(mintedCount[msg.sender] + qty <= MAX_PER_WALLET, "max 50 per wallet");
        require(totalSupply() + qty <= MAX_SUPPLY, "exceeds max supply");

        (uint256 freeQty, uint256 paidQty, uint256 cost) = quoteMint(msg.sender, qty);
        require(paidQty <= paidRemaining(), "paid supply exhausted");
        require(msg.value == cost, "wrong price");

        // State BEFORE any mint (checks-effects-interactions).
        freeClaimed[msg.sender] += freeQty;
        _freeCount += freeQty;
        paidMinted += paidQty;
        mintedCount[msg.sender] += qty;

        for (uint256 i = 0; i < qty; i++) {
            uint256 tokenId = _nextId++;
            bool isPaid = i >= freeQty;
            tokenPaid[tokenId] = isPaid;
            _safeMint(msg.sender, tokenId);
            emit Minted(msg.sender, tokenId, isPaid);
        }
    }

    // ------------------------------------------------------- on-chain SVG art
    function _shadowCx(uint8 phase) internal pure returns (int256) {
        if (phase == 0) return 200; // New Moon: shadow covers all
        if (phase == 1) return 158; // Waxing Crescent: right sliver lit
        if (phase == 2) return 90; // First Quarter: right half lit
        if (phase == 3) return 55; // Waxing Gibbous: left sliver dark
        if (phase == 4) return -1000; // Full Moon: no shadow
        if (phase == 5) return 345; // Waning Gibbous: right sliver dark
        if (phase == 6) return 310; // Last Quarter: left half lit
        return 242; // Waning Crescent: left sliver lit
    }

    function _svg(uint256 tokenId, uint8 phase) internal pure returns (string memory) {
        string memory shadowStr = _shadowCx(phase) < 0
            ? string(abi.encodePacked("-", uint256(-_shadowCx(phase)).toString()))
            : uint256(_shadowCx(phase)).toString();
        string memory a = string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'>",
                "<rect width='400' height='400' fill='#0a0e1a'/>",
                "<circle cx='60' cy='50' r='2' fill='#ffffff'/><circle cx='330' cy='70' r='2' fill='#ffffff'/>",
                "<circle cx='90' cy='320' r='2' fill='#ffffff'/><circle cx='340' cy='300' r='1.5' fill='#ffffff'/>",
                "<circle cx='200' cy='180' r='110' fill='#e9e6d8'/>",
                "<circle cx='", shadowStr, "' cy='180' r='110' fill='#0a0e1a'/>"
            )
        );
        string memory b = string(
            abi.encodePacked(
                "<circle cx='200' cy='180' r='110' fill='none' stroke='#3a4666' stroke-width='2'/>",
                "<text x='200' y='340' font-family='monospace' font-size='22' fill='#e9e6d8' text-anchor='middle'>",
                phaseName(phase),
                "</text><text x='200' y='368' font-family='monospace' font-size='14' fill='#8a94b8' text-anchor='middle'>Luna Phase Agents #",
                tokenId.toString(),
                " - ",
                phaseIllumination(phase).toString(),
                "% lit</text></svg>"
            )
        );
        return string(abi.encodePacked(a, b));
    }

    function _image(uint256 tokenId, uint8 phase) internal pure returns (string memory) {
        string memory svg = _svg(tokenId, phase);
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
    }

    function _json(uint256 tokenId, uint8 phase, string memory image) internal view returns (string memory) {
        string memory p1 = string(
            abi.encodePacked(
                '{"name":"Luna Phase Agents #', tokenId.toString(),
                '","description":"Luna Phase Agents (LPHASE) - 7,777 moon-phase Agents on BNB Smart Chain. First 3 per wallet free for Binance Agent ID holders, every extra 0.00005 BNB. On-chain SVG art, 8 moon phases. Not audited by a third party. No floor price, returns, token or airdrop promised.",',
                '"image":"', image, '",'
            )
        );
        string memory p2 = string(
            abi.encodePacked(
                '"attributes":[{"trait_type":"Phase","value":"', phaseName(phase),
                '"},{"trait_type":"Illumination","value":"', phaseIllumination(phase).toString(),
                '%"},{"trait_type":"Phase Index","value":', uint256(phase).toString(),
                '},{"trait_type":"Origin","value":"', tokenPaid[tokenId] ? "Paid" : "Free",
                '"}]}'
            )
        );
        string memory head = string(abi.encodePacked(p1, p2));
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(head))));
    }

    /// @notice Fully on-chain metadata: data:application/json;base64
    ///         with a data:image/svg+xml;base64 image. No baseURI.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "nonexistent token");
        uint8 phase = phaseOf(tokenId);
        return _json(tokenId, phase, _image(tokenId, phase));
    }

    // ----------------------------------------------------------------- BNB
    /// @notice Withdraw BNB revenue (paid mints). Only way BNB leaves.
    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "nothing to withdraw");
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "BNB send failed");
        emit BnbWithdrawn(owner(), amount);
    }

    receive() external payable {}
}
