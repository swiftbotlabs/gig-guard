// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract OwnedVault {
    address public owner;
    event OwnerChanged(address indexed from, address indexed to);
    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
    receive() external payable {}
    function setOwner(address newOwner) external onlyOwner { require(newOwner != address(0), "zero"); emit OwnerChanged(owner, newOwner); owner = newOwner; }
    function sweep(uint256 amt) external onlyOwner {
        (bool ok, ) = payable(owner).call{value: amt}("");
        require(ok, "send failed");
    }
}
