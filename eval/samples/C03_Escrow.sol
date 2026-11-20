// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Escrow {
    address public immutable buyer;
    address public immutable seller;
    uint256 public immutable deadline;
    bool public settled;
    constructor(address s, uint256 d) payable { buyer = msg.sender; seller = s; deadline = d; }
    function release() external {
        require(msg.sender == buyer, "only buyer");
        require(!settled, "settled");
        settled = true;
        (bool ok, ) = payable(seller).call{value: address(this).balance}("");
        require(ok, "send failed");
    }
    function refund() external {
        require(block.timestamp > deadline, "too early");
        require(!settled, "settled");
        settled = true;
        (bool ok, ) = payable(buyer).call{value: address(this).balance}("");
        require(ok, "send failed");
    }
}
