
const chai = require('chai')
import { expect, assert } from 'chai';
import { describe, it, before, teardown, Test } from 'mocha';
chai.use(require('chai-as-promised'))
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




describe('Typescript Merkle tree', function() {
    it('runs example', async () => {
        let items = [
            Buffer.from('123', 'hex'),
            Buffer.from('foobar')
        ];
        
        let tree = new MerkleTree(items, keccak256);
        
        let proof = tree.generateProof(items[1]);
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

        console.log(tree.toString())
        
        function verify(item) {
            console.log('item', item)
            let proof = tree.generateProof(item)
            console.log(proof)
            let leaf = tree.findLeaf(item)
            expect(tree.verifyProof(proof, leaf)).to.be.true;
        } 

        items.map(verify)

    })
})

describe('Solidity verifier', function() {
    this.timeout(15000)

    let pe: Web3ProviderEngine, web3: Web3Wrapper;
    let accounts: string[];

    let merkleTreeVerifier: MerkleTreeVerifierContract;

    before(async () => {
        const port = '9546';
        let chain = GanacheTestchain.start(port);
        
        let pe2 = new Web3ProviderEngine();
        pe2.addProvider(new RPCSubprovider(`http://127.0.0.1:${port}`))
        pe2.start()

        web3 = new Web3Wrapper(pe2);
        expect(waitUntilConnected(pe2), "didn't connect to chain").to.eventually.be.fulfilled;
        
        accounts = await web3.getAvailableAddressesAsync();

        // Now we add tracing in.
        const artifactAdapter = new TruffleArtifactAdapter(
            require('path').dirname(require.resolve('../../package.json')), 
            '0.5.0'
        );
        const revertTraceSubprovider = new RevertTraceSubprovider(
            artifactAdapter, 
            accounts[0],
            true
        );

        pe = new Web3ProviderEngine();
        pe.addProvider(revertTraceSubprovider);
        pe.addProvider(new RPCSubprovider(`http://127.0.0.1:${port}`))
        pe.start()
        expect(waitUntilConnected(pe), "didn't connect to chain").to.eventually.be.fulfilled;
        
        web3 = new Web3Wrapper(pe);

        merkleTreeVerifier = await MerkleTreeVerifierContract.deployAsync(
            ...getDeployArgs('MerkleTreeVerifier', pe, accounts[0])
        );
    });

    it('_computeMerkleRoot', async () => {
        let items = TestTreeFactory.itemsToBuffer([
            '12',
            '15',
            '20',
            '25'
        ].map(item => [item]))
        
        let tree = new MerkleTree(items, keccak256);
        let rootJs = tree.root();

        let rootSol = await merkleTreeVerifier._computeMerkleRoot.callAsync(
            items.map(hexify)
        );

        expect(rootSol).to.eq(hexify(rootJs));
    })

    it('_hashLeaf', async() => {
        let data = ['00','2'];

        // TODO 1st param is bytes32, but uint256 encodes simpler
        let hex: string[] = [
            AbiCoder.encodeParameter('uint256', data[0]),
            AbiCoder.encodeParameter('uint256', data[1])
        ].map(item => item.slice(2))

        let buf = Buffer.concat(hex.map(x => Buffer.from(x, 'hex')));
        expect(buf.byteLength).to.eq(64);

        let hashJs = hashLeaf(keccak256, buf);

        let hashSol = await merkleTreeVerifier._hashLeaf.callAsync(
            hexify(buf)
        )

        expect(hashSol).to.eq(hexify(hashJs));
    })

    it('_hashBranch', async() => {
        let left = '123';
        let right = '245';

        // TODO 1st param is bytes32, but uint256 encodes simpler
        let leftHex: string = AbiCoder.encodeParameter('uint256', left)
        let rightHex: string = AbiCoder.encodeParameter('uint256', right)

        let leftBuf = Buffer.from(leftHex.slice(2), 'hex')
        let rightBuf = Buffer.from(rightHex.slice(2), 'hex')

        expect(leftBuf.byteLength).to.eq(32);
        expect(rightBuf.byteLength).to.eq(32);

        let hashJs = hashBranch(keccak256, leftBuf, rightBuf);

        let hashSol = await merkleTreeVerifier._hashBranch.callAsync(
            leftHex,
            rightHex
        )

        expect(hashSol).to.eq(hexify(hashJs));
    })

    it('_verify', async() => {
        let items = [
            ['1','2'],
            ['3','4']
        ]
        let itemsBuffed = TestTreeFactory.itemsToBuffer(items);
        let itemToProve = itemsBuffed[0];
        
        let tree = TestTreeFactory.newTree(items)
        let leafToProve = tree.findLeaf(itemToProve);

        
        let proof = tree.generateProof(itemToProve);
        
        expect(tree.verifyProof(proof, leafToProve)).to.be.true;

        let root = await merkleTreeVerifier._computeRoot.callAsync(
            proof.proofs.map(hexify),
            proof.paths,
            hexify(leafToProve)
        )
        
        expect(root).to.eq(hexify(tree.layers[1][0]));
        expect(root).to.eq(hexify(tree.root()))

        let verify = await merkleTreeVerifier._verify.callAsync(
            proof.proofs.map(hexify), 
            proof.paths,
            hexify(tree.root()), 
            hexify(leafToProve)
        )
        expect(verify).to.be.true;
    })


    it('throws early on an unknown leaf in a proof', async() => {
        let items = [
            ['1','2'],
            ['3','0']
        ]
        let itemsBuffed = TestTreeFactory.itemsToBuffer(items);
        let itemToProve = itemsBuffed[0];
        
        let tree = TestTreeFactory.newTree(items)
        let leafToProve = tree.findLeaf(itemToProve);

        // give it the item, not the leaf (hashed)
        let proof = tree.generateProof(itemToProve);
        expect(tree.verifyProof(proof, leafToProve)).to.throw;
    })

})
