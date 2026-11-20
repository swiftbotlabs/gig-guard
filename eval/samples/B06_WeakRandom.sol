// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Raffle {
    address[] public players;
    function enter() external payable { require(msg.value == 0.01 ether); players.push(msg.sender); }
    function draw() external {
        require(players.length > 0);
        uint256 i = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, players.length))) % players.length;
        address winner = players[i];
        delete players;
        payable(winner).transfer(address(this).balance);
    }
}
