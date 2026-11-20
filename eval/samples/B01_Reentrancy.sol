// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract TipJar {
    mapping(address => uint256) public credit;
    function tip(address to) external payable { credit[to] += msg.value; }
    function cashOut() external {
        uint256 amount = credit[msg.sender];
        require(amount > 0, "nothing");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
        credit[msg.sender] = 0;
    }
}
