// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract FeeVault {
    address public owner;
    uint256 public feeBps = 100;
    constructor() { owner = msg.sender; }
    receive() external payable {}
    function setOwner(address newOwner) external { owner = newOwner; }
    function setFee(uint256 bps) external { require(msg.sender == owner, "only owner"); require(bps <= 1000); feeBps = bps; }
    function sweep() external { require(msg.sender == owner, "only owner"); payable(owner).transfer(address(this).balance); }
}
