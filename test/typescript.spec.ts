
const chai = require('chai')
import { expect, assert } from 'chai';
import { describe, it, before, teardown, Test } from 'mocha';
chai.use(require('chai-as-promised')).use(require('chai-bytes'));
require('mocha')

import {
    MerkleTree,
    hashBranch,
    hashLeaf,
} from "../src";


import { MerkleTreeVerifierContract } from '../build/wrappers/merkle_tree_verifier';

import { 
    GanacheTestchain, TestTreeFactory, hexify, keccak256, waitUntilConnected, prefix0x, getDeployArgs
} from './helpers'

import { Web3ProviderEngine, RPCSubprovider, BigNumber } from "0x.js";
import { Web3Wrapper, AbiDefinition, Provider, TxData } from '@0x/web3-wrapper';
import { TruffleArtifactAdapter, RevertTraceSubprovider } from '@0x/sol-trace';

let $web3 = require('web3')
const AbiCoder = require('web3-eth-abi').AbiCoder();



function dehexify(str: string): Buffer {
    // begins with 0x
    if(str[1] == 'x') str = str.slice(2);
    return Buffer.from(str, 'hex')
}

describe('Typescript Merkle tree', function() {
    it('runs example', async () => {
        let items = [
            Buffer.from('123', 'hex'),
            Buffer.from('foobar')
        ];
        
        let tree = new MerkleTree(items, keccak256);
        
        let proof = tree.generateProof(1);
        expect(tree.verifyProof(proof, tree.findLeaf(items[1]))).to.be.true;
        expect(tree.verifyProof(proof, tree.findLeaf(items[0]))).to.be.false;
    })

    it('handles two duplicate elements', async () => {
        let items = [
            Buffer.from('12', 'hex'),
            Buffer.from('15', 'hex'),
            Buffer.from('20', 'hex'),
            Buffer.from('25', 'hex')
        ];
        
        let tree = new MerkleTree(items, keccak256);
        let leaves = tree.layers[0];

        // console.log(tree.toString())
        
        function verify(item, i) {
            // console.log('item', item)
            let proof = tree.generateProof(i)
            // console.log(proof)
            let leaf = tree.leaves[i]
            expect(tree.verifyProof(proof, leaf)).to.be.true;
        } 

        items.map(verify)
    })

    it('computes on n=1 items', async () => {
        let items = [
            Buffer.from('123', 'hex'),
        ];
        
        let tree = new MerkleTree(items, keccak256);

        expect(tree.nLayers).to.eq(2)

        function expectArraysEqual(a, b: Buffer) {
            expect(hexify(a)).to.eq(hexify(b))
        }
        
        expectArraysEqual(tree.layers[0][0], hashLeaf(keccak256, items[0]))
        expectArraysEqual(tree.layers[0][1], hashLeaf(keccak256, items[0]))
        expectArraysEqual(tree.layers[1][0], hashBranch(keccak256, tree.layers[0][0], tree.layers[0][1]))
        expectArraysEqual(tree.root(), tree.layers[1][0])
        
        let proof = tree.generateProof(1);
        expect(tree.verifyProof(proof, tree.findLeaf(items[0]))).to.be.true;
    })

    it('fails on n=0 items', async () => {
        let items = [
        ];
        
        expect(() => {
            let tree = new MerkleTree(items, keccak256);
        }).to.throws('Invalid array length')
    })


    it('throws early on an unknown leaf in a proof', async() => {
        let items = [
            ['1','2'],
            ['3','0']
        ]
        let itemsBuffed = TestTreeFactory.itemsToBuffer(items);
        // let itemToProve = itemsBuffed[0];
        
        let tree = TestTreeFactory.newTree(items)
        let i = 0
        let leafToProve = tree.leaves[i];

        // give it the item, not the leaf (hashed)
        let proof = tree.generateProof(i);
        expect(tree.verifyProof(proof, leafToProve)).to.throw;
    })
})