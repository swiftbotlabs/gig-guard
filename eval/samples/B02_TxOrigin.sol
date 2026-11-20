// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Treasury {
    address public owner;
    constructor() { owner = msg.sender; }
    receive() external payable {}
    function pay(address payable to, uint256 amount) external {
        require(tx.origin == owner, "only owner");
        to.transfer(amount);
    }
}
