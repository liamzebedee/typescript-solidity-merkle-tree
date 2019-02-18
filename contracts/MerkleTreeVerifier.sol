pragma solidity ^0.5.0;

library MerkleTreeVerifier {
    function math_log2(uint x) public pure returns (uint y){
        assembly {
            let arg := x
            x := sub(x,1)
            x := or(x, div(x, 0x02))
            x := or(x, div(x, 0x04))
            x := or(x, div(x, 0x10))
            x := or(x, div(x, 0x100))
            x := or(x, div(x, 0x10000))
            x := or(x, div(x, 0x100000000))
            x := or(x, div(x, 0x10000000000000000))
            x := or(x, div(x, 0x100000000000000000000000000000000))
            x := add(x, 1)
            let m := mload(0x40)
            mstore(m,           0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd)
            mstore(add(m,0x20), 0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe)
            mstore(add(m,0x40), 0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616)
            mstore(add(m,0x60), 0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff)
            mstore(add(m,0x80), 0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e)
            mstore(add(m,0xa0), 0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707)
            mstore(add(m,0xc0), 0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606)
            mstore(add(m,0xe0), 0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100)
            mstore(0x40, add(m, 0x100))
            let magic := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
            let shift := 0x100000000000000000000000000000000000000000000000000000000000000
            let a := div(mul(x, magic), shift)
            y := div(mload(add(m,sub(255,a))), shift)
            y := add(y, mul(256, gt(arg, 0x8000000000000000000000000000000000000000000000000000000000000000)))
        }  
    }

    function _computeMerkleRoot(bytes32[] memory items) public pure returns (bytes32) {
        for(uint i = 0; i < items.length; i++) {
            items[i] = _hashLeaf(items[i]);
        }

        // extend layer to be a power of 2
        // this simplifies logic later
        bytes32[] memory layer = _getBalancedLayer(items);

        while(layer.length > 1) {
            layer = _computeLayer(layer);
        }

        return layer[0];
    }

    function _getBalancedLayer(bytes32[] memory items) public pure returns (bytes32[] memory) {
        uint powerOf2Size = 2 ** log2(items.length);
        if(items.length == 1) {
            powerOf2Size = 2; 
        }
        bytes32[] memory layer = new bytes32[](powerOf2Size);
        for(uint i = 0; i < layer.length; i++) {
            if(i < items.length) {
                layer[i] = items[i];
            } else {
                // duplicate last leaf
                layer[i] = items[items.length - 1];
            }
        }
        return layer;
    }

    function _computeLayer(bytes32[] memory layer) public pure returns (bytes32[] memory) {
        // uint nLayers = log2(layer.length);
        // bytes32[] memory nextLayer = new bytes32[](2**(nLayers-1));
        require(layer.length == 2 ** log2(layer.length), "NOT_PERFECT_POWEROF2");
        
        bytes32[] memory nextLayer = new bytes32[](layer.length / 2);
        
        for(uint i = 0; i < nextLayer.length; i++) {
            uint left = i * 2;
            uint right = left + 1;

            // if(layer.length % 2 == 1) {
            //     if(right == layer.length) {
            //         right = left;
            //     }
            // }

            nextLayer[i] = _hashBranch(layer[left], layer[right]);
        }

        return nextLayer;
    }


    /**
     * @dev Verifies a Merkle proof proving the existence of a leaf in a Merkle tree. Assumes that each pair of leaves
     * and each pair of pre-images are sorted.
     * @param proof Merkle proof containing sibling hashes on the branch from the leaf to the root of the Merkle tree
     * @param root Merkle root
     * @param leaf Leaf of Merkle tree
     */
    function _verify(bytes32[] memory proof, bool[] memory paths, bytes32 root, bytes32 leaf) public pure returns (bool) {
        // Check if the computed hash (root) is equal to the provided root
        return _computeRoot(proof, paths, leaf) == root;
    }

    function _computeRoot(bytes32[] memory proof, bool[] memory paths, bytes32 leaf) public pure returns (bytes32) {        
        bytes32 node = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 pairNode = proof[i];

            if (paths[i]) {
                // Hash(current element of the proof + current computed hash)
                node = _hashBranch(pairNode, node);
            } else {
                // Hash(current computed hash + current element of the proof)
                node = _hashBranch(node, pairNode);
            }
        }

        return node;
    }
    
    function _hashLeaf(bytes32 leaf) public pure returns (bytes32) {
        bytes1 LEAF_PREFIX = 0x00;
        return keccak256(abi.encodePacked(LEAF_PREFIX, leaf));
    }

    function _hashBranch(bytes32 left, bytes32 right) public pure returns (bytes32) {
        bytes1 BRANCH_PREFIX = 0x01;
        return keccak256(abi.encodePacked(BRANCH_PREFIX, left, right));
    }
}