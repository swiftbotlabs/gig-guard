// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract PrizePool {
    address public organizer;
    constructor() payable { organizer = msg.sender; }
    function payWinner(address payable w, uint256 amt) external {
        require(msg.sender == organizer, "only organizer");
        w.transfer(amt);
    }
    function close(address payable to) external {
        selfdestruct(to);
    }
}
