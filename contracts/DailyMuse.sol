// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract DailyMuse is ERC1155, Ownable {
    string public name = "365 Days of Light and Dark";
    string public symbol = "MUSE";
    
    // Day -> Price map (0 = free, overrides global)
    mapping(uint256 => uint256) public tokenPrices;
    uint256 public publicMintPrice = 0.001 ether; // Default ~3 USD
    bool public mintingOpen = true;

    constructor(address initialOwner) 
        ERC1155("https://th3scr1b3-base-mini-app.vercel.app/api/metadata/{id}") 
        Ownable(initialOwner) 
    {}

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    function setMintingOpen(bool _open) public onlyOwner {
        mintingOpen = _open;
    }

    function setPrice(uint256 id, uint256 price) public onlyOwner {
        tokenPrices[id] = price;
    }

    function setPublicMintPrice(uint256 _price) public onlyOwner {
        publicMintPrice = _price;
    }

    function getPrice(uint256 id) public view returns (uint256) {
        if (tokenPrices[id] > 0) return tokenPrices[id];
        return publicMintPrice;
    }

    function mint(uint256 id, uint256 amount, bytes memory data) public payable {
        require(mintingOpen, "Minting is closed");
        require(msg.value >= getPrice(id) * amount, "Insufficient payment");

        _mint(msg.sender, id, amount, data);
    }

    function mintBatch(uint256[] memory ids, uint256[] memory amounts, bytes memory data) public payable {
        require(mintingOpen, "Minting is closed");
        uint256 totalCost = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            totalCost += getPrice(ids[i]) * amounts[i];
        }
        require(msg.value >= totalCost, "Insufficient payment");

        _mintBatch(msg.sender, ids, amounts, data);
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
