// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract SafeTipJar {
    mapping(address => uint256) public credit;
    bool private locked;
    modifier nonReentrant() { require(!locked, "reentrant"); locked = true; _; locked = false; }
    function tip(address to) external payable { credit[to] += msg.value; }
    function cashOut() external nonReentrant {
        uint256 amount = credit[msg.sender];
        require(amount > 0, "nothing");
        credit[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
    }
}
